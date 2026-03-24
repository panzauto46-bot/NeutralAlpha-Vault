import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const DEFAULT_RPC = "https://api.testnet.solana.com";
const DEFAULT_LOCK_PERIOD_SECS = 90 * 24 * 60 * 60;

const config = {
  rpcUrl: process.env.SOLANA_RPC_URL ?? DEFAULT_RPC,
  keypairPath: process.env.SOLANA_KEYPAIR_PATH ?? "",
  programId: process.env.NEUTRALALPHA_VAULT_PROGRAM_ID ?? "",
  usdcMint: process.env.USDC_MINT ?? "",
  driftProgramId: process.env.DRIFT_PROGRAM_ID ?? "",
  jupiterProgramId: process.env.JUPITER_PROGRAM_ID ?? "",
  pythPriceFeed: process.env.PYTH_PRICE_FEED ?? "",
  rebalanceBot: process.env.REBALANCE_BOT ?? "",
  performanceFeeBps: Number(process.env.PERFORMANCE_FEE_BPS ?? 1000),
  lockPeriodSecs: Number(process.env.LOCK_PERIOD_SECS ?? DEFAULT_LOCK_PERIOD_SECS),
};

function info(message) {
  console.log(`[vault-client] ${message}`);
}

function usage() {
  console.log("Usage:");
  console.log("  npm run vault:accounts");
  console.log("  npm run vault:init");
  console.log("  npm run vault:deposit -- --amount <u64>");
  console.log("  npm run vault:withdraw -- --shares <u64>");
}

function discriminator(ixName) {
  return createHash("sha256").update(`global:${ixName}`).digest().subarray(0, 8);
}

