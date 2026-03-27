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
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@/services/splTokenLite";
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
  signAndSendTransaction?: (
    transaction: Transaction,
    options?: {
      skipPreflight?: boolean;
      preflightCommitment?: Commitment;
      maxRetries?: number;
    },
  ) => Promise<{ signature: string } | string>;
  signTransaction?: (transaction: Transaction) => Promise<Transaction>;
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
const TEXT_ENCODER = new TextEncoder();
const SYSTEM_PROGRAM_ADDRESS = "11111111111111111111111111111111";
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

function formatTokenAmount(amountBaseUnits: bigint) {
  return fromBaseUnits(amountBaseUnits).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: TOKEN_DECIMALS,
  });
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
    [TEXT_ENCODER.encode("vault"), usdcMint.toBuffer()],
    programId,
  );
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [TEXT_ENCODER.encode("vault_authority"), vaultState.toBuffer()],
    programId,
  );
  const [userPosition] = PublicKey.findProgramAddressSync(
    [TEXT_ENCODER.encode("position"), vaultState.toBuffer(), owner.toBuffer()],
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

function encodeAmountInstruction(discriminator: Uint8Array, amount: bigint): Buffer {
  const payload = new Uint8Array(16);
  payload.set(discriminator, 0);
  const view = new DataView(payload.buffer);
  view.setBigUint64(8, amount, true);
  return payload as unknown as Buffer;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }
  if (error && typeof error === "object") {
    const asRecord = error as Record<string, unknown>;
    const directMessage = asRecord.message;
    if (typeof directMessage === "string" && directMessage.trim().length > 0) {
      return directMessage.trim();
    }
    const nestedError = asRecord.error;
    if (nestedError) {
      const nested = extractErrorMessage(nestedError);
      if (nested !== "Unexpected error") {
        return nested;
      }
    }
    const reason = asRecord.reason;
    if (typeof reason === "string" && reason.trim().length > 0) {
      return reason.trim();
    }
    const details = asRecord.details;
    if (typeof details === "string" && details.trim().length > 0) {
      return details.trim();
    }
    const code = asRecord.code;
    if (typeof code === "number" || typeof code === "string") {
      return `Wallet error code: ${String(code)}`;
    }
    const logs = asRecord.logs;
    if (Array.isArray(logs)) {
      const firstLog = logs.find((item) => typeof item === "string" && item.trim().length > 0);
      if (typeof firstLog === "string") {
        return firstLog.trim();
      }
    }
    try {
      const compact = JSON.stringify(asRecord);
      if (compact && compact !== "{}") {
        return compact.length > 240 ? `${compact.slice(0, 240)}...` : compact;
      }
    } catch {
      // Ignore JSON stringify failures and return fallback below.
    }
  }
  return "Unexpected error";
}

async function getTokenBalanceBaseUnits(connection: Connection, tokenAccount: PublicKey): Promise<bigint> {
  const info = await connection.getAccountInfo(tokenAccount, COMMITMENT);
  if (!info) {
    return 0n;
  }
  try {
    const balance = await connection.getTokenAccountBalance(tokenAccount, COMMITMENT);
    return BigInt(balance.value.amount);
  } catch {
    return 0n;
  }
}

interface OwnerTokenBalanceAccount {
  address: PublicKey;
  amountBaseUnits: bigint;
}

async function findOwnerTokenAccountWithLargestBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
): Promise<OwnerTokenBalanceAccount | null> {
  try {
    const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint }, COMMITMENT);
    let best: OwnerTokenBalanceAccount | null = null;
    for (const entry of accounts.value) {
      const parsed = entry.account.data.parsed;
      const amountRaw = parsed?.info?.tokenAmount?.amount;
      if (typeof amountRaw !== "string") {
        continue;
      }
      const amountBaseUnits = BigInt(amountRaw);
      if (!best || amountBaseUnits > best.amountBaseUnits) {
        best = {
          address: entry.pubkey,
          amountBaseUnits,
        };
      }
    }
    return best;
  } catch {
    return null;
  }
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

const RETRYABLE_TX_ERRORS = [
  "ProgramAccountNotFound",
  "AccountNotFound",
  "Connection rate limits exceeded",
  "Too many requests",
  "\"code\":429",
  "\"code\":-429",
  "rate limit",
];
const MAX_TX_RETRIES = 4;
const RETRY_DELAY_MS = 1500;
const WALLET_ACTIVITY_SCAN_LIMIT = 120;
const WALLET_ACTIVITY_PAGE_LIMIT = 50;
const ACTIVITY_RPC_RETRIES = 3;
const ACTIVITY_RETRY_DELAY_MS = 500;

