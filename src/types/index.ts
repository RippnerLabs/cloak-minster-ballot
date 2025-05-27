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