function loadKeypair() {
  if (!config.keypairPath) {
    throw new Error("SOLANA_KEYPAIR_PATH is required.");
  }
  const resolvedPath = path.resolve(config.keypairPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Keypair not found: ${resolvedPath}`);
  }
  const secret = Uint8Array.from(JSON.parse(fs.readFileSync(resolvedPath, "utf8")));
  return Keypair.fromSecretKey(secret);
}

function parseArg(name) {
  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] ?? null;
}

function requirePubkey(name, value) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return new PublicKey(value);
}

function deriveVaultPdas(programId, usdcMint, payer) {
  const [vaultState] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), usdcMint.toBuffer()],
    programId,
  );
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority"), vaultState.toBuffer()],
    programId,
  );
  const [userPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), vaultState.toBuffer(), payer.toBuffer()],
    programId,
  );
  return { vaultState, vaultAuthority, userPosition };
}

function clusterFromRpc(url) {
  if (url.includes("devnet")) {
    return "devnet";
  }
  if (url.includes("testnet")) {
    return "testnet";
  }
  return "mainnet";
}

function decodeVaultState(data) {
  // Skip 8-byte Anchor discriminator.
  let offset = 8;
  const readPubkey = () => {
    const key = new PublicKey(data.subarray(offset, offset + 32));
    offset += 32;
    return key;
  };

  const authority = readPubkey();
  const rebalanceBot = readPubkey();
  const usdcMint = readPubkey();
  const usdcVault = readPubkey();
  const shareMint = readPubkey();
  const driftProgram = readPubkey();
  const jupiterProgram = readPubkey();
  const pythPriceFeed = readPubkey();
  const totalUsdc = data.readBigUInt64LE(offset);
  offset += 8;
  const totalShares = data.readBigUInt64LE(offset);
  offset += 8;
  const lockPeriodSecs = data.readBigInt64LE(offset);
  offset += 8;
  const lastRebalanceTs = data.readBigInt64LE(offset);
  offset += 8;
  const performanceFeeBps = data.readUInt16LE(offset);
  offset += 2;
  const paused = data.readUInt8(offset) === 1;
  offset += 1;
  const emergencyMode = data.readUInt8(offset) === 1;
  offset += 1;
  const bumpState = data.readUInt8(offset);
  offset += 1;
  const bumpAuthority = data.readUInt8(offset);

  return {
    authority,
    rebalanceBot,
    usdcMint,
    usdcVault,
    shareMint,
    driftProgram,
    jupiterProgram,
    pythPriceFeed,
    totalUsdc,
    totalShares,
    lockPeriodSecs,
    lastRebalanceTs,
    performanceFeeBps,
    paused,
    emergencyMode,
    bumpState,
    bumpAuthority,
  };
}

async function fetchVaultState(connection, vaultState) {
  const account = await connection.getAccountInfo(vaultState, "confirmed");
  if (!account) {
    return null;
  }
  return decodeVaultState(account.data);
}

function encodeInitializeArgs(args) {
  const payload = Buffer.alloc(32 * 4 + 8 + 2);
  let offset = 0;
  args.rebalanceBot.toBuffer().copy(payload, offset);
  offset += 32;
  args.driftProgram.toBuffer().copy(payload, offset);
  offset += 32;
  args.jupiterProgram.toBuffer().copy(payload, offset);
  offset += 32;
  args.pythPriceFeed.toBuffer().copy(payload, offset);
  offset += 32;
  payload.writeBigInt64LE(BigInt(args.lockPeriodSecs), offset);
  offset += 8;
  payload.writeUInt16LE(args.performanceFeeBps, offset);
  return Buffer.concat([discriminator("initialize_vault"), payload]);
}

function encodeU64Ix(ixName, amount) {
  const payload = Buffer.alloc(8);
  payload.writeBigUInt64LE(BigInt(amount));
  return Buffer.concat([discriminator(ixName), payload]);
}

async function maybeCreateAtaIx(connection, payer, owner, mint, allowOwnerOffCurve = false) {
  const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    allowOwnerOffCurve,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const account = await connection.getAccountInfo(ata, "confirmed");
  if (account) {
    return { ata, ix: null };
  }
  const ix = createAssociatedTokenAccountInstruction(
    payer,
    ata,
    owner,
    mint,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return { ata, ix };
}

async function sendAndConfirm(connection, payer, instructions, label, extraSigners = []) {
  const latest = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({
    feePayer: payer.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  });
  tx.add(...instructions);
  tx.sign(payer, ...extraSigners);
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: "confirmed",
    maxRetries: 3,
  });
  await connection.confirmTransaction(
    {
      signature: sig,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed",
  );
  info(`${label} confirmed: ${sig}`);
  info(`Explorer: https://explorer.solana.com/tx/${sig}?cluster=${clusterFromRpc(config.rpcUrl)}`);
}

async function runAccounts() {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const programId = requirePubkey("NEUTRALALPHA_VAULT_PROGRAM_ID", config.programId);
  const usdcMint = requirePubkey("USDC_MINT", config.usdcMint);
  const payer = loadKeypair();
  const pdas = deriveVaultPdas(programId, usdcMint, payer.publicKey);
  const expectedUsdcVaultAta = getAssociatedTokenAddressSync(
    usdcMint,
    pdas.vaultAuthority,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const vaultState = await fetchVaultState(connection, pdas.vaultState);

  info(`payer: ${payer.publicKey.toBase58()}`);
  info(`vault_state: ${pdas.vaultState.toBase58()}`);
  info(`vault_authority: ${pdas.vaultAuthority.toBase58()}`);
  info(`user_position: ${pdas.userPosition.toBase58()}`);

  if (!vaultState) {
    info(`vault_state_status: not_initialized`);
    info(`expected_usdc_vault_ata: ${expectedUsdcVaultAta.toBase58()}`);
    return;
  }

  info(`vault_state_status: initialized`);
  info(`usdc_vault: ${vaultState.usdcVault.toBase58()}`);
  info(`share_mint: ${vaultState.shareMint.toBase58()}`);
  info(`total_usdc: ${vaultState.totalUsdc.toString()}`);
  info(`total_shares: ${vaultState.totalShares.toString()}`);
}

async function runInitialize() {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const payer = loadKeypair();
  const programId = requirePubkey("NEUTRALALPHA_VAULT_PROGRAM_ID", config.programId);
  const usdcMint = requirePubkey("USDC_MINT", config.usdcMint);
  const driftProgram = requirePubkey("DRIFT_PROGRAM_ID", config.driftProgramId);
  const jupiterProgram = requirePubkey("JUPITER_PROGRAM_ID", config.jupiterProgramId);
  const pythPriceFeed = requirePubkey("PYTH_PRICE_FEED", config.pythPriceFeed);
  const rebalanceBot = new PublicKey(config.rebalanceBot || payer.publicKey);

  const pdas = deriveVaultPdas(programId, usdcMint, payer.publicKey);
  const { ata: usdcVaultAta, ix: createUsdcVaultAtaIx } = await maybeCreateAtaIx(
    connection,
    payer.publicKey,
    pdas.vaultAuthority,
    usdcMint,
    true,
  );
  const shareMint = Keypair.generate();
  const mintRent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE, "confirmed");
  const createShareMintIx = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: shareMint.publicKey,
    lamports: mintRent,
    space: MINT_SIZE,
    programId: TOKEN_PROGRAM_ID,
  });
  const initShareMintIx = createInitializeMintInstruction(
    shareMint.publicKey,
    6,
    pdas.vaultAuthority,
    null,
    TOKEN_PROGRAM_ID,
  );
  const data = encodeInitializeArgs({
    rebalanceBot,
    driftProgram,
    jupiterProgram,
    pythPriceFeed,
    lockPeriodSecs: config.lockPeriodSecs,
    performanceFeeBps: config.performanceFeeBps,
  });

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: usdcMint, isSigner: false, isWritable: false },
      { pubkey: pdas.vaultState, isSigner: false, isWritable: true },
      { pubkey: pdas.vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: usdcVaultAta, isSigner: false, isWritable: true },
      { pubkey: shareMint.publicKey, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  const ixs = [];
  if (createUsdcVaultAtaIx) {
    ixs.push(createUsdcVaultAtaIx);
  }
  ixs.push(createShareMintIx, initShareMintIx, ix);
  await sendAndConfirm(connection, payer, ixs, "initialize_vault", [shareMint]);
  info(`initialized_share_mint: ${shareMint.publicKey.toBase58()}`);
  info(`initialized_usdc_vault: ${usdcVaultAta.toBase58()}`);
}

