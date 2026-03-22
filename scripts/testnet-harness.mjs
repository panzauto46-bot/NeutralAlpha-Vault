import fs from "node:fs";
import path from "node:path";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const DEFAULT_RPC = "https://api.testnet.solana.com";

const config = {
  rpcUrl: process.env.SOLANA_RPC_URL ?? DEFAULT_RPC,
  flowMode: process.env.HARNESS_FLOW_MODE ?? "generic",
  keypairPath: process.env.SOLANA_KEYPAIR_PATH ?? "",
  minBalanceSol: Number(process.env.HARNESS_MIN_BALANCE_SOL ?? 0.1),
  airdropSol: Number(process.env.HARNESS_AIRDROP_SOL ?? 1),
  transferLamports: Number(process.env.HARNESS_TRANSFER_LAMPORTS ?? 10_000),
  strict: process.env.HARNESS_STRICT === "1",
  vaultProgramId: process.env.NEUTRALALPHA_VAULT_PROGRAM_ID ?? "",
  driftProgramId: process.env.DRIFT_PROGRAM_ID ?? "",
  pythPriceFeed: process.env.PYTH_PRICE_FEED ?? "",
  depositAccountsJson: process.env.NEUTRALALPHA_DEPOSIT_ACCOUNTS_JSON ?? "",
  hedgeAccountsJson: process.env.NEUTRALALPHA_HEDGE_ACCOUNTS_JSON ?? "",
  unwindAccountsJson: process.env.NEUTRALALPHA_UNWIND_ACCOUNTS_JSON ?? "",
  depositDataB64: process.env.NEUTRALALPHA_DEPOSIT_DATA_B64 ?? "",
  hedgeDataB64: process.env.NEUTRALALPHA_HEDGE_DATA_B64 ?? "",
  unwindDataB64: process.env.NEUTRALALPHA_UNWIND_DATA_B64 ?? "",
};

function info(message) {
  console.log(`[testnet-harness] ${message}`);
}

function warn(message) {
  console.warn(`[testnet-harness] ${message}`);
}

function loadOrGeneratePayer() {
  if (!config.keypairPath) {
    warn("SOLANA_KEYPAIR_PATH not set. Using ephemeral keypair.");
    return { keypair: Keypair.generate(), source: "ephemeral" };
  }

  const resolvedPath = path.resolve(config.keypairPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Keypair file not found: ${resolvedPath}`);
  }

  const raw = fs.readFileSync(resolvedPath, "utf8");
  const secret = Uint8Array.from(JSON.parse(raw));
  return {
    keypair: Keypair.fromSecretKey(secret),
    source: resolvedPath,
  };
}

function toExplorerUrl(signature) {
  return `https://explorer.solana.com/tx/${signature}?cluster=testnet`;
}

function memoInstruction(text) {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [],
    data: Buffer.from(text, "utf8"),
  });
}

function parseAccounts(jsonText, payerPubkey) {
  const parsed = JSON.parse(jsonText);
  if (!Array.isArray(parsed)) {
    throw new Error("Accounts JSON must be an array.");
  }
  return parsed.map((account) => {
    if (!account || typeof account.pubkey !== "string") {
      throw new Error("Each account entry must include pubkey.");
    }
    const pubkeyText = account.pubkey === "$PAYER" ? payerPubkey.toBase58() : account.pubkey;
    return {
      pubkey: new PublicKey(pubkeyText),
      isSigner: Boolean(account.isSigner),
      isWritable: Boolean(account.isWritable),
    };
  });
}

function decodeStepData(stepName, encoded, defaultOpcode) {
  if (!encoded) {
    return Buffer.from([defaultOpcode]);
  }
  try {
    return Buffer.from(encoded, "base64");
  } catch {
    throw new Error(`Invalid base64 for ${stepName} step data.`);
  }
}

function buildVaultStepInstruction(stepName, payerPubkey) {
  if (!config.vaultProgramId) {
    throw new Error("NEUTRALALPHA_VAULT_PROGRAM_ID is required in vault mode.");
  }

  const programId = new PublicKey(config.vaultProgramId);
  if (stepName === "DEPOSIT") {
    if (!config.depositAccountsJson) {
      throw new Error("NEUTRALALPHA_DEPOSIT_ACCOUNTS_JSON is required in vault mode.");
    }
    return new TransactionInstruction({
      programId,
      keys: parseAccounts(config.depositAccountsJson, payerPubkey),
      data: decodeStepData("DEPOSIT", config.depositDataB64, 0),
    });
  }
  if (stepName === "HEDGE") {
    if (!config.hedgeAccountsJson) {
      throw new Error("NEUTRALALPHA_HEDGE_ACCOUNTS_JSON is required in vault mode.");
    }
    return new TransactionInstruction({
      programId,
      keys: parseAccounts(config.hedgeAccountsJson, payerPubkey),
      data: decodeStepData("HEDGE", config.hedgeDataB64, 1),
    });
  }
  if (stepName === "UNWIND") {
    if (!config.unwindAccountsJson) {
      throw new Error("NEUTRALALPHA_UNWIND_ACCOUNTS_JSON is required in vault mode.");
    }
    return new TransactionInstruction({
      programId,
      keys: parseAccounts(config.unwindAccountsJson, payerPubkey),
      data: decodeStepData("UNWIND", config.unwindDataB64, 2),
    });
  }

  throw new Error(`Unsupported vault step: ${stepName}`);
}

