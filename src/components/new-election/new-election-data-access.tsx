'use client'

import { Program, AnchorProvider } from '@coral-xyz/anchor'
import { useConnection } from '@solana/wallet-adapter-react'
import { Connection, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'
import IDL from '../../../anchor/target/idl/zk_voting_system.json'
import type { ZkVotingSystem } from '../../../anchor/target/types/zk_voting_system'

// Program ID for ZK Voting System
const ZK_VOTING_PROGRAM_ID = new PublicKey('2VfZZTtpr8Av9W2XmnJSSc3CLRVp3RLfUcds2gi2exuy')

// Helper function to get the program instance
export function getZkVotingProgram(connection: Connection) {
  // Create a dummy provider for read-only operations
  const provider = new AnchorProvider(connection, {} as any, {})
  return new Program<ZkVotingSystem>({...IDL, address: ZK_VOTING_PROGRAM_ID.toBase58()} as ZkVotingSystem, provider)
}

// Form data types
export interface ElectionFormData {
  name: string
  description: string
  options: string[]
}

export interface ElectionFormStep {
  id: number
  title: string
  description: string
  isComplete: boolean
}

export function useNewElection() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const provider = useAnchorProvider()
  const transactionToast = useTransactionToast()

  const program = useMemo(() => {
    if (!provider) return null
    return new Program<ZkVotingSystem>({...IDL, address: ZK_VOTING_PROGRAM_ID.toBase58()} as ZkVotingSystem, provider)
  }, [provider])

  // Validate election name availability
  const checkElectionNameAvailability = async (name: string) => {
    try {
      if (!program) return false
      
      const [electionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('election'), Buffer.from(name)],
        program.programId
      )
      
      const account = await connection.getAccountInfo(electionPda)
      return account === null // Available if account doesn't exist
    } catch (error) {
      console.error('Error checking election name:', error)
      return false
    }
  }

  // Check name availability query
  const checkNameAvailability = useMutation({
    mutationKey: ['check-election-name', { cluster }],
    mutationFn: checkElectionNameAvailability,
  })

  // Create a new election
  const createElection = useMutation({
    mutationKey: ['create-election', { cluster }],
    mutationFn: async (formData: ElectionFormData) => {
      if (!program || !provider.wallet.publicKey) {
        throw new Error('Wallet not connected or program not initialized')
      }

      const { name, options } = formData
      
      // Validate inputs
      if (!name || name.length === 0 || name.length > 32) {
        throw new Error('Election name must be between 1 and 32 characters')
      }
      
      if (!options || options.length < 2 || options.length > 20) {
        throw new Error('Must have between 2 and 20 options')
      }
      
      for (const option of options) {
        if (!option || option.length === 0 || option.length > 20) {
          throw new Error('Each option must be between 1 and 20 characters')
        }
      }
      
      // Check if name is available
      const isAvailable = await checkElectionNameAvailability(name)
      if (!isAvailable) {
        throw new Error('Election name is already taken')
      }

      // Create the election - wallet will automatically sign
      await program.methods
        .initElection(name, options)
        .accounts({
          signer: provider.wallet.publicKey,
        })
        .rpc()

      return true;
    },
    onSuccess: (signature) => {
      transactionToast(signature)
      toast.success('Election created successfully!')
    },
    onError: (error) => {
      console.error('Failed to create election:', error)
      toast.error(error.message || 'Failed to create election')
    },
  })

  // Get program info for validation
  const getProgramInfo = useQuery({
    queryKey: ['program-info', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(ZK_VOTING_PROGRAM_ID),
  })

  return {
    program,
    createElection,
    checkNameAvailability,
    getProgramInfo,
  }
}
