use anchor_lang::prelude::*;

use crate::state::Election;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct ConcludeElection<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(mut, seeds = [b"election".as_ref(), name.as_bytes()], bump)]
    pub election: Account<'info, Election>,

    pub system_program: Program<'info, System>,
}

pub fn conclude_election_handler(ctx: Context<ConcludeElection>, name: String) -> Result<()> {
    let election = &mut ctx.accounts.election;
    election.is_voting_concluded = true;
    Ok(())
}