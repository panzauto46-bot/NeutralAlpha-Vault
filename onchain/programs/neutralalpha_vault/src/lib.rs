use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
};
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWxTWqkZ6rN1Y2fYgR6K9YqR9Qj3");

const MIN_LOCK_PERIOD_SECS: i64 = 90 * 24 * 60 * 60;

#[program]
pub mod neutralalpha_vault {
    use super::*;

    pub fn initialize_vault(
        ctx: Context<InitializeVault>,
        params: InitializeVaultParams,
    ) -> Result<()> {
        require!(
            params.lock_period_secs >= MIN_LOCK_PERIOD_SECS,
            VaultError::InvalidLockPeriod
        );
        require!(
            params.performance_fee_bps <= 2_000,
            VaultError::InvalidPerformanceFee
        );

        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.authority = ctx.accounts.authority.key();
        vault_state.rebalance_bot = params.rebalance_bot;
        vault_state.usdc_mint = ctx.accounts.usdc_mint.key();
        vault_state.usdc_vault = ctx.accounts.usdc_vault.key();
        vault_state.share_mint = ctx.accounts.share_mint.key();
        vault_state.drift_program = params.drift_program;
        vault_state.jupiter_program = params.jupiter_program;
        vault_state.pyth_price_feed = params.pyth_price_feed;
        vault_state.total_usdc = 0;
        vault_state.total_shares = 0;
        vault_state.lock_period_secs = params.lock_period_secs;
        vault_state.performance_fee_bps = params.performance_fee_bps;
        vault_state.paused = false;
        vault_state.emergency_mode = false;
        vault_state.last_rebalance_ts = 0;
        vault_state.bump_state = ctx.bumps.vault_state;
        vault_state.bump_authority = ctx.bumps.vault_authority;
        vault_state.reserved = [0u8; 64];

        Ok(())
    }

    pub fn set_pause(ctx: Context<UpdateVaultAuthority>, paused: bool) -> Result<()> {
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.paused = paused;
        Ok(())
    }

    pub fn set_emergency_mode(
        ctx: Context<UpdateVaultAuthority>,
        emergency_mode: bool,
    ) -> Result<()> {
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.emergency_mode = emergency_mode;
        Ok(())
    }

    pub fn set_rebalance_bot(
        ctx: Context<UpdateVaultAuthority>,
        rebalance_bot: Pubkey,
    ) -> Result<()> {
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.rebalance_bot = rebalance_bot;
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::InvalidAmount);
        require!(!ctx.accounts.vault_state.paused, VaultError::VaultPaused);

        let vault_state = &mut ctx.accounts.vault_state;

