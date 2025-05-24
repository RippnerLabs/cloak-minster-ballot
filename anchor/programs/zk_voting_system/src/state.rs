use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Election {
    pub admin: Pubkey,
    #[max_len(32)]
    pub name: String,
    pub is_registration_open: bool,
    pub is_voting_open: bool,
    #[max_len(59)]
    pub nullifiers_ipfs_cid: String, // ascii multibase cid 
    pub merkle_root: [u8; 32],
    #[max_len(20, 20)]
    pub options: Vec<String>,
    #[max_len(20)]
    pub tallies: Vec<u64>,
}