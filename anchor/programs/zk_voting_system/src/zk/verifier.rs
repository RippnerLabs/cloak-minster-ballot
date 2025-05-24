use anchor_lang::prelude::*;
use groth16_solana::groth16::{Groth16Verifier, Groth16Verifyingkey};
use crate::error::ErrorCode;

pub fn verifier(
    proof_a: [u8; 64],
    proof_b: [u8; 128],
    proof_c: [u8; 64],
    public_inputs: [u8; 32],
    vk: Groth16Verifyingkey,
) -> Result<()> {
    let public_inputs = [public_inputs];
    let mut verifier = Groth16Verifier::new(
        &proof_a,
        &proof_b,
        &proof_c,
        &public_inputs,
        &vk
    ).map_err(|_| ErrorCode::InvalidProofData)?;

    verifier.verify().map_err(|_| ErrorCode::Groth16VerificationFailed)?;

    Ok(())
}