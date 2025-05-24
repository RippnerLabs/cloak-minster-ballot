use anchor_lang::prelude::*;
use crate::state::Election;
use crate::zk::{verifier, VERIFYINGKEY};

#[event_cpi]
#[derive(Accounts)]
#[instruction(name: String)]
pub struct RegisterVoter<'info> {
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

pub fn register_voter_handler(ctx: Context<RegisterVoter>, name: String, nullifier: [u8; 32], proof_a: [u8; 64], proof_b: [u8; 128], proof_c: [u8; 64]) -> Result<()> {
    let mut election= &mut ctx.accounts.election;

    verifier(proof_a, proof_b, proof_c, nullifier, VERIFYINGKEY);

    emit_cpi!(NullifierAdded{nullifier});
    Ok(())
}

#[event]
pub struct NullifierAdded {
    pub nullifier: [u8;32],
}