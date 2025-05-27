import { BN } from '@coral-xyz/anchor'
import { PublicKey } from "@solana/web3.js"

export interface ZKProof {
    proof: any
    publicSignals: string[]
    identityNullifier: Uint8Array
    proofA: Uint8Array
    proofB: Uint8Array
    proofC: Uint8Array
}

export interface VoucherData {
    election: bigint
    leaf_index: number
    nullifier: string
    merkle_root: string
    sibling_hashes: string[]
    path_indices: number[]
    electionName: string
    generatedAt: Date
}
export interface Election {
    admin: PublicKey
    name: string
    isRegistrationOpen: boolean
    isVotingConcluded: boolean
    isVotingOpen: boolean
    merkleRoot: number[]
    nullifiersIpfsCid: string
    spentTree: number[]
    spentNullifiersIpfsCid: string
    options: string[]
    tallies: BN[]
  }
  
  export interface ElectionWithKey extends Election {
    publicKey: PublicKey;
  }
  