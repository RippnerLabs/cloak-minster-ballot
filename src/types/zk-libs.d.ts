declare module '../../../../anchor/tests/proof_utils/pkg/proof_utils' {
  export function convert_proof(proof: Uint8Array): Uint8Array
  export default function init(): Promise<void>
} 