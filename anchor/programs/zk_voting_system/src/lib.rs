#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use instructions::*;
mod instructions;
mod zk;
mod state;
mod error;
declare_id!("2VfZZTtpr8Av9W2XmnJSSc3CLRVp3RLfUcds2gi2exuy");

#[program]
pub mod zk_voting_system {
    use super::*;

    pub fn init_election(ctx: Context<InitElection>, name: String, is_registration_open: bool, is_voting_open: bool , options: Vec<String>) -> Result<()> {
        return init_election_handler(ctx,name,is_registration_open,is_voting_open, options);
    }

    pub fn register_voter(ctx: Context<RegisterVoter>, name: String, nullifier: [u8; 32], proof_a: [u8; 64], proof_b: [u8; 128], proof_c: [u8; 64]) -> Result<()> {
        return register_voter_handler(ctx,name, nullifier, proof_a, proof_b, proof_c);
    }

    pub fn update_root(ctx: Context<UpdateRoot>, name: String, merkle_root: [u8;32],ipfs_cid_str: String) -> Result<()> {
        return update_root_handler(ctx, name, merkle_root, ipfs_cid_str);
    }

    pub fn close_registration(ctx: Context<CloseRegistration>, name: String) -> Result<()>  {
        return close_registration_handler(ctx, name);
    }
}
