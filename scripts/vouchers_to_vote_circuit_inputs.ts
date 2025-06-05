const vouchers = [
    {
        election: 52208898341821768n,
        leaf_index: 0,
        nullifier: '0x0609a0e9fc333fe822ee2c51a80ae65bd3496521c61915c27c7ea9c578d4c104',
        merkle_root: '0x75a2ce619a659abf8c09750fe3a0440d0f0df1a37e06dc824224e952fd231b17',
        sibling_hashes: [
            '0x070da0bbc283fbd04bd3ee6074cf55633405d4b86ea71f4a5702e15c994751dd',
            '0x0b6e5afa82ce79bf20e18b05073136d017d9eb232cf6143e304f4284993f41d9',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0'
        ],
        path_indices: [
            1, 1, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0
        ]
    },
    {
        election: 52208898341821768n,
        leaf_index: 1,
        nullifier: '0x070da0bbc283fbd04bd3ee6074cf55633405d4b86ea71f4a5702e15c994751dd',
        merkle_root: '0x75a2ce619a659abf8c09750fe3a0440d0f0df1a37e06dc824224e952fd231b17',
        sibling_hashes: [
            '0x0609a0e9fc333fe822ee2c51a80ae65bd3496521c61915c27c7ea9c578d4c104',
            '0x0b6e5afa82ce79bf20e18b05073136d017d9eb232cf6143e304f4284993f41d9',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0'
        ],
        path_indices: [
            0, 1, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0
        ]
    },
    {
        election: 52208898341821768n,
        leaf_index: 2,
        nullifier: '0x0b6e5afa82ce79bf20e18b05073136d017d9eb232cf6143e304f4284993f41d9',
        merkle_root: '0x75a2ce619a659abf8c09750fe3a0440d0f0df1a37e06dc824224e952fd231b17',
        sibling_hashes: [
            '0x499a8f4f1b3c8a5dabff94487adbe4ba83029ab1556437ea356bf9e996d8c98c',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0',
            '0'
        ],
        path_indices: [
            0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0
        ]
    }
]

import { ChildNodes, IMT } from "@zk-kit/imt";
import { buildPoseidon } from "circomlibjs";
import * as snarkjs from "snarkjs";

const DEPTH = 256;

// Custom SMT implementation for our specific needs
class CustomSMT {
    private leaves: Map<string, bigint>;
    private poseidon: any;
    private defaults: bigint[];
    private depth: number;

    constructor(poseidon: any, depth: number = 20) {
        this.leaves = new Map();
        this.poseidon = poseidon;
        this.depth = depth;
        
        // Precompute default values - same as circuit logic
        this.defaults = [0n];
        for (let i = 1; i <= depth; i++) {
            this.defaults[i] = this.hash(this.defaults[i - 1], this.defaults[i - 1]);
        }
    }

    private hash(left: bigint, right: bigint): bigint {
        const F = this.poseidon.F;
        return F.toObject(this.poseidon([left, right]));
    }

    private getPathBits(key: bigint): number[] {
        const bits: number[] = [];
        for (let i = 0; i < this.depth; i++) {
            bits.push(Number(key >> BigInt(i) & 1n));
        }
        return bits;
    }

    add(key: bigint, value: bigint): void {
        this.leaves.set(key.toString(), value);
    }

    get(key: bigint): bigint | undefined {
        return this.leaves.get(key.toString());
    }

    has(key: bigint): boolean {
        return this.leaves.has(key.toString());
    }

    // Get the root of the current tree
    get root(): bigint {
        if (this.leaves.size === 0) {
            return this.defaults[this.depth];
        }
        
        // Build the tree efficiently
        const tree = new Map<string, bigint>();
        
        // Set all leaf values
        for (const [keyStr, value] of this.leaves) {
            const key = BigInt(keyStr);
            const pathBits = this.getPathBits(key);
            
            let path = '';
            for (let i = 0; i < this.depth; i++) {
                path = pathBits[i].toString() + path;
            }
            tree.set(`leaf:${path}`, value);
        }
        
        // Build tree bottom-up
        for (let level = this.depth - 1; level >= 0; level--) {
            for (let nodeIndex = 0; nodeIndex < (1 << level); nodeIndex++) {
                let nodePath = nodeIndex.toString(2).padStart(level, '0');
                
                const leftKey = level === this.depth - 1 ? `leaf:${nodePath}0` : `node:${level + 1}:${nodePath}0`;
                const rightKey = level === this.depth - 1 ? `leaf:${nodePath}1` : `node:${level + 1}:${nodePath}1`;
                
                const leftChild = tree.get(leftKey) || 0n;
                const rightChild = tree.get(rightKey) || 0n;
                
                let nodeValue;
                if (leftChild === 0n && rightChild === 0n) {
                    nodeValue = this.defaults[level + 1];
                } else {
                    nodeValue = this.hash(leftChild, rightChild);
                }
                
                tree.set(`node:${level}:${nodePath}`, nodeValue);
            }
        }
        
        return tree.get('node:0:') || this.defaults[this.depth];
    }

