use anchor_lang::prelude::*;
use crate::state::Election;
use crate::zk::{verifier, VOTE_VERIFYINGKEY};
use crate::error::ErrorCode;

#[event_cpi]
#[derive(Accounts)]
#[instruction(name: String)]
pub struct Vote<'info> {
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

pub fn vote_handler(ctx: Context<Vote>, name: String, proof_a: [u8; 64], proof_b: [u8; 128], proof_c: [u8; 64], membership_merkle_root: [u8; 32], new_spent_root: [u8;32], spent_nullifiers_ipfs_cid: String, option: String) -> Result<()> {
    let election= &mut ctx.accounts.election;

    verifier(proof_a, proof_b, proof_c, &[membership_merkle_root, new_spent_root], VOTE_VERIFYINGKEY);

    let index = election.options.iter().position(|n| *n == option);
    match index {
        Some(n) => {
            election.tallies[n] += 1;
            election.spent_tree = new_spent_root;
            election.spent_nullifiers_ipfs_cid = spent_nullifiers_ipfs_cid;
        },
        None => {
            return Err(ErrorCode::NonExistentOption.into());
        }
    }

    emit_cpi!(VoteAdded{option});
    Ok(())
}

#[event]
pub struct VoteAdded {
    pub option: String,
}
