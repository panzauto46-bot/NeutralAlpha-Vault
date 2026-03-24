import type { Idl } from "@coral-xyz/anchor";
import bs58 from "bs58";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type Commitment,
  type Finality,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import idlJson from "@/idl/neutralalpha_vault.json";
import {
  SOLANA_RPC_URL,
  USDC_MINT,
  VAULT_PROGRAM_ID,
  buildSolscanTxUrl,
} from "@/config/network";
import type { VaultActivityItem } from "@/types/dashboard";

type ActivityAction = "DEPOSIT" | "WITHDRAW" | "REBALANCE";

interface WalletSigner {
  publicKey: PublicKey;
  signAndSendTransaction: (
    transaction: Transaction,
    options?: {
      skipPreflight?: boolean;
      preflightCommitment?: Commitment;
      maxRetries?: number;
    },
  ) => Promise<{ signature: string } | string>;
}

interface RuntimeConfig {
  connection: Connection;
  programId: PublicKey;
  usdcMint: PublicKey;
}

interface VaultAccounts {
  vaultState: PublicKey;
  vaultAuthority: PublicKey;
  userPosition: PublicKey;
}

interface DecodedVaultState {
  authority: PublicKey;
  rebalanceBot: PublicKey;
  usdcMint: PublicKey;
  usdcVault: PublicKey;
  shareMint: PublicKey;
  totalUsdc: bigint;
  totalShares: bigint;
  lockPeriodSecs: bigint;
  lastRebalanceTs: bigint;
  performanceFeeBps: number;
  paused: boolean;
  emergencyMode: boolean;
  bumpState: number;
  bumpAuthority: number;
}

interface DecodedUserPosition {
  owner: PublicKey;
  shares: bigint;
  unlockTs: bigint;
  lastDepositTs: bigint;
  bump: number;
}

export interface OnChainSnapshot {
  fetchedAt: string;
  vaultStateAddress: string;
  vaultAuthorityAddress: string;
  usdcVaultAddress: string;
  shareMintAddress: string;
  totalUsdcBaseUnits: bigint;
  totalSharesBaseUnits: bigint;
  totalUsdc: number;
  totalShares: number;
  sharePrice: number;
  lockPeriodSecs: number;
  paused: boolean;
  emergencyMode: boolean;
  userPositionAddress: string | null;
  userSharesBaseUnits: bigint;
  userShares: number;
  userUnlockTs: number | null;
  userLastDepositTs: number | null;
}

export interface SentVaultTx {
  signature: string;
  explorerUrl: string;
}

const TOKEN_DECIMALS = 6;
const COMMITMENT: Commitment = "confirmed";
const FINALITY: Finality = "confirmed";
const IX_DEPOSIT = Uint8Array.from([242, 35, 198, 137, 82, 225, 242, 182]);
const IX_WITHDRAW = Uint8Array.from([183, 18, 70, 156, 148, 109, 161, 34]);
const IX_DRIFT_HEDGE = Uint8Array.from([174, 177, 138, 131, 214, 115, 86, 234]);
const IX_JUPITER_SWAP = Uint8Array.from([0, 153, 94, 101, 168, 72, 220, 247]);

let cachedConnection: Connection | null = null;

export const VAULT_IDL: Idl = idlJson as unknown as Idl;

export function isOnChainConfigured() {
  return Boolean(VAULT_PROGRAM_ID && USDC_MINT);
}

function toBaseUnits(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive number.");
  }
  return BigInt(Math.round(amount * 10 ** TOKEN_DECIMALS));
}

function fromBaseUnits(amount: bigint) {
  return Number(amount) / 10 ** TOKEN_DECIMALS;
}

function readU64LE(bytes: Uint8Array, offset: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigUint64(offset, true);
}

function readI64LE(bytes: Uint8Array, offset: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getBigInt64(offset, true);
}

function readU16LE(bytes: Uint8Array, offset: number) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint16(offset, true);
}

function readU8(bytes: Uint8Array, offset: number) {
  return bytes[offset] ?? 0;
}

function readPubkey(bytes: Uint8Array, offset: number) {
  return new PublicKey(bytes.slice(offset, offset + 32));
}

function ensureConfig(): RuntimeConfig {
  if (!VAULT_PROGRAM_ID) {
    throw new Error("Missing VITE_VAULT_PROGRAM_ID.");
  }
  if (!USDC_MINT) {
    throw new Error("Missing VITE_USDC_MINT.");
  }
  if (!cachedConnection) {
    cachedConnection = new Connection(SOLANA_RPC_URL, COMMITMENT);
  }
  return {
    connection: cachedConnection,
    programId: new PublicKey(VAULT_PROGRAM_ID),
    usdcMint: new PublicKey(USDC_MINT),
  };
}

