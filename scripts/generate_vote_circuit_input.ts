import fs from "node:fs/promises";
import {
  IndexedMerkleTree,
  NonMembershipProof
} from "@jayanth-kumar-morem/indexed-merkle-tree";

// /* ------------------------------------------------------------------ *
//  * 1.  Parameters & helpers                                           *
//  * ------------------------------------------------------------------ */
const DEPTH_D = 20;                 // depth of membership tree
const DEPTH_I = 32;                 // depth of Indexed-Merkle-Tree

const toDec   = (x: bigint | string) => BigInt(x).toString();
const pad     = <T>(arr: T[], len: number, fill: T) =>
  arr.length >= len ? arr : [...arr, ...Array(len - arr.length).fill(fill)];

/* ------------------------------------------------------------------ *
 * 2.  Inputs that arrive with the voter's voucher                    *
 * ------------------------------------------------------------------ */
const voucher = {
  nullifier: "12345",  // Simple test nullifier
  sibling_hashes: [
    "1234",
    "5678",
  ],
  path_indices: [1, 1],
};

// Use simple nullifier for testing
let nullifierBig = BigInt(voucher.nullifier);

console.log("Using nullifier:", nullifierBig.toString());
console.log("Nullifier bit length:", nullifierBig.toString(2).length);

/* ------------------------------------------------------------------ *
 * 3.  Build / load the Indexed-Merkle-Tree                            *
 * ------------------------------------------------------------------ */

// Create a fresh IMT for testing
let imt = new IndexedMerkleTree();
console.log("• created new IMT for testing");

/* ------------------------------------------------------------------ *
 * 4.  Produce the non-membership proof                               *
 * ------------------------------------------------------------------ */
const proof: NonMembershipProof = imt.createNonMembershipProof(nullifierBig);

console.log("Proof details:");
console.log("- query:", proof.query.toString());
console.log("- preLeaf.val:", proof.preLeaf.val.toString());
console.log("- preLeaf.nextVal:", proof.preLeaf.nextVal.toString());
console.log("- root:", proof.root.toString());

// Verify the proof
const isValid = imt.verifyNonMembershipProof(proof);
console.log("- proof valid:", isValid);

/* ------------------------------------------------------------------ *
 * 5.  Assemble vote.circom inputs                                    *
 * ------------------------------------------------------------------ */
const membershipSiblings = pad(
  voucher.sibling_hashes.map(toDec),
  DEPTH_D,
  "0",
);
const membershipPathIdx  = pad(
  voucher.path_indices.map(String),
  DEPTH_D,
  "0",
);

const input = {
  identity_nullifier:            toDec(nullifierBig),
  membership_merke_tree_siblings:       membershipSiblings,
  membership_merke_tree_path_indices:    membershipPathIdx,
  imt_query:    toDec(proof.query),
  imt_pre_val:  toDec(proof.preLeaf.val),
  imt_pre_next: toDec(proof.preLeaf.nextVal),
  imt_path:     proof.path.map(toDec),          // NO reversal
  imt_dirs:     proof.directions.map(String),   // NO reversal
  imt_old_root: toDec(proof.root),
};

/* ------------------------------------------------------------------ *
 * 6.  Persist artefacts                                              *
 * ------------------------------------------------------------------ */
await fs.writeFile("input.json", JSON.stringify(input, null, 2));
console.log("✓ wrote input.json  (identity_nullifier =", input.identity_nullifier, ")");

console.log("✓ simple test setup complete");