async function rpcCall(method, params = []) {
  const response = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`);
  }
  return response.json();
}

async function sendStep(connection, payer, stepName, instructions) {
  const latest = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: payer.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  });
  tx.add(...instructions);
  tx.sign(payer);
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed",
  );
  info(`${stepName} confirmed: ${signature}`);
  info(`Explorer: ${toExplorerUrl(signature)}`);
  return signature;
}

async function ensureBalance(connection, payer) {
  const minimumLamports = Math.floor(config.minBalanceSol * LAMPORTS_PER_SOL);
  let balance = await connection.getBalance(payer.publicKey, "confirmed");
  info(`Payer balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

  if (balance >= minimumLamports) {
    return { balance, canSend: true };
  }

  try {
    const airdropLamports = Math.floor(config.airdropSol * LAMPORTS_PER_SOL);
    info(`Requesting airdrop: ${config.airdropSol} SOL`);
    const airdropSig = await connection.requestAirdrop(payer.publicKey, airdropLamports);
    await connection.confirmTransaction(airdropSig, "confirmed");
    info(`Airdrop signature: ${airdropSig}`);
  } catch (error) {
    warn(`Airdrop failed: ${error.message}`);
  }

  balance = await connection.getBalance(payer.publicKey, "confirmed");
  info(`Balance after airdrop: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  if (balance >= minimumLamports) {
    return { balance, canSend: true };
  }

  if (config.strict) {
    throw new Error(
      `Insufficient payer balance (${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL). Set funded SOLANA_KEYPAIR_PATH or disable strict mode.`,
    );
  }

  warn(
    "Insufficient balance for sending tx flow. Provide funded SOLANA_KEYPAIR_PATH or set HARNESS_STRICT=1 to fail fast.",
  );
  return { balance, canSend: false };
}

function printEnvironmentHints() {
  const missing = [];
  if (!config.vaultProgramId) missing.push("NEUTRALALPHA_VAULT_PROGRAM_ID");
  if (!config.driftProgramId) missing.push("DRIFT_PROGRAM_ID");
  if (!config.pythPriceFeed) missing.push("PYTH_PRICE_FEED");
  if (missing.length > 0) {
    warn(`Missing protocol env vars: ${missing.join(", ")}`);
    if (config.flowMode === "vault") {
      warn("Vault mode selected, missing env vars may cause transaction failure.");
    } else {
      warn("Harness uses generic transaction flow only until program IDs and account schema are provided.");
    }
  }
}

async function main() {
  info(`RPC: ${config.rpcUrl}`);
  info(`Flow mode: ${config.flowMode}`);
  printEnvironmentHints();

  const { keypair: payer, source } = loadOrGeneratePayer();
  info(`Payer: ${payer.publicKey.toBase58()}`);
  info(`Signer source: ${source}`);

  const connection = new Connection(config.rpcUrl, "confirmed");
  const version = await connection.getVersion();
  info(`RPC version: ${version["solana-core"]}`);

  const health = await rpcCall("getHealth");
  info(`RPC health: ${health.result}`);

  const funding = await ensureBalance(connection, payer);
  if (!funding.canSend) {
    info("Skipping transaction flow because payer is not funded.");
    return;
  }

  const recipient = Keypair.generate().publicKey;
  info(`Transfer recipient: ${recipient.toBase58()}`);

  if (config.flowMode === "vault") {
    await sendStep(connection, payer, "STEP 1 DEPOSIT", [
      buildVaultStepInstruction("DEPOSIT", payer.publicKey),
      memoInstruction("NeutralAlpha Harness: DEPOSIT"),
    ]);

    await sendStep(connection, payer, "STEP 2 HEDGE", [
      buildVaultStepInstruction("HEDGE", payer.publicKey),
      memoInstruction("NeutralAlpha Harness: HEDGE"),
    ]);

    await sendStep(connection, payer, "STEP 3 UNWIND", [
      buildVaultStepInstruction("UNWIND", payer.publicKey),
      memoInstruction("NeutralAlpha Harness: UNWIND"),
    ]);
  } else {
    await sendStep(connection, payer, "STEP 1 DEPOSIT", [
      memoInstruction("NeutralAlpha Harness: DEPOSIT"),
    ]);

    await sendStep(connection, payer, "STEP 2 HEDGE", [
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient,
        lamports: config.transferLamports,
      }),
      memoInstruction("NeutralAlpha Harness: HEDGE"),
    ]);

    await sendStep(connection, payer, "STEP 3 UNWIND", [
      memoInstruction("NeutralAlpha Harness: UNWIND"),
    ]);
  }

  info("Transaction flow completed on Solana testnet.");
}

main().catch((error) => {
  console.error(`[testnet-harness] failed: ${error.message}`);
  process.exit(1);
});
