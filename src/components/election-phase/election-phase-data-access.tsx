'use client'

import { Program, AnchorProvider } from '@coral-xyz/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'
import IDL from '../../../anchor/target/idl/zk_voting_system.json'
import type { ZkVotingSystem } from '../../../anchor/target/types/zk_voting_system'
import { ZK_VOTING_PROGRAM_ID } from '../../lib/constants'

// Helper function to get the program instance
export function getZkVotingProgram(connection: Connection) {
  const provider = new AnchorProvider(connection, {} as never, {})
  return new Program<ZkVotingSystem>({...IDL, address: ZK_VOTING_PROGRAM_ID.toBase58()} as ZkVotingSystem, provider)
}

export interface ElectionPhase {
  name: string
  isRegistrationOpen: boolean
  isVotingOpen: boolean
  admin: PublicKey
  publicKey: PublicKey
  options: string[]
  tallies: number[]
  merkleRoot: number[]
  nullifiersIpfsCid: string
  spentTree: number[]
  spentNullifiersIpfsCid: string
}

export function useElectionPhaseManager() {
  const { cluster } = useCluster()
  const provider = useAnchorProvider()
  const { publicKey } = useWallet()
  const transactionToast = useTransactionToast()

  const program = useMemo(() => {
    if (!provider) return null
    return new Program<ZkVotingSystem>({...IDL, address: ZK_VOTING_PROGRAM_ID.toBase58()} as ZkVotingSystem, provider)
  }, [provider])

  // Fetch all elections that the current user is admin of
  const {
    data: adminElections,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['admin-elections', publicKey?.toString(), { cluster }],
    queryFn: async () => {
      if (!publicKey || !program) return []
      
      try {
        const accounts = await program.account.election.all()
        const adminElections = accounts.filter((account: { account: { admin: PublicKey } }) => 
          account.account.admin.equals(publicKey)
        )
        
        return adminElections.map((account: { 
          publicKey: PublicKey;
          account: {
            name: string;
            isRegistrationOpen: boolean;
            isVotingOpen: boolean;
            admin: PublicKey;
            options: string[];
            tallies: { toNumber(): number }[];
            merkleRoot: number[];
            nullifiersIpfsCid: string;
            spentTree: number[];
            spentNullifiersIpfsCid: string;
          }
        }) => ({
          publicKey: account.publicKey,
          name: account.account.name,
          isRegistrationOpen: account.account.isRegistrationOpen,
          isVotingOpen: account.account.isVotingOpen,
          admin: account.account.admin,
          options: account.account.options,
          tallies: account.account.tallies?.map((t) => t.toNumber()) || [],
          merkleRoot: account.account.merkleRoot,
          nullifiersIpfsCid: account.account.nullifiersIpfsCid,
          spentTree: account.account.spentTree,
          spentNullifiersIpfsCid: account.account.spentNullifiersIpfsCid,
        }))
      } catch (error) {
        console.error('Error fetching admin elections:', error)
        return []
      }
    },
    enabled: !!publicKey && !!program,
    refetchInterval: 10000, // Refetch every 10 seconds for real-time updates
  })

  // Get a specific election by name
  const getElectionByName = async (name: string) => {
    if (!program) return null
    
    try {
      const [electionPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('election'), Buffer.from(name)],
        program.programId
      )
      
      const account = await program.account.election.fetch(electionPda)
      return {
        publicKey: electionPda,
        name: account.name,
        isRegistrationOpen: account.isRegistrationOpen,
        isVotingOpen: account.isVotingOpen,
        admin: account.admin,
        options: account.options,
        tallies: account.tallies?.map((t: { toNumber(): number }) => t.toNumber()) || [],
        merkleRoot: account.merkleRoot,
        nullifiersIpfsCid: account.nullifiersIpfsCid,
        spentTree: account.spentTree,
        spentNullifiersIpfsCid: account.spentNullifiersIpfsCid,
      }
    } catch (error) {
      console.error('Error fetching election by name:', error)
      return null
    }
  }

  // Close registration and open voting (based on the test file pattern)
  const closeRegistration = useMutation({
    mutationKey: ['close-registration', { cluster }],
    mutationFn: async (electionName: string) => {
      if (!program || !provider.wallet.publicKey) {
        throw new Error('Wallet not connected or program not initialized')
      }

      // Validate the election exists and user is admin
      const election = await getElectionByName(electionName)
      if (!election) {
        throw new Error('Election not found')
      }
      
      if (!election.admin.equals(provider.wallet.publicKey)) {
        throw new Error('Only the election admin can close registration')
      }

      if (!election.isRegistrationOpen) {
        throw new Error('Registration is already closed')
      }

      // Call the closeRegistration method (which also opens voting)
      return await program.methods
        .closeRegistration(electionName)
        .accounts({
          signer: provider.wallet.publicKey,
        })
        .rpc()
    },
    onSuccess: (signature) => {
      transactionToast(signature)
      toast.success('Registration closed and voting opened successfully!')
      refetch()
    },
    onError: (error) => {
      console.error('Failed to close registration:', error)
      toast.error(error.message || 'Failed to close registration')
    },
  })

  // Conclude election and close voting
  const concludeElection = useMutation({
    mutationKey: ['conclude-election', { cluster }],
    mutationFn: async (electionName: string) => {
      if (!program || !provider.wallet.publicKey) {
        throw new Error('Wallet not connected or program not initialized')
      }

      // Validate the election exists and user is admin
      const election = await getElectionByName(electionName)
      if (!election) {
        throw new Error('Election not found')
      }
      
      if (!election.admin.equals(provider.wallet.publicKey)) {
        throw new Error('Only the election admin can conclude the election')
      }

      if (!election.isVotingOpen) {
        throw new Error('Election is not in voting phase')
      }

      if (election.isRegistrationOpen) {
        throw new Error('Cannot conclude election while registration is still open')
      }

      // Call the concludeElection method
      return await program.methods
        // @ts-ignore
        .concludeElection(Buffer.from(electionName))
        .accounts({
          signer: provider.wallet.publicKey,
        })
        .rpc()
    },
    onSuccess: (signature) => {
      transactionToast(signature)
      toast.success('Election concluded successfully!')
      refetch()
    },
    onError: (error) => {
      console.error('Failed to conclude election:', error)
      toast.error(error.message || 'Failed to conclude election')
    },
  })

  // Check if user can manage a specific election
  const canManageElection = (election: ElectionPhase): boolean => {
    return !!publicKey && election.admin.equals(publicKey)
  }

  // Get election status
  const getElectionStatus = (election: ElectionPhase): 'registration' | 'voting' | 'ended' => {
    if (election.isRegistrationOpen) return 'registration'
    if (election.isVotingOpen) return 'voting'
    return 'ended'
  }

  // Get election statistics
  const getElectionStats = (election: ElectionPhase) => {
    const totalVotes = election.tallies.reduce((sum, tally) => sum + tally, 0)
    const leadingOption = election.tallies.length > 0 
      ? election.options[election.tallies.indexOf(Math.max(...election.tallies))]
      : null

    return {
      totalVotes,
      leadingOption,
      totalOptions: election.options.length,
      totalRegistered: 0, // This would need additional tracking in the contract
    }
  }

  // Validate if phase transition is allowed
  const canTransitionPhase = (election: ElectionPhase, targetPhase: 'registration' | 'voting' | 'ended'): boolean => {
    const currentStatus = getElectionStatus(election)
    
    // Can only transition from registration to voting
    if (currentStatus === 'registration' && targetPhase === 'voting') {
      return true
    }
    
    // Can transition from voting to ended
    if (currentStatus === 'voting' && targetPhase === 'ended') {
      return true
    }
    
    // Once voting starts or ends, can't go back
    return false
  }

  return {
    program,
    adminElections: adminElections || [],
    isLoading,
    error,
    refetch,
    getElectionByName,
    closeRegistration,
    concludeElection,
    canManageElection,
    getElectionStatus,
    getElectionStats,
    canTransitionPhase,
  }
}
