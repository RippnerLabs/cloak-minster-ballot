'use client'

import { Program, AnchorProvider } from '@coral-xyz/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Connection, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'
import IDL from '../../../anchor/target/idl/zk_voting_system.json'
import type { ZkVotingSystem } from '../../../anchor/target/types/zk_voting_system'
import { ipfs } from '@/lib/ipfs'
import * as snarkjs from "snarkjs";
import MerkleTree from 'merkletreejs'
import {poseidon} from "circomlibjs";
import { Leaf } from 'lucide-react'
import { ZK_VOTING_PROGRAM_ID } from '../../lib/constants'

// Helper functions adapted from tests
function alphaToInt(str: string): bigint {
    let res = 0n;
    const A_CODE = "A".charCodeAt(0);
    for (const ch of str.toUpperCase()) {
        res = res * 26n + BigInt(ch.charCodeAt(0) - A_CODE + 1);
    }
    return res;
}

function toHex64Padded(val: any): string {
    return BigInt(val).toString(16).padStart(64, "0");
}

function to32ByteBuffer(val: any): Buffer {
    return Buffer.from(toHex64Padded(val), "hex");
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

export interface VoucherDownloadParams {
    secretKey: Uint8Array
    electionName: string
}

export function useVoucherManager() {
    const { cluster } = useCluster()
    const provider = useAnchorProvider()
    const { publicKey } = useWallet()
    const [isGeneratingProof, setIsGeneratingProof] = useState(false)
    const { connection } = useConnection()

    const program = useMemo(() => {
        if (!provider) return null
        return new Program<ZkVotingSystem>({ ...IDL, address: ZK_VOTING_PROGRAM_ID.toBase58() } as ZkVotingSystem, provider)
    }, [provider])

    // Fetch all elections where user might be registered
    const {
        data: availableElections,
        isLoading: electionsLoading,
        error: electionsError,
        refetch: refetchElections
    } = useQuery({
        queryKey: ['available-elections', { cluster }],
        queryFn: async () => {
            if (!program) return []

            try {
                const accounts = await program.account.election.all()

                return accounts.map((account: {
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
                console.error('Error fetching elections:', error)
                return []
            }
        },
        enabled: !!program,
        refetchInterval: 30000, // Refetch every 30 seconds
    })

    // Get leaves from IPFS (simplified version for client-side)
    const getLeavesFromIpfs = async (cid: string): Promise<string[]> => {
        try {
            // In a real implementation, you'd use IPFS gateway or client
            // For now, we'll simulate this or use a gateway
            const response = await ipfs.get(cid);
            let dataStr = "";
            for await (const chunk of response) {
                // Check if chunk is a file (has content property)
                if ('content' in chunk && chunk.content) {
                    for await (const data of chunk.content) {
                        dataStr += new TextDecoder().decode(data);
                    }
                }
            }
            const data = JSON.parse(dataStr);
            return data.leaves || []
        } catch (error) {
            console.error('Error fetching leaves from IPFS:', error)
            throw new Error('Failed to fetch voter registration data from IPFS')
        }
    }

    // Generate ZK proof (simplified - in real implementation would use snarkjs)
    const generateZKProof = async (secretKey: Uint8Array, electionName: string) => {
        setIsGeneratingProof(true)
        try {
            // Simulate proof generation
            await new Promise(resolve => setTimeout(resolve, 2000))

            const secretKeyBigInt = BigInt('0x' + Buffer.from(secretKey).toString('hex'))
            const electionIdBigInt = alphaToInt(electionName)

            const {proof, publicSignals} = await snarkjs.groth16.fullProve(
                    {
                        identity_secret: secretKeyBigInt.toString(),
                        election_id: electionIdBigInt.toString(),
                    },
                    '/zk/identity_nullifier/identity_nullifier.wasm',
                    '/zk/identity_nullifier/1_0000.zkey'
                )
            return {proof, publicSignals}
        } finally {
            setIsGeneratingProof(false)
        }
    }

    // Create Merkle witness (simplified)
    const createMerkleWitness = (leaves: string[], nullifier: string, treeDepth: number = 20) => {
        const index = leaves.indexOf(nullifier)
        if (index === -1) {
            throw new Error('You are not registered for this election')
        }
        const tree = new MerkleTree(leaves, poseidon, {hashLeaves: false, sort: true});
        const proof = tree.getProof(nullifier, index);
        let siblings_hashes = proof.map(p => '0x' + p.data.toString('hex'));
        let path_indices = proof.map(p => (p.position == "left") ? 0 : 1);
        while (siblings_hashes.length < 20) {
            siblings_hashes.push("0");
        }
        while ( path_indices.length < 20) {
            path_indices.push(0);
        }
        return {siblings_hashes, path_indices, root: tree.getRoot(), index};
    }

    // Download voucher mutation
    const downloadVoucher = useMutation({
        mutationKey: ['download-voucher', { cluster }],
        mutationFn: async ({ secretKey, electionName }: VoucherDownloadParams): Promise<VoucherData> => {
            if (!program) {
                throw new Error('Program not initialized')
            }

            // Get election account
            const [electionAccountAddr] = PublicKey.findProgramAddressSync(
                [Buffer.from("election"), Buffer.from(electionName)],
                program.programId
            )

            const electionAccount = await program.account.election.fetch(electionAccountAddr)

            if (!electionAccount.nullifiersIpfsCid || electionAccount.nullifiersIpfsCid.length !== 46) {
                throw new Error('No voter registration data found for this election')
            }

            // Generate ZK proof
            const {proof, publicSignals} = await generateZKProof(secretKey, electionName)
            const identityNullifier = "0x" + to32ByteBuffer(BigInt(publicSignals[0])).toString('hex');


            // Get leaves from IPFS
            const leaves = await getLeavesFromIpfs(electionAccount.nullifiersIpfsCid)

            // Create Merkle witness
            const {siblings_hashes, path_indices, root, index} = createMerkleWitness(leaves, identityNullifier)
            const voucher: VoucherData = {
                election: alphaToInt(electionName),
                leaf_index: index,
                nullifier: leaves[index],
                merkle_root: "0x" + root.toString("hex"),
                sibling_hashes: siblings_hashes,
                path_indices: path_indices,
                electionName,
                generatedAt: new Date()
            }

            console.log("voucher", voucher);
            return voucher
        },
        onSuccess: (voucher) => {
            toast.success(`Voucher generated successfully for "${voucher.electionName}"`)
        },
        onError: (error) => {
            console.error('Failed to download voucher:', error)
            toast.error(error.message || 'Failed to generate voucher')
        },
    })

    // Get election by name
    const getElectionByName = (name: string): Election | null => {
        if (!availableElections) return null
        
        // Decode the name from URL encoding
        const decodedName = decodeURIComponent(name)
        
        return availableElections.find(election => 
            election.name.toLowerCase() === decodedName.toLowerCase()
        ) || null
    }

    // Check if user can download voucher for election
    const canDownloadVoucher = (election: Election): boolean => {
        // Can only download voucher if registration is closed and voting is open
        return !election.isRegistrationOpen && election.isVotingOpen
    }

    // Get election status for voucher eligibility
    const getElectionStatus = (election: Election): 'not-started' | 'registration' | 'voting' | 'ended' => {
        if (election.isRegistrationOpen) return 'registration'
        if (election.isVotingOpen) return 'voting'
        return 'ended'
    }

    // Validate secret key format
    const validateSecretKey = (secretKey: Uint8Array): boolean => {
        console.log(
            "secretKey.length", secretKey.length
        )
        return secretKey.length === 64
    }

    // Export voucher to JSON
    const exportVoucherToJSON = (voucher: VoucherData): string => {
        return JSON.stringify({...voucher, election: voucher.election.toString()}, null, 2)
    }

    // Import secret key from file
    const importSecretKeyFromFile = (file: File): Promise<Uint8Array> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string
                    const secretKey = new Uint8Array(JSON.parse(content))
                    if (!validateSecretKey(secretKey)) {
                        reject(new Error('Invalid secret key format'))
                    }
                    resolve(secretKey)
                } catch (error) {
                    reject(new Error('Failed to parse secret key file'))
                }
            }
            reader.onerror = () => reject(new Error('Failed to read file'))
            reader.readAsText(file)
        })
    }

    return {
        program,
        availableElections: availableElections || [],
        electionsLoading,
        electionsError,
        refetchElections,
        downloadVoucher,
        getElectionByName,
        canDownloadVoucher,
        getElectionStatus,
        validateSecretKey,
        exportVoucherToJSON,
        importSecretKeyFromFile,
        isGeneratingProof,
    }
}
