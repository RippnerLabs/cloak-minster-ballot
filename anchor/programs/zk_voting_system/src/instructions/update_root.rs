use anchor_lang::prelude::*;
use crate::state::Election;
use crate::error::ErrorCode;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct UpdateRoot<'info> {
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

pub fn update_root_handler(ctx: Context<UpdateRoot>, name: String, merkle_root: [u8;32], ipfs_cid_str: String) -> Result<()> {
    let mut election= &mut ctx.accounts.election;
    require!(election.is_registration_open && !election.is_voting_open && !election.is_voting_concluded, ErrorCode::NoRegistrationPhase);
    election.merkle_root = merkle_root;
    election.nullifiers_ipfs_cid = ipfs_cid_str;

    emit!(RootUpdated{root: merkle_root});

    Ok(())
}

#[event]
pub struct RootUpdated {
    pub root: [u8; 32],
}