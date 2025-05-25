'use client'

import { Program, AnchorProvider, BN } from '@coral-xyz/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Cluster, PublicKey, Connection } from '@solana/web3.js'
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

export interface Election {
  admin: PublicKey
  name: string
  isRegistrationOpen: boolean
  isVotingOpen: boolean
  merkleRoot: number[]
  nullifiersIpfsCid: string
  spentTree: number[]
  spentNullifiersIpfsCid: string
  options: string[]
  tallies: BN[]
}

export interface ElectionAccount {
  name: string
  description: string
  admin: PublicKey
  // startTime: number
  // endTime: number
  // totalVotes: number
  isActive: boolean
  candidates: string[]
}

export interface ElectionWithKey extends Election {
  publicKey: PublicKey;
}

export function useZkVotingProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const provider = useAnchorProvider()
  const transactionToast = useTransactionToast()

  const program = useMemo(() => {
    return getZkVotingProgram(connection)
  }, [connection])

  const {
    data: elections,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['zk-voting-elections'],
    queryFn: async () => {
      try {
        const accounts = await program.account.election.all()
        return accounts.map((account: any) => ({
          publicKey: account.publicKey,
          account: {
            ...account.account,
            // startTime: account.account.startTime.toNumber(),
            // endTime: account.account.endTime.toNumber(),
            // totalVotes: account.account.totalVotes.toNumber(),
          }
        }))
      } catch (error) {
        console.error('Error fetching elections:', error)
        throw error
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const getElectionByName = async (name: string) => {
    try {
      const accounts = await program.account.election.all([
        {
          memcmp: {
            offset: 8, // Skip discriminator
            bytes: name,
          }
        }
      ])
      return accounts[0] || null
    } catch (error) {
      console.error('Error fetching election by name:', error)
      return null
    }
  }

  // Initialize a new election
  const initializeElection = useMutation({
    mutationKey: ['zk-voting', 'initialize-election', { cluster }],
    mutationFn: async ({ name, options }: { name: string; options: string[] }) => {
      return program.methods
        .initElection(name, options)
        .accounts({
          signer: provider.wallet.publicKey,
        })
        .rpc()
    },
    onSuccess: (signature) => {
      transactionToast(signature)
      refetch()
    },
    onError: (error) => {
      console.error('Failed to initialize election:', error)
      toast.error('Failed to initialize election')
    },
  })

  // Close registration for an election
  const closeRegistration = useMutation({
    mutationKey: ['zk-voting', 'close-registration', { cluster }],
    mutationFn: async (name: string) => {
      return program.methods
        .closeRegistration(name)
        .accounts({
          signer: provider.wallet.publicKey,
        })
        .rpc()
    },
    onSuccess: (signature) => {
      transactionToast(signature)
      refetch()
    },
    onError: (error) => {
      console.error('Failed to close registration:', error)
      toast.error('Failed to close registration')
    },
  })

  // Get program info
  const getProgramAccount = useQuery({
    queryKey: ['zk-voting', 'program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(program.programId),
  })

  // Get admin elections (elections where current wallet is admin)
  const adminElections = useMemo(() => {
    if (!provider.wallet.publicKey || !elections) return []
    return elections.filter((election: any) => 
      election.account.admin.equals(provider.wallet.publicKey)
    )
  }, [elections, provider.wallet.publicKey])

  // Get election statistics
  const getElectionStats = (election: any) => {
    const totalVotes = election.account.tallies?.reduce((sum: any, tally: any) => sum + tally.toNumber(), 0) || 0
    const talliesAsNumbers = election.account.tallies?.map((t: any) => t.toNumber()) || []
    const leadingOption = election.account.tallies?.length > 0 
      ? election.account.options[talliesAsNumbers.indexOf(Math.max(...talliesAsNumbers))]
      : null

    return {
      totalVotes,
      leadingOption,
      totalOptions: election.account.options?.length || 0,
      status: election.account.isRegistrationOpen 
        ? 'Registration Open' 
        : election.account.isVotingOpen 
          ? 'Voting Open' 
          : 'Ended'
    }
  }

  return {
    program,
    programId: program.programId,
    elections: elections || [],
    isLoading,
    error,
    refetch,
    adminElections,
    getElectionByName,
    initializeElection,
    closeRegistration,
    getProgramAccount,
    getElectionStats,
  }
}