    // Create a non-membership proof for a key
    createNonMembershipProof(key: bigint): { siblings: bigint[], pathBits: number[], root: bigint } {
        const pathBits = this.getPathBits(key);
        const siblings: bigint[] = [];
        
        if (this.leaves.size === 0) {
            // For empty tree, all siblings are default values
            for (let level = 0; level < this.depth; level++) {
                siblings.push(this.defaults[level]);
            }
        } else {
            // For non-empty tree, compute siblings by building the tree and extracting them
            // We'll use a recursive approach to compute the sibling at each level
            
            for (let level = 0; level < this.depth; level++) {
                const sibling = this.computeSiblingAtLevel(key, level);
                siblings.push(sibling);
            }
        }

        return {
            siblings,
            pathBits,
            root: this.root
        };
    }
    
    // Compute the sibling at a specific level for a given key
    private computeSiblingAtLevel(key: bigint, level: number): bigint {
        const pathBits = this.getPathBits(key);
        
        // Get the bit at this level (0 = left, 1 = right)
        const bit = pathBits[level];
        const siblingBit = bit === 0 ? 1 : 0;
        
        // Build the sibling key by flipping the bit at this level
        let siblingKey = key;
        if (bit === 0) {
            // Set the bit at this level
            siblingKey = key | (1n << BigInt(level));
        } else {
            // Clear the bit at this level
            siblingKey = key & ~(1n << BigInt(level));
        }
        
        // Mask off the bits above this level to get the subtree key
        const mask = (1n << BigInt(level + 1)) - 1n;
        siblingKey = siblingKey & mask;
        
        // If we're at the leaf level, check if the sibling exists
        if (level === 0) {
            return this.get(siblingKey) || 0n;
        }
        
        // For internal levels, compute the subtree root
        return this.computeSubtreeRoot(siblingKey, level);
    }
    
    // Compute the root of a subtree starting at a given key and level
    private computeSubtreeRoot(baseKey: bigint, level: number): bigint {
        if (level === 0) {
            return this.get(baseKey) || 0n;
        }
        
        // Get left and right children
        const leftKey = baseKey;
        const rightKey = baseKey | (1n << BigInt(level - 1));
        
        const leftChild = this.computeSubtreeRoot(leftKey, level - 1);
        const rightChild = this.computeSubtreeRoot(rightKey, level - 1);
        
        // If both children are 0, return the default for this level
        if (leftChild === 0n && rightChild === 0n) {
            return this.defaults[level];
        }
        
        return this.hash(leftChild, rightChild);
    }

    // Verify a non-membership proof
    verifyNonMembershipProof(key: bigint, siblings: bigint[], pathBits: number[], expectedRoot: bigint): boolean {
        let current = 0n; // Non-membership means value is 0
        
        for (let i = 0; i < this.depth; i++) {
            const sibling = siblings[i];
            const isRight = pathBits[i];
            
            let left, right;
            if (isRight === 1) {
                left = sibling;
                right = current;
            } else {
                left = current;
                right = sibling;
            }
            
            current = this.hash(left, right);
        }
        
        return current === expectedRoot;
    }
}

const poseidonHashFunc = (x: ChildNodes) => x.length == 2 ? poseidon2(x) : poseidon3(x)
function buildSpentTree(leaves: bigint[], poseidon: any) {
    const tree = new CustomSMT(poseidon, DEPTH);
    for (const k of leaves) {
        tree.add(k, 1n);
    }
    return tree;
}
import {poseidon3, poseidon2} from "poseidon-lite";
import { IndexedMerkleTree } from "@jayanth-kumar-morem/indexed-merkle-tree";

