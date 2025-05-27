// Global type declarations

declare module 'bs58' {
  export function encode(buffer: Buffer | Uint8Array): string;
  export function decode(string: string): Buffer;
}

declare module '@zk-kit/smt' {
  export class SMT {
    constructor(hash: any, bitwiseAndTrue?: boolean);
    add(key: bigint, value: bigint): void;
    createProof(key: bigint): any;
    verifyProof(proof: any): boolean;
    root: bigint;
  }
  export interface ChildNodes {
    left?: any;
    right?: any;
  }
}

declare module 'merkletreejs' {
  export default class MerkleTree {
    constructor(leaves: any[], hashFunction: any, options?: any);
    getRoot(): Buffer;
    getProof(leaf: any, index?: number): any[];
  }
}

// Extend global Window interface if needed
declare global {
  interface Window {
    // Add any global window properties if needed
  }
}

export {}; 