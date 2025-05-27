import {ChildNodes} from "@zk-kit/smt";
import { poseidon2, poseidon3 } from "poseidon-lite";

// @ts-ignore
export const g1Uncompressed = (curve: any, p1Raw: any) => {
    const p1 = curve.G1.fromObject(p1Raw);
    let buff = new Uint8Array(64);
    curve.G1.toRprUncompressed(buff, 0, p1);

    return Buffer.from(buff);
}

export const g2Uncompressed = (curve: any, p2Raw: any) => {
    const p2 = curve.G2.fromObject(p2Raw);
    let buff = new Uint8Array(128);
    curve.G2.toRprUncompressed(buff, 0, p2);
    return Buffer.from(buff);
}
export const toHex64Padded = (val: any) => BigInt(val).toString(16).padStart(64, "0");
export const to32ByteBuffer = (val: any) => Buffer.from(toHex64Padded(val), "hex");
export function alphaToInt(str: string): bigint {
    let res = 0n;
    const A_CODE = "A".charCodeAt(0);
    for (const ch of str.toUpperCase()) {
        res = res * 26n + BigInt(ch.charCodeAt(0) - A_CODE + 1);
    }
    return res;
}

export class CustomSMT {
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

export const DEPTH = 20;

export const hexToBig = (hex: string) =>
  BigInt(hex.startsWith("0x") ? hex : `0x${hex}`);

export const toDec = (x: string | bigint) => BigInt(x).toString();
export const posiedonHash = (x: ChildNodes) => x.length == 2 ? poseidon2(x) : poseidon3(x);
export function buildSpentTree(leaves: bigint[], poseidon: any) {
    const tree = new CustomSMT(poseidon, DEPTH);
    for (const k of leaves) {
        tree.add(k, 1n);
    }
    return tree;
}
