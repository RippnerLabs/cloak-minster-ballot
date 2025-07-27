'use client'

import { Program, AnchorProvider, utils } from '@coral-xyz/anchor'
import { useConnection } from '@solana/wallet-adapter-react'
import { Connection, PublicKey, Keypair } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../use-transaction-toast'
import { toast } from 'sonner'
import IDL from '../../../anchor/target/idl/zk_voting_system.json'
import type { ZkVotingSystem } from '../../../anchor/target/types/zk_voting_system'
import { alphaToInt, to32ByteBuffer, g1Uncompressed, g2Uncompressed } from '@/lib/utils'
import MerkleTree from 'merkletreejs'
import { ipfs } from "@/lib/ipfs";
import { ZKProof } from "@/types";
import { ZK_VOTING_PROGRAM_ID } from '../../lib/constants'

// Dynamic imports for snarkjs and other ZK dependencies
const loadSnarkjs = async () => {
    if (typeof window === 'undefined') return null
    try {
        // @ts-ignore: No type declarations for this dynamic import
        const snarkjs = (await import('snarkjs')) as any
        return snarkjs
    } catch (error) {
        console.error('Failed to load snarkjs build:', error)
        return null
    }
}

const loadFFjavascript = async () => {
    if (typeof window === 'undefined') return null
    try {
        // @ts-ignore: No type declarations for this dynamic import
        const ff = (await import('ffjavascript')) as any
        return ff
    } catch (error) {
        console.error('Failed to load ffjavascript build:', error)
        return null
    }
}

const loadCircomlibjs = async () => {
    if (typeof window === 'undefined') return null
    try {
        const circomlibjs = (await import('circomlibjs')) as any
        return circomlibjs
    } catch (error) {
        console.error('Failed to load circomlibjs build:', error)
        return null
    }
}

const loadProofUtils = async () => {
    if (typeof window === 'undefined') return null
    try {
        // First ensure TextDecoder/TextEncoder are available globally
        if (typeof TextDecoder === 'undefined') {
            const { TextDecoder: TDPolyfill, TextEncoder: TEPolyfill } = await import('text-encoding')
            // @ts-ignore
            global.TextDecoder = TDPolyfill
            // @ts-ignore
            global.TextEncoder = TEPolyfill
            // @ts-ignore
            window.TextDecoder = TDPolyfill
            // @ts-ignore
            window.TextEncoder = TEPolyfill
        }
        
        // Simple approach: try the direct import first
        try {
            const proofUtils = await import('proofUtils')
            return proofUtils
        } catch (directError) {
            console.log('Direct import failed, trying alternative method:', directError)
        }
    } catch (error) {
        console.error('Failed to load proof utils:', error)
        return null
    }
}

// Types for registration process
export interface RegistrationFormData {
    electionName: string
    generatedSecret?: Uint8Array
}

export interface RegistrationStep {
    id: number
    title: string
    description: string
    isComplete: boolean
}

// Helper function to get the program instance
export function getZkVotingProgram(connection: Connection) {
    const provider = new AnchorProvider(connection, {} as any, {})
    return new Program<ZkVotingSystem>({ ...IDL, address: ZK_VOTING_PROGRAM_ID.toBase58() } as ZkVotingSystem, provider)
}