        let cpi_transfer = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.depositor_usdc.to_account_info(),
                to: ctx.accounts.usdc_vault.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        );
        token::transfer(cpi_transfer, amount)?;

        let shares_to_mint = if vault_state.total_usdc == 0 || vault_state.total_shares == 0 {
            amount
        } else {
            amount
                .checked_mul(vault_state.total_shares)
                .ok_or(VaultError::MathOverflow)?
                .checked_div(vault_state.total_usdc)
                .ok_or(VaultError::MathOverflow)?
        };
        require!(shares_to_mint > 0, VaultError::SharesTooSmall);

        let state_key = vault_state.key();
        let authority_bump = [vault_state.bump_authority];
        let signer_seeds: &[&[u8]] = &[b"vault_authority", state_key.as_ref(), &authority_bump];

        let cpi_mint = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.share_mint.to_account_info(),
                to: ctx.accounts.depositor_share.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            &[signer_seeds],
        );
        token::mint_to(cpi_mint, shares_to_mint)?;

        vault_state.total_usdc = vault_state
            .total_usdc
            .checked_add(amount)
            .ok_or(VaultError::MathOverflow)?;
        vault_state.total_shares = vault_state
            .total_shares
            .checked_add(shares_to_mint)
            .ok_or(VaultError::MathOverflow)?;

        let clock = Clock::get()?;
        let user_position = &mut ctx.accounts.user_position;
        if user_position.owner == Pubkey::default() {
            user_position.owner = ctx.accounts.depositor.key();
            user_position.bump = ctx.bumps.user_position;
        }
        user_position.shares = user_position
            .shares
            .checked_add(shares_to_mint)
            .ok_or(VaultError::MathOverflow)?;
        user_position.last_deposit_ts = clock.unix_timestamp;
        user_position.unlock_ts = clock
            .unix_timestamp
            .checked_add(vault_state.lock_period_secs)
            .ok_or(VaultError::MathOverflow)?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, share_amount: u64) -> Result<()> {
        require!(share_amount > 0, VaultError::InvalidAmount);

        let vault_state = &mut ctx.accounts.vault_state;
        let user_position = &mut ctx.accounts.user_position;

        require!(
            user_position.owner == ctx.accounts.depositor.key(),
            VaultError::InvalidPositionOwner
        );
        require!(
            user_position.shares >= share_amount,
            VaultError::InsufficientShares
        );
        require!(vault_state.total_shares > 0, VaultError::InvalidVaultState);

        let clock = Clock::get()?;
        if !vault_state.emergency_mode {
            require!(
                clock.unix_timestamp >= user_position.unlock_ts,
                VaultError::LockNotExpired
            );
        }

        let usdc_out = share_amount
            .checked_mul(vault_state.total_usdc)
            .ok_or(VaultError::MathOverflow)?
            .checked_div(vault_state.total_shares)
            .ok_or(VaultError::MathOverflow)?;
        require!(usdc_out > 0, VaultError::WithdrawTooSmall);

        let cpi_burn = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.share_mint.to_account_info(),
                from: ctx.accounts.depositor_share.to_account_info(),
                authority: ctx.accounts.depositor.to_account_info(),
            },
        );
        token::burn(cpi_burn, share_amount)?;

        let state_key = vault_state.key();
        let authority_bump = [vault_state.bump_authority];
        let signer_seeds: &[&[u8]] = &[b"vault_authority", state_key.as_ref(), &authority_bump];

        let cpi_transfer = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.usdc_vault.to_account_info(),
                to: ctx.accounts.depositor_usdc.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            &[signer_seeds],
        );
        token::transfer(cpi_transfer, usdc_out)?;

        vault_state.total_usdc = vault_state
            .total_usdc
            .checked_sub(usdc_out)
            .ok_or(VaultError::MathOverflow)?;
        vault_state.total_shares = vault_state
            .total_shares
            .checked_sub(share_amount)
            .ok_or(VaultError::MathOverflow)?;

        user_position.shares = user_position
            .shares
            .checked_sub(share_amount)
            .ok_or(VaultError::MathOverflow)?;
        if user_position.shares == 0 {
            user_position.unlock_ts = 0;
            user_position.last_deposit_ts = 0;
        }

        Ok(())
    }

    pub fn execute_drift_hedge(
        ctx: Context<ExecuteExternal>,
        params: ExternalCpiParams,
    ) -> Result<()> {
        require_keys_eq!(
            params.program,
            ctx.accounts.vault_state.drift_program,
            VaultError::InvalidExternalProgram
        );
        execute_external_cpi(&ctx, &params)?;
        ctx.accounts.vault_state.last_rebalance_ts = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn execute_jupiter_swap(
        ctx: Context<ExecuteExternal>,
        params: ExternalCpiParams,
    ) -> Result<()> {
        require_keys_eq!(
            params.program,
            ctx.accounts.vault_state.jupiter_program,
            VaultError::InvalidExternalProgram
        );
        execute_external_cpi(&ctx, &params)?;
        ctx.accounts.vault_state.last_rebalance_ts = Clock::get()?.unix_timestamp;
        Ok(())
    }
}

