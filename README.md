# Cloak-minster Ballot: Zero Knowledge Solana Voting System

Cloak-minster Ballot is a privacy-preserving voting system built on Solana that uses zero-knowledge proofs to ensure voter anonymity while maintaining election integrity. The system combines circom circuits for proof generation, Anchor smart contracts for on-chain logic, and IPFS for decentralized storage.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Circom Circuits](#circom-circuits)
3. [Anchor Instructions](#anchor-instructions)
4. [Off-Chain Components](#off-chain-components)
5. [On-Chain Verification](#on-chain-verification)
6. [Election Lifecycle](#election-lifecycle)
7. [Privacy Guarantees](#privacy-guarantees)
8. [Setup and Usage](#setup-and-usage)

## System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │   IPFS Storage  │    │ Solana Blockchain│
│                 │    │                 │    │                 │
│ • Proof Gen     │◄──►│ • Nullifier     │◄──►│ • Smart Contract│
│ • Vote Creation │    │   Trees         │    │ • ZK Verification│
│ • Registration  │    │ • Spent Trees   │    │ • State Storage │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

The system operates through three main components:
- **Circom Circuits**: Generate zero-knowledge proofs for voter registration and voting
- **Solana Smart Contract**: Verify proofs and manage election state on-chain
- **IPFS Storage**: Store Merkle trees off-chain for scalability

## Circom Circuits

### Identity Nullifier Circuit (`identity_nullifier.circom`)

This circuit generates a unique nullifier for each voter without revealing their identity.

```circom
template IdentityNullifier() {
    signal input identity_secret;    // Private voter secret
    signal input election_id;        // Public election identifier
    signal output nullifier;         // Unique voter nullifier

    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== identity_secret;
    poseidon.inputs[1] <== election_id;
    nullifier <== poseidon.out;
}
```

**Purpose**: Creates a deterministic, unique identifier for each voter per election while keeping their identity private.

**Privacy Properties**:
- The nullifier links a vote to a registered voter without revealing voter identity
- Different elections produce different nullifiers for the same voter
- Impossible to reverse-engineer the voter's identity from the nullifier

### Vote Circuit (`vote.circom`)

This circuit proves voter membership in the registered voter set without revealing which specific voter is voting.

```circom
template Vote(depthD) {
    signal input identity_nullifier;                    // Voter's nullifier
    signal input membership_merke_tree_siblings[depthD]; // Merkle proof siblings
    signal input membership_merke_tree_path_indices[depthD]; // Merkle proof path
    signal output membership_merkle_root;               // Computed root
}
```

**Components**:

1. **Membership Proof**: Verifies the voter's nullifier exists in the registered voters Merkle tree
2. **Sparse Non-Membership** (commented out): Originally designed to prevent double voting using a spent nullifier tree

**Privacy Properties**:
- Proves voter eligibility without revealing which registered voter is casting the vote
- Membership proof uses a Merkle tree of all registered voter nullifiers
- The circuit computes the Merkle root from the provided nullifier and proof path

## Anchor Instructions

The Solana smart contract implements several key instructions for managing elections:

### Election State Structure

```rust
pub struct Election {
    pub admin: Pubkey,                        // Election administrator
    pub name: String,                         // Election identifier
    pub is_registration_open: bool,           // Registration phase status
    pub is_voting_open: bool,                 // Voting phase status
    pub is_voting_concluded: bool,            // Election completion status
    pub merkle_root: [u8; 32],               // Root of registered voters tree
    pub nullifiers_ipfs_cid: String,         // IPFS hash of nullifier tree data
    pub spent_tree: [u8; 32],                // Root of spent nullifiers tree
    pub spent_nullifiers_ipfs_cid: String,   // IPFS hash of spent tree data
    pub options: Vec<String>,                 // Voting options
    pub tallies: Vec<u64>,                   // Vote counts per option
}
```

### Key Instructions

#### 1. `init_election.rs`
Initializes a new election with specified options and administrator.

#### 2. `register_voter.rs`
Handles voter registration with zero-knowledge proof verification.

```rust
pub fn register_voter_handler(
    ctx: Context<RegisterVoter>, 
    name: String, 
    nullifier: [u8; 32], 
    proof_a: [u8; 64], 
    proof_b: [u8; 128], 
    proof_c: [u8; 64]
) -> Result<()>
```

**Process**:
1. Verifies the election is in registration phase
2. Validates the ZK proof using the register voter verifying key
3. Emits a `NullifierAdded` event with the voter's nullifier

#### 3. `vote.rs`
Processes votes with membership proof verification.

```rust
pub fn vote_handler(
    ctx: Context<Vote>, 
    name: String, 
    proof_a: [u8; 64], 
    proof_b: [u8; 128], 
    proof_c: [u8; 64], 
    membership_merkle_root: [u8; 32], 
    new_spent_root: [u8; 32], 
    spent_nullifiers_ipfs_cid: String, 
    option: String
) -> Result<()>
```

**Process**:
1. Verifies the election is in voting phase
2. Validates the ZK proof using the vote verifying key
3. Checks the voting option exists
4. Updates vote tallies and spent nullifier tree
5. Emits a `VoteAdded` event

#### 4. `update_root.rs`
Updates the Merkle root after new voter registrations.

#### 5. `close_registration.rs`
Transitions from registration to voting phase.

#### 6. `conclude_election.rs`
Finalizes the election and closes voting.

## Off-Chain Components

### IPFS Storage Usage

The system uses IPFS to store Merkle tree data off-chain for scalability:

#### Nullifier Trees
```typescript
// Store registered voter nullifiers
const file = JSON.stringify({ 
    depth: 20, 
    leaves: leaves_g.map(l => "0x" + l.toString('hex')) 
});
const { cid } = await ipfs.add({ content: file });
```

#### Spent Nullifier Trees
```typescript
// Store spent voter nullifiers (double-vote prevention)
const file = JSON.stringify({ 
    depth: TREE_DEPTH, 
    spentLeaves: spent_leaves_hex.map(l => "0x" + l.toString('hex')) 
});
const { cid } = await ipfs.add({ content: file });
```

### Off-Chain Proving System

#### Voter Registration Process

```typescript
export async function registerVoter(
    secret: Uint8Array, 
    election_name_str: string, 
    program: Program<ZkVotingSystem>, 
    signer: anchor.web3.Keypair
) {
    // 1. Generate nullifier proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve({
        identity_secret: secretKeyBigInt,
        election_id: electionIdBigInt,
    }, wasmPath, zkeyPath);
    
    // 2. Submit to smart contract
    await program.methods.registerVoter(
        election_name, 
        nullifier, 
        proofA, 
        proofB, 
        proofC
    );
    
    // 3. Update IPFS tree data
    const tree = new MerkleTree(leaves_g, poseidon);
    await ipfs.add({ content: JSON.stringify(treeData) });
}
```

#### Voting Process

```typescript
export async function performVote(
    voucher: any, 
    election_name_str: string, 
    option: string
) {
    // 1. Generate membership proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve({
        identity_nullifier: nullifier,
        membership_merke_tree_siblings: siblings,
        membership_merke_tree_path_indices: pathIndices,
    }, wasmPath, zkeyPath);
    
    // 2. Update spent nullifier tree
    tree.add(nullifier_bigint, 1n);
    
    // 3. Submit vote to smart contract
    await program.methods.vote(
        election_name,
        proofA, proofB, proofC,
        membership_merkle_root,
        new_spent_root,
        ipfs_cid,
        option
    );
}
```

#### Voucher Download System

Voters download cryptographic vouchers containing their membership proofs:

```typescript
export async function downloadVoucher(
    secret: Uint8Array, 
    election_name_str: string
) {
    // 1. Regenerate nullifier
    const identity_nullifier = generateNullifier(secret, election_id);
    
    // 2. Fetch registered voters from IPFS
    const leaves = await getLeavesFromIpfs(ipfs, election.nullifiersIpfsCid);
    
    // 3. Generate Merkle proof
    const tree = new MerkleTree(leaves, poseidon);
    const proof = tree.getProof(identity_nullifier);
    
    // 4. Return voucher with proof data
    return {
        election: election_id,
        nullifier: identity_nullifier,
        merkle_root: tree.getRoot(),
        sibling_hashes: proof.siblings,
        path_indices: proof.pathIndices
    };
}
```

## On-Chain Verification

### ZK Proof Verification

The system uses Groth16 proof verification on Solana:

```rust
pub fn verifier<const N: usize>(
    proof_a: [u8; 64],
    proof_b: [u8; 128], 
    proof_c: [u8; 64],
    public_inputs: &[[u8; 32]; N],
    vk: Groth16Verifyingkey,
) -> Result<()> {
    let mut verifier = Groth16Verifier::new(
        &proof_a, &proof_b, &proof_c, 
        public_inputs, &vk
    )?;
    verifier.verify()?;
    Ok(())
}
```

### Verifying Keys

The system maintains separate verifying keys for different proof types:

1. **`REGISTER_VOTER_VERIFYINGKEY`**: Verifies identity nullifier generation proofs
2. **`VOTE_VERIFYINGKEY`**: Verifies membership proofs for voting

These keys are generated during the trusted setup phase and embedded in the smart contract.

### Double-Vote Prevention

The system prevents double voting through a spent nullifier tree:

1. **Registration**: Voter nullifiers are added to the membership tree
2. **Voting**: Used nullifiers are added to the spent tree
3. **Verification**: The system checks that a nullifier exists in membership but not in spent trees

## Election Lifecycle

### Phase 1: Election Initialization
```
Admin → initElection(options[]) → Election Created
```

### Phase 2: Voter Registration
```
Voter → generateNullifier(secret, electionId) → ZK Proof
Voter → registerVoter(proof) → Nullifier added to membership tree
System → updateRoot() → IPFS updated with new tree data
```

### Phase 3: Registration Closure
```
Admin → closeRegistration() → Transition to voting phase
```

### Phase 4: Voting
```
Voter → downloadVoucher(secret) → Membership proof retrieved
Voter → generateVoteProof(voucher) → ZK proof created
Voter → submitVote(proof, option) → Vote counted, spent tree updated
```

### Phase 5: Election Conclusion
```
Admin → concludeElection() → Final tallies published
```

## Privacy Guarantees

### Voter Anonymity
- **Identity Hiding**: Votes cannot be linked to specific voter identities
- **Receipt-Free**: Voters cannot prove how they voted to third parties
- **Coercion Resistance**: External parties cannot force voters to vote in specific ways

### Election Integrity
- **Eligibility**: Only registered voters can vote
- **Uniqueness**: Each voter can vote only once
- **Correctness**: All votes are counted accurately
- **Verifiability**: Anyone can verify the election results

### Technical Privacy Properties
- **Zero-Knowledge**: Proofs reveal nothing beyond statement validity
- **Unlinkability**: Individual votes cannot be traced to voters
- **Forward Secrecy**: Past elections remain private even if future secrets are compromised

## Setup and Usage

### Prerequisites
```bash
# Install dependencies
yarn install

# Compile circuits
cd circom
circom identity_nullifier.circom --r1cs --wasm --sym
circom vote.circom --r1cs --wasm --sym

# Generate proving and verifying keys
snarkjs powersoftau new bn128 12 pot12_0000.ptau
snarkjs powersoftau prepare phase2 pot12_0000.ptau pot12_final.ptau
snarkjs groth16 setup identity_nullifier.r1cs pot12_final.ptau identity_nullifier_0000.zkey
snarkjs groth16 setup vote.r1cs pot12_final.ptau vote_0000.zkey

# Build Anchor program
cd ../anchor
anchor build
anchor deploy
```

### Running Elections
```typescript
// 1. Initialize election
await program.methods.initElection(electionName, options).rpc();

// 2. Register voters
await registerVoter(voterSecret, electionName, program, signer);

// 3. Close registration
await program.methods.closeRegistration(electionName).rpc();

// 4. Voters download vouchers and vote
const voucher = await downloadVoucher(voterSecret, electionName);
await performVote(voucher, electionName, program, signer, "Option 1");

// 5. Conclude election
await program.methods.concludeElection(electionName).rpc();
```

This system provides a robust, privacy-preserving voting platform that maintains democratic principles while leveraging cutting-edge cryptographic techniques for voter privacy and election integrity.
