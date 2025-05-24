use anchor_lang::prelude::*;
use crate::state::Election;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut
    )]
    pub election: Account<'info, Election>,

    pub system_program: Program<'info, System>,
}

pub fn cast_vote_handler(ctx: Context<CastVote>, )