function deriveVaultAccounts(programId: PublicKey, usdcMint: PublicKey, owner: PublicKey): VaultAccounts {
  const [vaultState] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), usdcMint.toBuffer()],
    programId,
  );
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_authority"), vaultState.toBuffer()],
    programId,
  );
  const [userPosition] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), vaultState.toBuffer(), owner.toBuffer()],
    programId,
  );
  return { vaultState, vaultAuthority, userPosition };
}

function decodeVaultState(data: Uint8Array): DecodedVaultState {
  if (data.length < 8 + 358) {
    throw new Error("Vault state account has invalid size.");
  }

  let offset = 8;
  const authority = readPubkey(data, offset);
  offset += 32;
  const rebalanceBot = readPubkey(data, offset);
  offset += 32;
  const usdcMint = readPubkey(data, offset);
  offset += 32;
  const usdcVault = readPubkey(data, offset);
  offset += 32;
  const shareMint = readPubkey(data, offset);
  offset += 32;

  // Skip drift_program + jupiter_program + pyth_price_feed.
  offset += 32 * 3;

  const totalUsdc = readU64LE(data, offset);
  offset += 8;
  const totalShares = readU64LE(data, offset);
  offset += 8;
  const lockPeriodSecs = readI64LE(data, offset);
  offset += 8;
  const lastRebalanceTs = readI64LE(data, offset);
  offset += 8;
  const performanceFeeBps = readU16LE(data, offset);
  offset += 2;
  const paused = readU8(data, offset) === 1;
  offset += 1;
  const emergencyMode = readU8(data, offset) === 1;
  offset += 1;
  const bumpState = readU8(data, offset);
  offset += 1;
  const bumpAuthority = readU8(data, offset);

  return {
    authority,
    rebalanceBot,
    usdcMint,
    usdcVault,
    shareMint,
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

function decodeUserPosition(data: Uint8Array): DecodedUserPosition {
  if (data.length < 8 + 88) {
    throw new Error("User position account has invalid size.");
  }
  let offset = 8;
  const owner = readPubkey(data, offset);
  offset += 32;
  const shares = readU64LE(data, offset);
  offset += 8;
  const unlockTs = readI64LE(data, offset);
  offset += 8;
  const lastDepositTs = readI64LE(data, offset);
  offset += 8;
  const bump = readU8(data, offset);
  return {
    owner,
    shares,
    unlockTs,
    lastDepositTs,
    bump,
  };
}

function encodeAmountInstruction(discriminator: Uint8Array, amount: bigint) {
  const payload = Buffer.alloc(16);
  Buffer.from(discriminator).copy(payload, 0);
  payload.writeBigUInt64LE(amount, 8);
  return payload;
}

async function createAtaIxIfMissing(
  connection: Connection,
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  allowOwnerOffCurve = false,
) {
  const ata = getAssociatedTokenAddressSync(
    mint,
    owner,
    allowOwnerOffCurve,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const account = await connection.getAccountInfo(ata, COMMITMENT);
  if (account) {
    return { ata, ix: null as TransactionInstruction | null };
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

async function sendTransaction(wallet: WalletSigner, tx: Transaction) {
  const { connection } = ensureConfig();
  const latest = await connection.getLatestBlockhash(COMMITMENT);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = latest.blockhash;

  const signed = await wallet.signAndSendTransaction(tx, {
    preflightCommitment: COMMITMENT,
    maxRetries: 3,
  });
  const signature = typeof signed === "string" ? signed : signed.signature;
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    COMMITMENT,
  );
  return signature;
}

function extractWalletSigner(input: unknown): WalletSigner {
  const provider = input as Partial<WalletSigner> | null;
  if (!provider || !provider.publicKey || typeof provider.signAndSendTransaction !== "function") {
    throw new Error("Wallet provider does not support signAndSendTransaction.");
  }
  return provider as WalletSigner;
}

function decodeAmountFromInstructionData(dataBase58: string) {
  const decoded = bs58.decode(dataBase58);
  if (decoded.length < 8) {
    return null;
  }
  const discriminator = decoded.subarray(0, 8);
  if (Buffer.from(discriminator).equals(Buffer.from(IX_DEPOSIT))) {
    if (decoded.length < 16) return null;
    return { action: "DEPOSIT" as const, amountBaseUnits: readU64LE(decoded, 8) };
  }
  if (Buffer.from(discriminator).equals(Buffer.from(IX_WITHDRAW))) {
    if (decoded.length < 16) return null;
    return { action: "WITHDRAW" as const, amountBaseUnits: readU64LE(decoded, 8) };
  }
  if (
    Buffer.from(discriminator).equals(Buffer.from(IX_DRIFT_HEDGE)) ||
    Buffer.from(discriminator).equals(Buffer.from(IX_JUPITER_SWAP))
  ) {
    return { action: "REBALANCE" as const, amountBaseUnits: 0n };
  }
  return null;
}

function getInstructionBundle(tx: {
  transaction: {
    message: {
      accountKeys?: Array<{ toBase58(): string }>;
      staticAccountKeys?: Array<{ toBase58(): string }>;
      instructions?: Array<{ programIdIndex: number; accounts: number[]; data: string }>;
      compiledInstructions?: Array<{ programIdIndex: number; accounts: number[]; data: string }>;
    };
  };
}) {
  const message = tx.transaction.message;
  const accountKeysRaw = message.staticAccountKeys ?? message.accountKeys ?? [];
  const accountKeys = accountKeysRaw.map((key) => key.toBase58());
  const instructions = message.compiledInstructions ?? message.instructions ?? [];
  return { accountKeys, instructions };
}

function toSafeNumber(value: bigint) {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > max) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Number(value);
}

export function loadVaultIdl() {
  return VAULT_IDL;
}

export async function fetchOnChainSnapshot(walletAddress: string | null): Promise<OnChainSnapshot> {
  const { connection, programId, usdcMint } = ensureConfig();
  const owner = walletAddress ? new PublicKey(walletAddress) : PublicKey.default;
  const vaultAccounts = deriveVaultAccounts(programId, usdcMint, owner);

  const vaultStateInfo = await connection.getAccountInfo(vaultAccounts.vaultState, COMMITMENT);
  if (!vaultStateInfo) {
    throw new Error("Vault state account not found on-chain.");
  }
  const vaultState = decodeVaultState(vaultStateInfo.data);

  if (!vaultState.usdcMint.equals(usdcMint)) {
    throw new Error("Configured USDC mint does not match on-chain vault state.");
  }

  let userPosition: DecodedUserPosition | null = null;
  if (walletAddress) {
    const userInfo = await connection.getAccountInfo(vaultAccounts.userPosition, COMMITMENT);
    if (userInfo) {
      userPosition = decodeUserPosition(userInfo.data);
    }
  }

  const sharePrice =
    vaultState.totalShares > 0n
      ? Number(vaultState.totalUsdc) / Number(vaultState.totalShares)
      : 1;

  return {
    fetchedAt: new Date().toISOString(),
    vaultStateAddress: vaultAccounts.vaultState.toBase58(),
    vaultAuthorityAddress: vaultAccounts.vaultAuthority.toBase58(),
    usdcVaultAddress: vaultState.usdcVault.toBase58(),
    shareMintAddress: vaultState.shareMint.toBase58(),
    totalUsdcBaseUnits: vaultState.totalUsdc,
    totalSharesBaseUnits: vaultState.totalShares,
    totalUsdc: fromBaseUnits(vaultState.totalUsdc),
    totalShares: fromBaseUnits(vaultState.totalShares),
    sharePrice,
    lockPeriodSecs: toSafeNumber(vaultState.lockPeriodSecs),
    paused: vaultState.paused,
    emergencyMode: vaultState.emergencyMode,
    userPositionAddress: walletAddress ? vaultAccounts.userPosition.toBase58() : null,
    userSharesBaseUnits: userPosition?.shares ?? 0n,
    userShares: fromBaseUnits(userPosition?.shares ?? 0n),
    userUnlockTs: userPosition ? toSafeNumber(userPosition.unlockTs) : null,
    userLastDepositTs: userPosition ? toSafeNumber(userPosition.lastDepositTs) : null,
  };
}

export async function sendOnChainDeposit(
  walletInput: unknown,
  walletAddress: string,
  amountUsd: number,
): Promise<SentVaultTx> {
  const wallet = extractWalletSigner(walletInput);
  const { connection, programId, usdcMint } = ensureConfig();
  const owner = new PublicKey(walletAddress);
  const amountBaseUnits = toBaseUnits(amountUsd);

  const derived = deriveVaultAccounts(programId, usdcMint, owner);
  const vaultStateInfo = await connection.getAccountInfo(derived.vaultState, COMMITMENT);
  if (!vaultStateInfo) {
    throw new Error("Vault state account not found.");
  }
  const vaultState = decodeVaultState(vaultStateInfo.data);

  const { ata: depositorUsdcAta, ix: createUsdcAtaIx } = await createAtaIxIfMissing(
    connection,
    owner,
    owner,
    usdcMint,
    false,
  );
  const { ata: depositorShareAta, ix: createShareAtaIx } = await createAtaIxIfMissing(
    connection,
    owner,
    owner,
    vaultState.shareMint,
    false,
  );

  const depositIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: derived.vaultState, isSigner: false, isWritable: true },
      { pubkey: derived.vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: depositorUsdcAta, isSigner: false, isWritable: true },
      { pubkey: vaultState.usdcVault, isSigner: false, isWritable: true },
      { pubkey: vaultState.shareMint, isSigner: false, isWritable: true },
      { pubkey: depositorShareAta, isSigner: false, isWritable: true },
      { pubkey: derived.userPosition, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: encodeAmountInstruction(IX_DEPOSIT, amountBaseUnits),
  });

  const tx = new Transaction();
  if (createUsdcAtaIx) {
    tx.add(createUsdcAtaIx);
  }
  if (createShareAtaIx) {
    tx.add(createShareAtaIx);
  }
  tx.add(depositIx);

  const signature = await sendTransaction(wallet, tx);
  return {
    signature,
    explorerUrl: buildSolscanTxUrl(signature),
  };
}

export async function sendOnChainWithdraw(
  walletInput: unknown,
  walletAddress: string,
  amountUsd: number,
): Promise<SentVaultTx> {
  const wallet = extractWalletSigner(walletInput);
  const { connection, programId, usdcMint } = ensureConfig();
  const owner = new PublicKey(walletAddress);

  const derived = deriveVaultAccounts(programId, usdcMint, owner);
  const vaultStateInfo = await connection.getAccountInfo(derived.vaultState, COMMITMENT);
  if (!vaultStateInfo) {
    throw new Error("Vault state account not found.");
  }
  const vaultState = decodeVaultState(vaultStateInfo.data);
  if (vaultState.totalUsdc <= 0n || vaultState.totalShares <= 0n) {
    throw new Error("Vault has zero liquidity.");
  }

  const usdcBaseUnits = toBaseUnits(amountUsd);
  let sharesToBurn = (usdcBaseUnits * vaultState.totalShares) / vaultState.totalUsdc;
  if (sharesToBurn <= 0n) {
    sharesToBurn = 1n;
  }

  const userPositionInfo = await connection.getAccountInfo(derived.userPosition, COMMITMENT);
  if (!userPositionInfo) {
    throw new Error("User position account not found.");
  }
  const userPosition = decodeUserPosition(userPositionInfo.data);
  if (sharesToBurn > userPosition.shares) {
    throw new Error("Withdraw amount exceeds your on-chain shares.");
  }

  const depositorUsdcAta = getAssociatedTokenAddressSync(
    usdcMint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const depositorShareAta = getAssociatedTokenAddressSync(
    vaultState.shareMint,
    owner,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const withdrawIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: derived.vaultState, isSigner: false, isWritable: true },
      { pubkey: derived.vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: depositorUsdcAta, isSigner: false, isWritable: true },
      { pubkey: vaultState.usdcVault, isSigner: false, isWritable: true },
      { pubkey: vaultState.shareMint, isSigner: false, isWritable: true },
      { pubkey: depositorShareAta, isSigner: false, isWritable: true },
      { pubkey: derived.userPosition, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: encodeAmountInstruction(IX_WITHDRAW, sharesToBurn),
  });

  const tx = new Transaction().add(withdrawIx);
  const signature = await sendTransaction(wallet, tx);
  return {
    signature,
    explorerUrl: buildSolscanTxUrl(signature),
  };
}

export async function fetchOnChainActivity(limit = 20, walletFilter?: string): Promise<VaultActivityItem[]> {
  const { connection, programId } = ensureConfig();
  const signatures = await connection.getSignaturesForAddress(programId, { limit }, FINALITY);

  const transactions = await Promise.all(
    signatures.map(async ({ signature, blockTime }) => {
      const tx = await connection.getTransaction(signature, {
        commitment: FINALITY,
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) {
        return null;
      }

      const { accountKeys, instructions } = getInstructionBundle(tx as never);
      const programIx = instructions.find((ix) => accountKeys[ix.programIdIndex] === programId.toBase58());
      if (!programIx) {
        return null;
      }

      const decoded = decodeAmountFromInstructionData(programIx.data);
      if (!decoded) {
        return null;
      }

      const ownerAccountPosition = decoded.action === "REBALANCE" ? 2 : 7;
      const depositorKeyIndex = programIx.accounts[ownerAccountPosition];
      const wallet = typeof depositorKeyIndex === "number" ? accountKeys[depositorKeyIndex] ?? "unknown" : "unknown";
      if (walletFilter && wallet !== walletFilter) {
        return null;
      }

      const amountUsd = fromBaseUnits(decoded.amountBaseUnits);
      return {
        id: signature,
        action: decoded.action as ActivityAction,
        amountUsd,
        wallet,
        at: new Date((blockTime ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        signature,
        explorerUrl: buildSolscanTxUrl(signature),
        source: "onchain" as const,
      };
    }),
  );

  return transactions.filter((item): item is NonNullable<typeof item> => item !== null);
}
