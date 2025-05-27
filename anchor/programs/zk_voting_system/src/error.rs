use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid proof data")]
    InvalidProofData,

    #[msg("Groth16 Verification failed")]
    Groth16VerificationFailed,

    #[msg("Unauthorised")]
    Unauthorised,

    #[msg("Voting for non-existent option")]
    NonExistentOption,

    #[msg("Election is not in voting phase")]
    NoVotingPhase,

    #[msg("Election is not in registration phase")]
    NoRegistrationPhase,
}