async function runDeposit() {
  const amount = parseArg("amount");
  if (!amount) {
    throw new Error("--amount is required for deposit");
  }
  const amountU64 = BigInt(amount);

  const connection = new Connection(config.rpcUrl, "confirmed");
  const payer = loadKeypair();
  const programId = requirePubkey("NEUTRALALPHA_VAULT_PROGRAM_ID", config.programId);
  const usdcMint = requirePubkey("USDC_MINT", config.usdcMint);
  const pdas = deriveVaultPdas(programId, usdcMint, payer.publicKey);
  const vaultState = await fetchVaultState(connection, pdas.vaultState);
  if (!vaultState) {
    throw new Error(`vault_state is not initialized: ${pdas.vaultState.toBase58()}`);
  }
  const { ata: depositorUsdcAta } = await maybeCreateAtaIx(
    connection,
    payer.publicKey,
    payer.publicKey,
    usdcMint,
  );
  const { ata: depositorShareAta, ix: createShareAtaIx } = await maybeCreateAtaIx(
    connection,
    payer.publicKey,
    payer.publicKey,
    vaultState.shareMint,
  );

  const depositIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: pdas.vaultState, isSigner: false, isWritable: true },
      { pubkey: pdas.vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: depositorUsdcAta, isSigner: false, isWritable: true },
      { pubkey: vaultState.usdcVault, isSigner: false, isWritable: true },
      { pubkey: vaultState.shareMint, isSigner: false, isWritable: true },
      { pubkey: depositorShareAta, isSigner: false, isWritable: true },
      { pubkey: pdas.userPosition, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeU64Ix("deposit", amountU64),
  });

  const ixs = [];
  if (createShareAtaIx) {
    ixs.push(createShareAtaIx);
  }
  ixs.push(depositIx);

  await sendAndConfirm(connection, payer, ixs, "deposit");
}

async function runWithdraw() {
  const shares = parseArg("shares");
  if (!shares) {
    throw new Error("--shares is required for withdraw");
  }
  const shareAmount = BigInt(shares);

  const connection = new Connection(config.rpcUrl, "confirmed");
  const payer = loadKeypair();
  const programId = requirePubkey("NEUTRALALPHA_VAULT_PROGRAM_ID", config.programId);
  const usdcMint = requirePubkey("USDC_MINT", config.usdcMint);
  const pdas = deriveVaultPdas(programId, usdcMint, payer.publicKey);
  const vaultState = await fetchVaultState(connection, pdas.vaultState);
  if (!vaultState) {
    throw new Error(`vault_state is not initialized: ${pdas.vaultState.toBase58()}`);
  }

  const { ata: depositorUsdcAta } = await maybeCreateAtaIx(
    connection,
    payer.publicKey,
    payer.publicKey,
    usdcMint,
  );
  const { ata: depositorShareAta } = await maybeCreateAtaIx(
    connection,
    payer.publicKey,
    payer.publicKey,
    vaultState.shareMint,
  );

  const withdrawIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: pdas.vaultState, isSigner: false, isWritable: true },
      { pubkey: pdas.vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: depositorUsdcAta, isSigner: false, isWritable: true },
      { pubkey: vaultState.usdcVault, isSigner: false, isWritable: true },
      { pubkey: vaultState.shareMint, isSigner: false, isWritable: true },
      { pubkey: depositorShareAta, isSigner: false, isWritable: true },
      { pubkey: pdas.userPosition, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: encodeU64Ix("withdraw", shareAmount),
  });

  await sendAndConfirm(connection, payer, [withdrawIx], "withdraw");
}

async function main() {
  const command = process.argv[2];
  if (!command) {
    usage();
    process.exit(1);
  }

  info(`rpc: ${config.rpcUrl}`);

  if (command === "accounts") {
    await runAccounts();
    return;
  }
  if (command === "init") {
    await runInitialize();
    return;
  }
  if (command === "deposit") {
    await runDeposit();
    return;
  }
  if (command === "withdraw") {
    await runWithdraw();
    return;
  }

  usage();
  process.exit(1);
}

main().catch((error) => {
  console.error(`[vault-client] failed: ${error.message}`);
  process.exit(1);
});
