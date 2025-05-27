'use client'

import { Program, AnchorProvider, utils } from '@coral-xyz/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'
import IDL from '../../../anchor/target/idl/zk_voting_system.json'
import type { ZkVotingSystem } from '../../../anchor/target/types/zk_voting_system'
import { ipfs } from '@/lib/ipfs'
import * as snarkjs from "snarkjs"
import * as ff from "ffjavascript"
import { VoucherData } from '@/types'
import { g2Uncompressed, hexToBig, to32ByteBuffer } from '@/lib/utils'
import { SMT } from '@zk-kit/smt'
import { g1Uncompressed, posiedonHash, toDec } from 'anchor/tests/utils'
import * as proofUtils from "proofUtils";
// Program ID for ZK Voting System
const ZK_VOTING_PROGRAM_ID = new PublicKey('2VfZZTtpr8Av9W2XmnJSSc3CLRVp3RLfUcds2gi2exuy')
const TREE_DEPTH = 20

// Helper functions
function alphaToInt(str: string): bigint {
    let res = 0n;
    const A_CODE = "A".charCodeAt(0);
    for (const ch of str.toUpperCase()) {
        res = res * 26n + BigInt(ch.charCodeAt(0) - A_CODE + 1);
    }
    return res;
}

export interface Election {
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

export interface VoteSubmissionData {
    electionName: string
    selectedOption: string
    voucher: VoucherData
    transactionSignature?: string
}

export function useVoteManager() {
    const { cluster } = useCluster()
    const provider = useAnchorProvider()
    const { connection } = useConnection()
    const { publicKey } = useWallet()
    const transactionToast = useTransactionToast()
    const [isGeneratingProof, setIsGeneratingProof] = useState(false)
    const [isSubmittingVote, setIsSubmittingVote] = useState(false)

    const program = useMemo(() => {
        if (!provider) return null
        return new Program<ZkVotingSystem>({ ...IDL, address: ZK_VOTING_PROGRAM_ID.toBase58() } as ZkVotingSystem, provider)
    }, [provider])

    // Fetch election by name
    const getElectionByName = useQuery({
        queryKey: ['election-by-name', cluster],
        queryFn: async ({ queryKey }) => {
            const [, , electionName] = queryKey as [string, string, string]
            if (!program || !electionName) return null

            try {
                const [electionAccountAddr] = PublicKey.findProgramAddressSync(
                    [Buffer.from("election"), Buffer.from(electionName)],
                    program.programId
                )

                const electionAccount = await program.account.election.fetch(electionAccountAddr)

                return {
                    publicKey: electionAccountAddr,
                    name: electionAccount.name,
                    isRegistrationOpen: electionAccount.isRegistrationOpen,
                    isVotingOpen: electionAccount.isVotingOpen,
                    admin: electionAccount.admin,
                    options: electionAccount.options,
                    tallies: electionAccount.tallies?.map((t: any) => t.toNumber()) || [],
                    merkleRoot: electionAccount.merkleRoot,
                    nullifiersIpfsCid: electionAccount.nullifiersIpfsCid,
                    spentTree: electionAccount.spentTree,
                    spentNullifiersIpfsCid: electionAccount.spentNullifiersIpfsCid,
                } as Election
            } catch (error) {
                console.error('Error fetching election:', error)
                return null
            }
        },
        enabled: false, // Will be enabled when election name is provided
    })

    // Fetch all elections for selection
    const {
        data: availableElections,
        isLoading: electionsLoading,
        error: electionsError,
        refetch: refetchElections
    } = useQuery({
        queryKey: ['voting-elections', { cluster }],
        queryFn: async () => {
            if (!program) return []

            try {
                const accounts = await program.account.election.all()

                return accounts
                    .map((account: any) => ({
                        publicKey: account.publicKey,
                        name: account.account.name,
                        isRegistrationOpen: account.account.isRegistrationOpen,
                        isVotingOpen: account.account.isVotingOpen,
                        admin: account.account.admin,
                        options: account.account.options,
                        tallies: account.account.tallies?.map((t: any) => t.toNumber()) || [],
                        merkleRoot: account.account.merkleRoot,
                        nullifiersIpfsCid: account.account.nullifiersIpfsCid,
                        spentTree: account.account.spentTree,
                        spentNullifiersIpfsCid: account.account.spentNullifiersIpfsCid,
                    }))
                    .filter((election: Election) => election.isVotingOpen && !election.isRegistrationOpen)
            } catch (error) {
                console.error('Error fetching elections:', error)
                return []
            }
        },
        enabled: !!program,
        refetchInterval: 30000,
    })

    // Validate voucher
    const validateVoucher = (voucher: VoucherData, electionName: string): boolean => {
        try {
            // Basic validation
            if (!voucher.nullifier || !voucher.merkle_root || !voucher.sibling_hashes || !voucher.path_indices) {
                return false
            }

            // Check if voucher is for the correct election
            const expectedElectionId = alphaToInt(electionName)
            const voucherElectionId = typeof voucher.election === 'string' ? BigInt(voucher.election) : voucher.election

            return expectedElectionId === voucherElectionId
        } catch (error) {
            console.error('Error validating voucher:', error)
            return false
        }
    }

    // Import voucher from file
    const importVoucherFromFile = (file: File): Promise<VoucherData> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string
                    const voucher = JSON.parse(content) as VoucherData

                    // Convert election to bigint if it's a string
                    if (typeof voucher.election === 'string') {
                        voucher.election = BigInt(voucher.election)
                    }

                    resolve(voucher)
                } catch (error) {
                    reject(new Error('Failed to parse voucher file'))
                }
            }
            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.readAsText(file)
        })
    }

    // Submit vote mutation
    const submitVote = useMutation({
        mutationKey: ['submit-vote', { cluster }],
        mutationFn: async ({ electionName, selectedOption, voucher }: {
            electionName: string
            selectedOption: string
            voucher: VoucherData
        }): Promise<VoteSubmissionData> => {
            if (!program || !publicKey) {
                throw new Error('Program not initialized or wallet not connected')
            }

            setIsSubmittingVote(true)
            setIsGeneratingProof(true)

            try {
                // Get current election
                const [electionAccountAddress] = PublicKey.findProgramAddressSync(
                    [Buffer.from("election"), Buffer.from(electionName)],
                    program.programId
                )

                const currentElection = await program.account.election.fetch(electionAccountAddress)

                // Get spent leaves from IPFS (simplified for development)
                let spent_leaves: string[] = []
                let spent_leaves_bigints: bigint[] = []

                if (currentElection.spentNullifiersIpfsCid) {
                    try {
                        const response = await ipfs.get(currentElection.spentNullifiersIpfsCid)
                        let dataStr = ""
                        for await (const chunk of response) {
                            if ('content' in chunk && chunk.content) {
                                for await (const data of chunk.content) {
                                    dataStr += new TextDecoder().decode(data)
                                }
                            }
                        }
                        const data = JSON.parse(dataStr)
                        spent_leaves = data.spentLeaves || []
                        spent_leaves_bigints = spent_leaves.map(hexToBig)
                    } catch (error) {
                        console.warn('Could not fetch spent leaves from IPFS, assuming empty tree')
                    }
                }

                // Create SMT for spent nullifiers
                const tree = new SMT(posiedonHash, true)
                for (const l of spent_leaves_bigints) {
                    tree.add(l, 1n)
                }
                for (const l of spent_leaves_bigints) tree.add(l, 1n);
                const currRoot = tree.root;
                if (currRoot.toString() == currentElection.spentTree.toString()) {
                    throw new Error(`Computed Root and On Chain Root, doesnt match, currRoot: ${currRoot}, currentElection.spentTree: ${currentElection.spentTree.toString()}`)
                }
                const nullifier_bigint = BigInt(voucher.nullifier);
                let proof = tree.createProof(nullifier_bigint);
                const nonMembershipProof = tree.verifyProof(proof);
                if (proof.membership && !nonMembershipProof) {
                    throw new Error(`Proof verification failed, proof.membership: ${proof.membership}, nonMembershipProof: ${nonMembershipProof}`);
                }

                tree.add(nullifier_bigint, 1n);
                proof = tree.createProof(nullifier_bigint);
                const membershipProof = tree.verifyProof(proof);
                if (!proof.membership && !membershipProof) {
                    throw new Error(`Proof verification failed proof: ${proof}, membershipProof: ${membershipProof}`);
                }
                const new_spent_root = to32ByteBuffer(BigInt(tree.root));

                const circuitInputs: Record<string, string | number> = {
                    identity_nullifier: toDec(nullifier_bigint),
                    membership_merke_tree_siblings: [...voucher.sibling_hashes, ...Array(20 - voucher.sibling_hashes.length).fill('0')],
                    membership_merke_tree_path_indices: [...voucher.path_indices, ...Array(20 - voucher.path_indices.length).fill(0)].map(String),
                }
                const {proof:circuitProof, publicSignals} = await snarkjs.groth16.fullProve(circuitInputs,
                    "/zk/vote/vote.wasm",
                    "/zk/vote/1_0000.zkey"
                )
                setIsGeneratingProof(false)

                console.log(circuitProof, publicSignals);
                const proofProc = await ff.utils.unstringifyBigInts(circuitProof);
                const curve = await ff.buildBn128();
                let proofA = g1Uncompressed(curve, proofProc.pi_a);
                proofA = proofUtils.convert_proof(proofA);
                const proofB = g2Uncompressed(curve, proofProc.pi_b);
                const proofC = g1Uncompressed(curve, proofProc.pi_c);
                
                const membership_merkle_root = to32ByteBuffer(BigInt(publicSignals[0]))

                // Update spent leaves and upload to IPFS
                const spent_leaves_hex = spent_leaves.map(l => Buffer.from(l.replace(/^0x/, ''), 'hex'))
                spent_leaves_hex.push(Buffer.from(voucher.nullifier.replace(/^0x/, ""), 'hex'))

                const file = JSON.stringify({
                    depth: TREE_DEPTH,
                    spentLeaves: spent_leaves_hex.map(l => "0x" + l.toString('hex'))
                })

                const { cid } = await ipfs.add({ content: file })


                // Create and submit transaction with proper types
                const sign = await program.methods
                    .vote(
                        Buffer.from(electionName),
                        proofA,
                        proofB,
                        proofC,
                        membership_merkle_root,
                        new_spent_root,
                        Buffer.from(cid.toString()),
                        Buffer.from(selectedOption)
                    )
                    .accounts({
                        signer: publicKey,
                        program: program.programId,
                    })
                    .rpc();

                const txData = await provider.connection.getTransaction(sign);
                const eventIx = txData.meta?.innerInstructions[0].instructions[0];
                const rawData = utils.bytes.bs58.decode(eventIx?.data);
                const base64Data = utils.bytes.base64.encode(rawData.subarray(8));
                const event = program.coder.events.decode(base64Data);
                
                return {
                    electionName,
                    selectedOption,
                    voucher,
                    transactionSignature: sign
                }

            } finally {
                setIsSubmittingVote(false)
                setIsGeneratingProof(false)
            }
        },
        onSuccess: (data) => {
            toast.success(`Vote submitted successfully for "${data.electionName}"`)
            if (data.transactionSignature) {
                transactionToast(data.transactionSignature)
            }
        },
        onError: (error) => {
            console.error('Failed to submit vote:', error)
            toast.error(error.message || 'Failed to submit vote')
        },
    })

    // Get election status for voting eligibility
    const getElectionStatus = (election: Election): 'not-started' | 'registration' | 'voting' | 'ended' => {
        if (election.isRegistrationOpen) return 'registration'
        if (election.isVotingOpen) return 'voting'
        return 'ended'
    }

    // Check if election is eligible for voting
    const canVoteInElection = (election: Election): boolean => {
        return election.isVotingOpen && !election.isRegistrationOpen
    }

    return {
        program,
        availableElections: availableElections || [],
        electionsLoading,
        electionsError,
        refetchElections,
        getElectionByName: (name: string) => {
            // Properly refetch with new parameters
            return getElectionByName.refetch().then(() => getElectionByName.data)
        },
        validateVoucher,
        importVoucherFromFile,
        submitVote,
        getElectionStatus,
        canVoteInElection,
        isGeneratingProof,
        isSubmittingVote,
    }
}
