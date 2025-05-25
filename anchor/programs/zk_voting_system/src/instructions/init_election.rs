use anchor_lang::prelude::*;
use crate::state::*;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct InitElection<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = 8 + Election::INIT_SPACE,
        seeds = [b"election".as_ref(), name.as_bytes()],
        bump,
    )]
    pub election: Account<'info, Election>,

    pub system_program: Program<'info, System>,
}

pub fn init_election_handler(ctx: Context<InitElection>, name: String, options: Vec<String>) -> Result<()> {
    let election = &mut ctx.accounts.election;
    election.admin = *ctx.accounts.signer.key;
     election.name = name;
    election.is_registration_open = true;
    election.is_voting_open = false;
    election.nullifiers_ipfs_cid = String::new();
    election.spent_nullifiers_ipfs_cid = String::new();
    election.options = options;
    election.tallies = vec![0; election.options.len()];
    Ok(())
}