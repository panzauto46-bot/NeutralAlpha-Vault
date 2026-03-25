import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiW5xWH25efTNsLJA8knL");
export const SYSVAR_RENT_PUBKEY = new PublicKey("SysvarRent111111111111111111111111111111111");
export const MINT_SIZE = 82;

function encodeInitializeMintInstructionData(decimals, mintAuthority, freezeAuthority = null) {
  const data = Buffer.alloc(1 + 1 + 32 + 4 + 32);
  data.writeUInt8(0, 0);
  data.writeUInt8(decimals, 1);
  mintAuthority.toBuffer().copy(data, 2);

  if (freezeAuthority) {
    data.writeUInt32LE(1, 34);
    freezeAuthority.toBuffer().copy(data, 38);
  } else {
    data.writeUInt32LE(0, 34);
  }

  return data;
}

export function createInitializeMintInstruction(
  mint,
  decimals,
  mintAuthority,
  freezeAuthority = null,
  tokenProgramId = TOKEN_PROGRAM_ID,
) {
  return new TransactionInstruction({
    programId: tokenProgramId,
    keys: [
      { pubkey: mint, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: encodeInitializeMintInstructionData(decimals, mintAuthority, freezeAuthority),
  });
}

export function getAssociatedTokenAddressSync(
  mint,
  owner,
  allowOwnerOffCurve = false,
  tokenProgramId = TOKEN_PROGRAM_ID,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
) {
  if (!allowOwnerOffCurve && !PublicKey.isOnCurve(owner.toBuffer())) {
    throw new Error("Owner is off curve.");
  }

  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgramId.toBuffer(), mint.toBuffer()],
    associatedTokenProgramId,
  )[0];
}

export function createAssociatedTokenAccountInstruction(
  payer,
  associatedToken,
  owner,
  mint,
  tokenProgramId = TOKEN_PROGRAM_ID,
  associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
) {
  return new TransactionInstruction({
    programId: associatedTokenProgramId,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: Buffer.alloc(0),
  });
}