async function main() {
    const poseidon = await buildPoseidon();
    const toDec = (x: string | bigint) => BigInt(x).toString();
    let leaves: bigint[] = [];
    const results: any[] = [];

    for (let voucherIndex = 0; voucherIndex < vouchers.length; voucherIndex++) {
        const voucher = vouchers[voucherIndex];
        console.log(`\n--- Processing voucher ${voucherIndex} ---`);
        
        const nullifier_bigint = BigInt(voucher.nullifier);
        console.log(`Nullifier: ${nullifier_bigint.toString()}`);
        const imt = new IndexedMerkleTree(poseidon);
        imt.insert(BigInt(voucher.sibling_hashes[0]));
        imt.insert(BigInt(voucher.sibling_hashes[1]));
        const proof = imt.createNonMembershipProof(nullifier_bigint);

        // Build spent tree with current leaves
        // const tree = buildSpentTree(leaves, poseidon);
        // const tree = new IMT(poseidon2, 32, BigInt(0), 2);
        
        // Check if nullifier already exists
        // if (tree.has(nullifier_bigint)) {
        //     console.error(`❌ Nullifier already exists in spent tree!`);
        //     break;
        // }
        // for (const k of leaves) tree.insert(k);
        // const currRoot = tree.root;
        // console.log("currRoot", currRoot);
        // // check currRoot with on chain root   
        // // Generate non-membership proof
        // let proof = tree.createProof(nullifier_bigint);
        // const nonMembershipProof = tree.verifyProof(proof);
        // console.log("proof", proof);
        // console.log("nonMembershipProof", nonMembershipProof);
        // if(proof.membership && !nonMembershipProof) {
        //     return new Error(`Proof verification failed, proof.membership: ${proof.membership}, nonMembershipProof: ${nonMembershipProof}`);
        // }

        // tree.insert(nullifier_bigint);
        // proof = tree.createProof(nullifier_bigint);
        // console.log("proof", proof);
        // const membershipProof = tree.verifyProof(proof);
        // console.log("membershipProof", membershipProof);
        // if(!proof.membership && !membershipProof) {
        //     return new Error(`Proof verification failed proof: ${proof}, membershipProof: ${membershipProof}`);
        // }
        // Verify the proof
        // const isValid = tree.verifyNonMembershipProof(nullifier_bigint, proof.siblings, proof.pathBits, proof.root);
        // if (!isValid) {
        //     console.error(`❌ Non-membership proof verification failed!`);
        //     console.log(`Debug: Expected root ${proof.root}, tree has ${leaves.length} leaves`);
        //     // Continue anyway to see if circuit handles it
        // }
        console.log("proof", proof);
        // Prepare circuit inputs
        const input = {
            identity_nullifier: toDec(nullifier_bigint),
            membership_merke_tree_siblings: [...voucher.sibling_hashes, ...Array(20 - voucher.sibling_hashes.length).fill('0')],
            membership_merke_tree_path_indices: [...voucher.path_indices, ...Array(20 - voucher.path_indices.length).fill(0)].map(String),

            imt_query:proof.query,
            imt_pre_val: proof.preLeaf.val,
            imt_pre_next: proof.preLeaf.nextVal,
            imt_path: proof.path,
            imt_dirs: proof.directions,
            imt_root_pub: proof.root
            // spent_root: toDec(proof.root),
            // spent_siblings: [...proof.siblings.map(s => s.toString()), ...Array(256 - proof.siblings.length).fill(0)].map(String),
            // spent_path: nullifier_bigint.toString(2).padStart(256, "0").split("").reverse().map(String)
        };
        console.log(input);
        
        // Generate circuit proof
        try {
            console.log(`🔄 Generating proof for voucher ${voucherIndex}...`);
            console.log('Circuit input:', JSON.stringify(input, null, 2));
            const { proof: circuitProof, publicSignals } = await snarkjs.groth16.fullProve(
                input,
                "./circom/vote_js/vote.wasm",
                "./circom/1_0000.zkey"
            );
            
            console.log(`✅ Circuit proof generated successfully for voucher ${voucherIndex}`);
            console.log(`Membership root: ${publicSignals[0]}`);
            console.log(`New spent root: ${publicSignals[1]}`);
            
            results.push({
                voucherIndex,
                nullifier: nullifier_bigint.toString(),
                proof: circuitProof,
                publicSignals,
                membershipRoot: publicSignals[0],
                newSpentRoot: proof.root.toString().padEnd(20, "0")
            });
            
            // Add nullifier to spent leaves for next iteration
            leaves.push(nullifier_bigint);
            
        } catch (error) {
            console.error(`❌ Error generating circuit proof for voucher ${voucherIndex}:`, error);
            break;
        }
    }
    
    console.log(`\n🎉 Processing completed! Generated ${results.length} proofs.`);
    
    // Output results summary
    console.log('\n--- Results Summary ---');
    results.forEach((result, index) => {
        console.log(`Voucher ${result.voucherIndex}:`);
        console.log(`  Nullifier: ${result.nullifier.slice(0, 20)}...`);
        console.log(`  Membership Root: ${result.membershipRoot}`);
        console.log(`  New Spent Root: ${result.newSpentRoot}`);
    });
}

main().catch(console.error);