fn execute_external_cpi<'info>(
    ctx: &Context<'_, '_, '_, 'info, ExecuteExternal<'info>>,
    params: &ExternalCpiParams,
) -> Result<()> {
    require!(
        params.account_flags.len() == ctx.remaining_accounts.len(),
        VaultError::AccountFlagLengthMismatch
    );
    require!(!params.data.is_empty(), VaultError::InvalidExternalData);

    let metas = ctx
        .remaining_accounts
        .iter()
        .enumerate()
        .map(|(idx, account)| {
            let flags = params.account_flags[idx];
            let is_writable = flags & 1 == 1;
            let is_signer = flags & 2 == 2;
            if is_writable {
                AccountMeta::new(*account.key, is_signer)
            } else {
                AccountMeta::new_readonly(*account.key, is_signer)
            }
        })
        .collect::<Vec<_>>();

    let ix = Instruction {
        program_id: params.program,
        accounts: metas,
        data: params.data.clone(),
    };

    let account_infos = ctx
        .remaining_accounts
        .iter()
        .map(ToAccountInfo::to_account_info)
        .collect::<Vec<_>>();

    let state_key = ctx.accounts.vault_state.key();
    let authority_bump = [ctx.accounts.vault_state.bump_authority];
    let signer_seeds: &[&[u8]] = &[b"vault_authority", state_key.as_ref(), &authority_bump];

    invoke_signed(&ix, &account_infos, &[signer_seeds])?;
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeVaultParams {
    pub rebalance_bot: Pubkey,
    pub drift_program: Pubkey,
    pub jupiter_program: Pubkey,
    pub pyth_price_feed: Pubkey,
    pub lock_period_secs: i64,
    pub performance_fee_bps: u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ExternalCpiParams {
    pub program: Pubkey,
    pub account_flags: Vec<u8>,
    pub data: Vec<u8>,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = 8 + VaultState::LEN,
        seeds = [b"vault", usdc_mint.key().as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        seeds = [b"vault_authority", vault_state.key().as_ref()],
        bump
    )]
    /// CHECK: PDA signing authority for vault-owned token accounts.
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        token::mint = usdc_mint,
        token::authority = vault_authority,
        seeds = [b"usdc_vault", vault_state.key().as_ref()],
        bump
    )]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = vault_authority,
        seeds = [b"share_mint", vault_state.key().as_ref()],
        bump
    )]
    pub share_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdateVaultAuthority<'info> {
    #[account(
        mut,
        has_one = authority,
        seeds = [b"vault", vault_state.usdc_mint.as_ref()],
        bump = vault_state.bump_state
    )]
    pub vault_state: Account<'info, VaultState>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault_state.usdc_mint.as_ref()],
        bump = vault_state.bump_state
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        seeds = [b"vault_authority", vault_state.key().as_ref()],
        bump = vault_state.bump_authority
    )]
    /// CHECK: PDA signing authority for minting shares.
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = depositor_usdc.owner == depositor.key(),
        constraint = depositor_usdc.mint == vault_state.usdc_mint
    )]
    pub depositor_usdc: Account<'info, TokenAccount>,
    #[account(mut, address = vault_state.usdc_vault)]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(mut, address = vault_state.share_mint)]
    pub share_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = depositor_share.owner == depositor.key(),
        constraint = depositor_share.mint == vault_state.share_mint
    )]
    pub depositor_share: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = depositor,
        space = 8 + UserPosition::LEN,
        seeds = [b"position", vault_state.key().as_ref(), depositor.key().as_ref()],
        bump
    )]
    pub user_position: Account<'info, UserPosition>,
    #[account(mut)]
    pub depositor: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault_state.usdc_mint.as_ref()],
        bump = vault_state.bump_state
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        seeds = [b"vault_authority", vault_state.key().as_ref()],
        bump = vault_state.bump_authority
    )]
    /// CHECK: PDA signing authority for vault token transfers.
    pub vault_authority: UncheckedAccount<'info>,
    #[account(
        mut,
        constraint = depositor_usdc.owner == depositor.key(),
        constraint = depositor_usdc.mint == vault_state.usdc_mint
    )]
    pub depositor_usdc: Account<'info, TokenAccount>,
    #[account(mut, address = vault_state.usdc_vault)]
    pub usdc_vault: Account<'info, TokenAccount>,
    #[account(mut, address = vault_state.share_mint)]
    pub share_mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = depositor_share.owner == depositor.key(),
        constraint = depositor_share.mint == vault_state.share_mint
    )]
    pub depositor_share: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"position", vault_state.key().as_ref(), depositor.key().as_ref()],
        bump = user_position.bump
    )]
    pub user_position: Account<'info, UserPosition>,
    pub depositor: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ExecuteExternal<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault_state.usdc_mint.as_ref()],
        bump = vault_state.bump_state
    )]
    pub vault_state: Account<'info, VaultState>,
    #[account(
        seeds = [b"vault_authority", vault_state.key().as_ref()],
        bump = vault_state.bump_authority
    )]
    /// CHECK: PDA signer for external CPIs.
    pub vault_authority: UncheckedAccount<'info>,
    #[account(address = vault_state.rebalance_bot)]
    pub rebalance_bot: Signer<'info>,
}

#[account]
pub struct VaultState {
    pub authority: Pubkey,
    pub rebalance_bot: Pubkey,
    pub usdc_mint: Pubkey,
    pub usdc_vault: Pubkey,
    pub share_mint: Pubkey,
    pub drift_program: Pubkey,
    pub jupiter_program: Pubkey,
    pub pyth_price_feed: Pubkey,
    pub total_usdc: u64,
    pub total_shares: u64,
    pub lock_period_secs: i64,
    pub last_rebalance_ts: i64,
    pub performance_fee_bps: u16,
    pub paused: bool,
    pub emergency_mode: bool,
    pub bump_state: u8,
    pub bump_authority: u8,
    pub reserved: [u8; 64],
}

impl VaultState {
    pub const LEN: usize = 32 * 8 + 8 + 8 + 8 + 8 + 2 + 1 + 1 + 1 + 1 + 64;
}

#[account]
pub struct UserPosition {
    pub owner: Pubkey,
    pub shares: u64,
    pub unlock_ts: i64,
    pub last_deposit_ts: i64,
    pub bump: u8,
    pub reserved: [u8; 31],
}

impl UserPosition {
    pub const LEN: usize = 32 + 8 + 8 + 8 + 1 + 31;
}

#[error_code]
pub enum VaultError {
    #[msg("Amount must be greater than zero.")]
    InvalidAmount,
    #[msg("Vault is paused.")]
    VaultPaused,
    #[msg("Math overflow occurred.")]
    MathOverflow,
    #[msg("Calculated share amount is too small.")]
    SharesTooSmall,
    #[msg("Invalid lock period; minimum is 90 days.")]
    InvalidLockPeriod,
    #[msg("Invalid performance fee.")]
    InvalidPerformanceFee,
    #[msg("Position owner does not match signer.")]
    InvalidPositionOwner,
    #[msg("Not enough shares to withdraw.")]
    InsufficientShares,
    #[msg("Vault state is invalid.")]
    InvalidVaultState,
    #[msg("Lock period has not expired.")]
    LockNotExpired,
    #[msg("Withdraw output is too small.")]
    WithdrawTooSmall,
    #[msg("External program does not match configured program.")]
    InvalidExternalProgram,
    #[msg("External CPI account flag length mismatch.")]
    AccountFlagLengthMismatch,
    #[msg("External CPI data is empty.")]
    InvalidExternalData,
}