export function useRegisterVoter() {
    const { connection } = useConnection()
    const { cluster } = useCluster()
    const provider = useAnchorProvider()
    const transactionToast = useTransactionToast()
    const [currentStep, setCurrentStep] = useState(1)
    const [registrationData, setRegistrationData] = useState<RegistrationFormData>({
        electionName: '',
        generatedSecret: undefined
    })
    const [zkProof, setZkProof] = useState<ZKProof | null>(null)
    const [isGeneratingProof, setIsGeneratingProof] = useState(false)
    const [isGeneratingSecret, setIsGeneratingSecret] = useState(false)

    const program = useMemo(() => {
        if (!provider) return null
        return new Program<ZkVotingSystem>({ ...IDL, address: ZK_VOTING_PROGRAM_ID.toBase58() } as ZkVotingSystem, provider)
    }, [provider])

    // Get available elections
    const getElections = useQuery({
        queryKey: ['elections', { cluster }],
        queryFn: async () => {
            if (!program) return []

            try {
                const accounts = await program.account.election.all()
                return accounts.map(account => ({
                    address: account.publicKey.toBase58(),
                    name: account.account.name,
                    isRegistrationOpen: account.account.isRegistrationOpen,
                    isVotingOpen: account.account.isVotingOpen,
                    admin: account.account.admin.toBase58()
                }))
            } catch (error) {
                console.error('Error fetching elections:', error)
                return []
            }
        },
    })

    // Generate new secret key
    const generateSecret = useMutation({
        mutationKey: ['generate-secret', { cluster }],
        mutationFn: async () => {
            setIsGeneratingSecret(true)

            try {
                // Generate a new keypair and use its secret key
                const newKeypair = Keypair.generate()
                const secretKey = newKeypair.secretKey

                console.log('Generated new secret key for voter registration')

                setRegistrationData(prev => ({ ...prev, generatedSecret: secretKey }))
                return secretKey
            } catch (error) {
                console.error('Error generating secret:', error)
                throw new Error('Failed to generate secret key')
            } finally {
                setIsGeneratingSecret(false)
            }
        },
        onSuccess: () => {
            toast.success('Secret key generated successfully!')
            setCurrentStep(2) // Move to proof generation step
        },
        onError: (error) => {
            console.error('Failed to generate secret:', error)
            toast.error(error.message || 'Failed to generate secret key')
            setIsGeneratingSecret(false)
        },
    })

    // Generate ZK proof using real snarkjs
    const generateProof = useMutation({
        mutationKey: ['generate-proof', { cluster }],
        mutationFn: async ({ electionName }: { electionName: string }) => {
            if (!registrationData.generatedSecret) {
                throw new Error('Secret key not generated')
            }

            setIsGeneratingProof(true)

            try {
                // Load ZK libraries
                const snarkjs = await loadSnarkjs()
                const ff = await loadFFjavascript()
                const circomlibjs = await loadCircomlibjs()
                const proofUtils = await loadProofUtils()

                if (!snarkjs || !ff || !circomlibjs || !proofUtils) {
                    throw new Error('Failed to load ZK libraries')
                }

                // Convert secret to BigInt
                const secretKeyBigInt = BigInt('0x' + Buffer.from(registrationData.generatedSecret).toString('hex'))
                const electionIdBigInt = alphaToInt(electionName)

                console.log('Generating ZK proof with snarkjs...')
                console.log('Election ID:', electionIdBigInt.toString())

                // Generate proof using snarkjs with public files
                const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                    {
                        identity_secret: secretKeyBigInt.toString(),
                        election_id: electionIdBigInt.toString(),
                    },
                    '/zk/identity_nullifier/identity_nullifier.wasm',
                    '/zk/identity_nullifier/1_0000.zkey'
                )

                console.log('Proof generated:', proof)
                console.log('Public signals:', publicSignals)

                const identityNullifier = to32ByteBuffer(BigInt(publicSignals[0]))

                // Process proof for Solana format
                const curve = await ff.buildBn128()
                const proofProc = await ff.utils.unstringifyBigInts(proof)

                // Convert proof components to the format expected by Solana
                let proofA = g1Uncompressed(curve, proofProc.pi_a)
                const proofAConverted = proofUtils.convert_proof(new Uint8Array(proofA))
                const proofB = g2Uncompressed(curve, proofProc.pi_b)
                const proofC = g1Uncompressed(curve, proofProc.pi_c)

                // Convert to Uint8Array for consistency
                const proofABytes = new Uint8Array(proofAConverted)
                const proofBBytes = new Uint8Array(proofB)
                const proofCBytes = new Uint8Array(proofC)

                const zkProofData: ZKProof = {
                    proof,
                    publicSignals,
                    identityNullifier,
                    proofA: proofABytes,
                    proofB: proofBBytes,
                    proofC: proofCBytes
                }

                setZkProof(zkProofData)
                return zkProofData

            } catch (error) {
                console.error('Error generating proof:', error)
                throw new Error(`Failed to generate ZK proof: ${error instanceof Error ? error.message : 'Unknown error'}`)
            } finally {
                setIsGeneratingProof(false)
            }
        },
        onSuccess: () => {
            toast.success('ZK proof generated successfully!')
            setCurrentStep(3) // Move to review step
        },
        onError: (error) => {
            console.error('Failed to generate proof:', error)
            toast.error(error.message || 'Failed to generate ZK proof')
            setIsGeneratingProof(false)
        },
    })

    // Register voter
    const registerVoter = useMutation({
        mutationKey: ['register-voter', { cluster }],
        mutationFn: async () => {
            if (!program || !provider.wallet.publicKey || !zkProof || !registrationData.electionName) {
                throw new Error('Missing required data for registration')
            }

            const { electionName } = registrationData
            const { identityNullifier, proofA, proofB, proofC } = zkProof

            try {
                // Register voter on blockchain
                const signature = await program.methods
                    .registerVoter(
                        electionName,
                        Array.from(identityNullifier),
                        Array.from(proofA),
                        Array.from(proofB),
                        Array.from(proofC)
                    )
                    .accounts({
                        signer: provider.wallet.publicKey,
                        program: program.programId,
                    })
                    .rpc()

                toast.success('Successfully veried your proof on chain as voter!')
                toast.success('We are currently storing your nullified identity off chain')
                const txData = await provider.connection.getTransaction(signature);
                const eventIx = txData.meta?.innerInstructions[0].instructions[0];
                const rawData = utils.bytes.bs58.decode(eventIx?.data);
                const base64Data = utils.bytes.base64.encode(rawData.subarray(8));
                const event = program.coder.events.decode(base64Data);
                const [electionAccountAddress] = PublicKey.findProgramAddressSync(
                    [Buffer.from("election"), Buffer.from(electionName)],
                    program.programId
                )
                let currentElection = await program.account.election.fetch(electionAccountAddress)
                console.log("currentElection", { currentElection });
                let leaves_g = [];
                if (currentElection.nullifiersIpfsCid.length == 46) {
                    console.log("registerVoter - cid", currentElection.nullifiersIpfsCid);
                    const response = await ipfs.get(currentElection.nullifiersIpfsCid);
                    let dataStr = "";
                    for await (const chunk of response) {
                        if ('content' in chunk && chunk.content) {
                            for await (const data of chunk.content) {
                                dataStr += new TextDecoder().decode(data);
                            }
                        }
                    }
                    const data = JSON.parse(dataStr);
                    console.log("registerVoter - data - dataStr", dataStr);
                    const { depth, leaves } = data;
                    console.log("registerVoter - data - leaves", leaves);
                    leaves_g = leaves.map((h: string) => Buffer.from(h.replace(/^0x/, ''), 'hex'));
                }
                console.log("registerVoter - data - leaves_g", leaves_g);
                const leaf = Buffer.from(event?.data.nullifier, 'hex');
                leaves_g.push(leaf);
                console.log("registerVoter - data - leaf", leaf);
                
                // Load circomlibjs for poseidon hash
                const circomlibjs = await loadCircomlibjs()
                if (!circomlibjs) {
                    throw new Error('Failed to load circomlibjs for merkle tree computation')
                }
                
                const tree = new MerkleTree(leaves_g, circomlibjs.poseidon, { hashLeaves: false, sort: true });
                const file = JSON.stringify({ depth: 20, leaves: leaves_g.map(l => "0x" + l.toString('hex')) });
                console.log("registerVoter - data - file", file);
                const { cid } = await ipfs.add({ content: file });
                console.log("registerVoter - data - cid", cid.toString());
                const root = tree.getRoot();

                toast.success("Successfully computed the new merkle tree");

                await program.methods.updateRoot(electionName, Array.from(root), cid.toString())
                .accounts({
                    signer: provider.wallet.publicKey,
                })
                .rpc();
                currentElection = await program.account.election.fetch(electionAccountAddress)
                if (currentElection.nullifiersIpfsCid.length !== 46) {
                    const errMsg = 'Failed to update off chain storage ref on-chain!!';
                    toast.error(errMsg)
                    throw new Error(errMsg)
                }

                return signature
            } catch (error) {
                console.error('Registration error:', error)
                throw error
            }
        },
        onSuccess: (signature) => {
            transactionToast(signature)
            toast.success('Successfully registered as voter!')
            setCurrentStep(4) // Move to success step
        },
        onError: (error) => {
            console.error('Failed to register voter:', error)
            toast.error(error.message || 'Failed to register voter')
        },
    })

    // Helper functions for step management
    const updateRegistrationData = (data: Partial<RegistrationFormData>) => {
        setRegistrationData(prev => ({ ...prev, ...data }))
    }

    const nextStep = () => {
        if (currentStep < 4) {
            setCurrentStep(currentStep + 1)
        }
    }

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1)
        }
    }

    const resetRegistration = () => {
        setCurrentStep(1)
        setRegistrationData({
            electionName: '',
            generatedSecret: undefined
        })
        setZkProof(null)
    }

    // Format secret key for display
    const getSecretKeyHex = () => {
        if (!registrationData.generatedSecret) return ''
        return Buffer.from(registrationData.generatedSecret).toString('hex')
    }

    return {
        program,
        currentStep,
        registrationData,
        zkProof,
        isGeneratingProof,
        isGeneratingSecret,
        elections: getElections.data || [],
        isLoadingElections: getElections.isLoading,
        generateSecret,
        generateProof,
        registerVoter,
        updateRegistrationData,
        nextStep,
        prevStep,
        resetRegistration,
        setCurrentStep,
        getSecretKeyHex
    }
}
