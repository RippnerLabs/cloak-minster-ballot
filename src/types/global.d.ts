// Global type declarations

declare module 'bs58' {
  export function encode(buffer: Buffer | Uint8Array): string;
  export function decode(string: string): Buffer;
}

declare module 'circomlibjs' {
  export function poseidon(inputs: any[]): string;
  export function buildPoseidon(): Promise<any>;
}

declare module 'ffjavascript' {
  export function buildBn128(): Promise<any>;
  export const utils: {
    unstringifyBigInts: (obj: any) => any;
  };
}

declare module 'snarkjs' {
  export const groth16: {
    fullProve: (
      input: Record<string, any>,
      wasmPath: string,
      zkeyPath: string
    ) => Promise<{
      proof: any;
      publicSignals: string[];
    }>;
  };
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