function isRetryableError(err: unknown): boolean {
  const errStr = (typeof err === "string" ? err : JSON.stringify(err)).toLowerCase();
  return RETRYABLE_TX_ERRORS.some((code) => errStr.includes(code.toLowerCase()));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSignaturesForAddressWithRetry(
  connection: Connection,
  address: PublicKey,
  options: { limit?: number; before?: string },
  commitment: Finality,
) {
  for (let attempt = 1; attempt <= ACTIVITY_RPC_RETRIES; attempt += 1) {
    try {
      return await connection.getSignaturesForAddress(address, options, commitment);
    } catch (error) {
      const message = extractErrorMessage(error);
      if (isRetryableError(message) && attempt < ACTIVITY_RPC_RETRIES) {
        await sleep(ACTIVITY_RETRY_DELAY_MS * attempt);
        continue;
      }
      throw new Error(message);
    }
  }
  return [];
}

async function getTransactionWithRetry(connection: Connection, signature: string) {
  for (let attempt = 1; attempt <= ACTIVITY_RPC_RETRIES; attempt += 1) {
    try {
      return await connection.getTransaction(signature, {
        commitment: FINALITY,
        maxSupportedTransactionVersion: 0,
      });
    } catch (error) {
      const message = extractErrorMessage(error);
      if (isRetryableError(message) && attempt < ACTIVITY_RPC_RETRIES) {
        await sleep(ACTIVITY_RETRY_DELAY_MS * attempt);
        continue;
      }
      throw new Error(message);
    }
  }
  return null;
}

async function collectWalletSignatures(
  connection: Connection,
  wallet: PublicKey,
  maxCount: number,
) {
  const rows: Array<{ signature: string; blockTime: number | null }> = [];
  let before: string | undefined;

  while (rows.length < maxCount) {
    const page = await getSignaturesForAddressWithRetry(
      connection,
      wallet,
      {
        limit: Math.min(WALLET_ACTIVITY_PAGE_LIMIT, maxCount - rows.length),
        ...(before ? { before } : {}),
      },
      FINALITY,
    );
    if (page.length === 0) {
      break;
    }

    rows.push(...page.map((item) => ({ signature: item.signature, blockTime: item.blockTime ?? null })));
    before = page[page.length - 1]?.signature;

    if (page.length < WALLET_ACTIVITY_PAGE_LIMIT) {
      break;
    }
  }

  return rows;
}

async function sendTransaction(wallet: WalletSigner, tx: Transaction) {
  const { connection } = ensureConfig();

  for (let attempt = 1; attempt <= MAX_TX_RETRIES; attempt++) {
    try {
      // Get a fresh blockhash for each attempt.
      const latest = await connection.getLatestBlockhash(COMMITMENT);
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = latest.blockhash;
      // Clear any previous signatures so re-signing works cleanly.
      tx.signatures = [];

      let signature: string | null = null;

      // Prefer signTransaction + sendRawTransaction via our own RPC.
      // signAndSendTransaction sends through Phantom's internal RPC which may
      // not have devnet programs cached, causing "program does not exist" errors.
      if (typeof wallet.signTransaction === "function") {
        try {
          const signedTx = await wallet.signTransaction(tx);
          signature = await connection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: true,
            preflightCommitment: COMMITMENT,
            maxRetries: 3,
          });
        } catch (error) {
          throw new Error(extractErrorMessage(error));
        }
      } else if (typeof wallet.signAndSendTransaction === "function") {
        try {
          const signed = await wallet.signAndSendTransaction(tx, {
            skipPreflight: true,
            preflightCommitment: COMMITMENT,
            maxRetries: 3,
          });
          signature = typeof signed === "string" ? signed : signed.signature;
        } catch (error) {
          throw new Error(extractErrorMessage(error));
        }
      } else {
        throw new Error("Wallet provider does not support transaction signing.");
      }

      if (!signature) {
        throw new Error("Failed to obtain transaction signature.");
      }

      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash: latest.blockhash,
          lastValidBlockHeight: latest.lastValidBlockHeight,
        },
        COMMITMENT,
      );

      if (confirmation.value.err) {
        throw new Error(`On-chain transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      return signature;
    } catch (error) {
      const message = extractErrorMessage(error);
      if (isRetryableError(message) && attempt < MAX_TX_RETRIES) {
        const waitMs = RETRY_DELAY_MS * attempt;
        console.warn(
          `[vault] Attempt ${attempt}/${MAX_TX_RETRIES} failed with retryable error: ${message}. Retrying in ${waitMs}ms...`,
        );
        await sleep(waitMs);
        continue;
      }
      throw new Error(message);
    }
  }

  throw new Error("Transaction failed after maximum retries.");
}

function extractWalletSigner(input: unknown): WalletSigner {
  const provider = input as Partial<WalletSigner> | null;
  const supportsSignAndSend = provider && typeof provider.signAndSendTransaction === "function";
  const supportsSignOnly = provider && typeof provider.signTransaction === "function";
  if (!provider || !provider.publicKey || (!supportsSignAndSend && !supportsSignOnly)) {
    throw new Error("Wallet provider does not support transaction signing.");
  }
  return provider as WalletSigner;
}

function decodeAmountFromInstructionData(dataBase58: string) {
  const decoded = bs58.decode(dataBase58);
  if (decoded.length < 8) {
    return null;
  }
  const discriminator = decoded.subarray(0, 8);
  if (isSameBytes(discriminator, IX_DEPOSIT)) {
    if (decoded.length < 16) return null;
    return { action: "DEPOSIT" as const, amountBaseUnits: readU64LE(decoded, 8) };
  }
  if (isSameBytes(discriminator, IX_WITHDRAW)) {
    if (decoded.length < 16) return null;
    return { action: "WITHDRAW" as const, amountBaseUnits: readU64LE(decoded, 8) };
  }
  if (isSameBytes(discriminator, IX_DRIFT_HEDGE) || isSameBytes(discriminator, IX_JUPITER_SWAP)) {
    return { action: "REBALANCE" as const, amountBaseUnits: 0n };
  }
  return null;
}

function decodeActionFromLogs(logs: string[] | null | undefined): ActivityAction | null {
  if (!logs || logs.length === 0) {
    return null;
  }
  const joined = logs.join(" ").toLowerCase();
  if (joined.includes("instruction: deposit")) {
    return "DEPOSIT";
  }
  if (joined.includes("instruction: withdraw")) {
    return "WITHDRAW";
  }
  if (joined.includes("instruction: drift_hedge") || joined.includes("instruction: jupiter_swap")) {
    return "REBALANCE";
  }
  return null;
}

function deriveAmountFromTokenBalances(
  tx: {
    meta?: {
      preTokenBalances?: Array<{
        owner?: string;
        mint?: string;
        uiTokenAmount?: { amount?: string };
      }>;
      postTokenBalances?: Array<{
        owner?: string;
        mint?: string;
        uiTokenAmount?: { amount?: string };
      }>;
    };
  },
  wallet: string,
): number {
  const { usdcMint } = ensureConfig();
  const mint = usdcMint.toBase58();
  const pre = tx.meta?.preTokenBalances ?? [];
  const post = tx.meta?.postTokenBalances ?? [];

  const sumFor = (
    rows: Array<{ owner?: string; mint?: string; uiTokenAmount?: { amount?: string } }>,
  ) => rows
    .filter((row) => row.owner === wallet && row.mint === mint)
    .reduce((acc, row) => {
      const amountRaw = row.uiTokenAmount?.amount ?? "0";
      const amount = Number(amountRaw);
      if (!Number.isFinite(amount)) {
        return acc;
      }
      return acc + amount;
    }, 0);

  const preTotal = sumFor(pre);
  const postTotal = sumFor(post);
  const diffBaseUnits = postTotal - preTotal;
  return Math.abs(diffBaseUnits) / 10 ** TOKEN_DECIMALS;
}

function isSameBytes(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) {
    return false;
  }
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
}

function getInstructionBundle(tx: {
  meta?: {
    loadedAddresses?: {
      writable?: Array<{ toBase58(): string } | string>;
      readonly?: Array<{ toBase58(): string } | string>;
    };
  };
  transaction: {
    message: {
      accountKeys?: Array<{ toBase58(): string } | string>;
      staticAccountKeys?: Array<{ toBase58(): string } | string>;
      instructions?: Array<{ programIdIndex: number; accounts: number[]; data: string }>;
      compiledInstructions?: Array<{ programIdIndex: number; accounts: number[]; data: string }>;
    };
  };
}) {
  const message = tx.transaction.message;
  const staticAccountKeysRaw = message.staticAccountKeys ?? message.accountKeys ?? [];
  const loadedWritableRaw = tx.meta?.loadedAddresses?.writable ?? [];
  const loadedReadonlyRaw = tx.meta?.loadedAddresses?.readonly ?? [];
  const allAccountKeysRaw = [...staticAccountKeysRaw, ...loadedWritableRaw, ...loadedReadonlyRaw];
  const accountKeys = allAccountKeysRaw.map((key) =>
    typeof key === "string" ? key : key.toBase58(),
  );
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
  const owner = walletAddress
    ? new PublicKey(walletAddress)
    : new PublicKey(SYSTEM_PROGRAM_ADDRESS);
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

  const ownerUsdcAccount = await findOwnerTokenAccountWithLargestBalance(connection, owner, usdcMint);
  const depositSourceUsdcAccount =
    ownerUsdcAccount && ownerUsdcAccount.amountBaseUnits > 0n ? ownerUsdcAccount.address : depositorUsdcAta;
  const availableUsdcBaseUnits = ownerUsdcAccount?.amountBaseUnits ?? 0n;
  if (availableUsdcBaseUnits < amountBaseUnits) {
    throw new Error(
      `Insufficient devnet USDC. Required ${formatTokenAmount(amountBaseUnits)} USDC, available ${formatTokenAmount(availableUsdcBaseUnits)} USDC.`,
    );
  }

  const depositIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: derived.vaultState, isSigner: false, isWritable: true },
      { pubkey: derived.vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: depositSourceUsdcAccount, isSigner: false, isWritable: true },
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
  if (createUsdcAtaIx && depositSourceUsdcAccount.equals(depositorUsdcAta)) {
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
  const availableShareBaseUnits = await getTokenBalanceBaseUnits(connection, depositorShareAta);
  if (availableShareBaseUnits < sharesToBurn) {
    throw new Error(
      `Insufficient share balance in token account. Required ${formatTokenAmount(sharesToBurn)} shares, available ${formatTokenAmount(availableShareBaseUnits)} shares.`,
    );
  }

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
  const signatureScanLimit = walletFilter
    ? Math.min(WALLET_ACTIVITY_SCAN_LIMIT, Math.max(limit * 5, 60))
    : Math.min(WALLET_ACTIVITY_SCAN_LIMIT, Math.max(limit * 3, 30));
  const signatures = walletFilter
    ? await collectWalletSignatures(
      connection,
      new PublicKey(walletFilter),
      signatureScanLimit,
    )
    : await getSignaturesForAddressWithRetry(connection, programId, { limit: signatureScanLimit }, FINALITY);

  const transactions: VaultActivityItem[] = [];
  for (const { signature, blockTime } of signatures) {
    if (transactions.length >= limit) {
      break;
    }
    try {
      const tx = await getTransactionWithRetry(connection, signature);
      if (!tx) {
        continue;
      }

      const { accountKeys, instructions } = getInstructionBundle(tx as never);
      const programPresent = accountKeys.includes(programId.toBase58());
      if (!programPresent) {
        continue;
      }

      const programIx = instructions.find((ix) => accountKeys[ix.programIdIndex] === programId.toBase58());

      const decoded = programIx ? decodeAmountFromInstructionData(programIx.data) : null;
      const actionFromLogs = decodeActionFromLogs(tx.meta?.logMessages as string[] | undefined);
      const action = decoded?.action ?? actionFromLogs;
      if (!action) {
        continue;
      }

      let wallet = "unknown";
      if (decoded && programIx) {
        const ownerAccountPosition = decoded.action === "REBALANCE" ? 2 : 7;
        const depositorKeyIndex = programIx.accounts[ownerAccountPosition];
        wallet = typeof depositorKeyIndex === "number" ? accountKeys[depositorKeyIndex] ?? "unknown" : "unknown";
      } else if (walletFilter) {
        wallet = walletFilter;
      }

      if (walletFilter && wallet !== walletFilter) {
        continue;
      }

      let amountUsd = 0;
      if (wallet !== "unknown" && (action === "DEPOSIT" || action === "WITHDRAW")) {
        amountUsd = deriveAmountFromTokenBalances(tx as never, wallet);
      }
      if (amountUsd <= 0 && decoded?.action === "DEPOSIT") {
        // Deposit instruction argument is USDC base units, so this fallback is safe.
        amountUsd = fromBaseUnits(decoded.amountBaseUnits);
      }

      transactions.push({
        id: signature,
        action,
        amountUsd,
        wallet,
        at: new Date((blockTime ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        signature,
        explorerUrl: buildSolscanTxUrl(signature),
        source: "onchain" as const,
      });
    } catch {
      // Skip malformed or temporarily unavailable signatures.
    }
  }

  return transactions;
}
