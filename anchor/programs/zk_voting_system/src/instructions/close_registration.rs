use anchor_lang::prelude::*;
use crate::state::Election;
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CloseRegistration<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"election".as_ref(), name.as_bytes()],
        bump,
    )]
    pub election: Account<'info, Election>,

    pub system_program: Program<'info, System>,
}

pub fn close_registration_handler(ctx: Context<CloseRegistration>, name: String) -> Result<()> {
    let mut election= &mut ctx.accounts.election;

    require!(election.admin == *ctx.accounts.signer.key, ErrorCode::Unauthorised);

    election.is_registration_open = false;
    election.is_voting_open = true;

    Ok(())
}
