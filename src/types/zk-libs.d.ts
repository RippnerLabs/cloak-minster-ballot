declare module 'snarkjs' {
  export namespace groth16 {
    export function fullProve(
      input: Record<string, string | number>,
      wasmPath: string,
      zkeyPath: string
    ): Promise<{
      proof: any
      publicSignals: string[]
    }>
  }
}

declare module 'ffjavascript' {
  export function buildBn128(): Promise<any>
  export const utils: {
    unstringifyBigInts(obj: any): any
  }
}

declare module '../../../../anchor/tests/proof_utils/pkg/proof_utils' {
  export function convert_proof(proof: Uint8Array): Uint8Array
  export default function init(): Promise<void>
} 