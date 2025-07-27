import { PublicKey } from '@solana/web3.js'

// Get Program ID from environment variables
export const ZK_VOTING_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ZK_VOTING_PROGRAM_ID || '2VfZZTtpr8Av9W2XmnJSSc3CLRVp3RLfUcds2gi2exuy'
) 