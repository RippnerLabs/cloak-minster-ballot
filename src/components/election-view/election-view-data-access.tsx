'use client'

import { Program, AnchorProvider } from '@coral-xyz/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey } from '@solana/web3.js'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import IDL from '../../../anchor/target/idl/zk_voting_system.json'
import type { ZkVotingSystem } from '../../../anchor/target/types/zk_voting_system'
import { ZK_VOTING_PROGRAM_ID } from '../../lib/constants'

// Helper function to get the program instance
export function getZkVotingProgram(connection: Connection) {
  const provider = new AnchorProvider(connection, {} as never, {})
  return new Program<ZkVotingSystem>({...IDL, address: ZK_VOTING_PROGRAM_ID.toBase58()} as ZkVotingSystem, provider)
}

export interface ElectionView {
  publicKey: PublicKey
  name: string
  isRegistrationOpen: boolean
  isVotingOpen: boolean
  admin: PublicKey
  options: string[]
  tallies: number[]
  merkleRoot: number[]
  nullifiersIpfsCid: string
  spentTree: number[]
  spentNullifiersIpfsCid: string
}

export function useElectionView(electionName: string) {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const provider = useAnchorProvider()

  const program = useMemo(() => {
    if (!provider) return null
    return new Program<ZkVotingSystem>({...IDL, address: ZK_VOTING_PROGRAM_ID.toBase58()} as ZkVotingSystem, provider)
  }, [provider])

  // Fetch specific election by name
  const {
    data: election,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['election-view', electionName, { cluster }],
    queryFn: async () => {
      if (!program || !electionName) return null
      
      try {
        const [electionPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('election'), Buffer.from(electionName)],
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
        } as ElectionView
      } catch (error) {
        console.error('Error fetching election by name:', error)
        return null
      }
    },
    enabled: !!program && !!electionName && electionName.length > 0,
    refetchInterval: 15000, // Refetch every 15 seconds for real-time updates
  })

  // Get election statistics
  const getElectionStats = (election: ElectionView) => {
    const totalVotes = election.tallies.reduce((sum, tally) => sum + tally, 0)
    const leadingOption = election.tallies.length > 0 
      ? election.options[election.tallies.indexOf(Math.max(...election.tallies))]
      : null

    return {
      totalVotes,
      leadingOption,
      totalOptions: election.options.length,
    }
  }

  // Get election status
  const getElectionStatus = (election: ElectionView) => {
    if (election.isRegistrationOpen) {
      return 'registration'
    } else if (election.isVotingOpen) {
      return 'voting'  
    } else {
      return 'ended'
    }
  }

  // Check if current user is admin of this election
  const isAdmin = useMemo(() => {
    if (!provider.wallet.publicKey || !election) return false
    return election.admin.equals(provider.wallet.publicKey)
  }, [election, provider.wallet.publicKey])

  return {
    program,
    election,
    isLoading,
    error,
    refetch,
    getElectionStats,
    getElectionStatus,
    isAdmin,
  }
}
