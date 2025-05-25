// @ts-ignore
import * as ff from "ffjavascript";
// @ts-ignore
import * as snarkjs from "snarkjs";
import { alphaToInt, g1Uncompressed, g2Uncompressed, to32ByteBuffer } from "./utils";
import { convert_proof } from "./proof_utils/pkg/proof_utils";
import { ZkVotingSystem } from "anchor/target/types/zk_voting_system";
import { Program } from "@coral-xyz/anchor";
import { Provider} from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { CID } from "ipfs-http-client";
import MerkleTree from "merkletreejs";
// @ts-ignore
import {poseidon} from "circomlibjs"

export async function registerVoter(secret: Uint8Array, election_name_str: string, program: Program<ZkVotingSystem>, signer: anchor.web3.Keypair, provider: Provider, connection: anchor.web3.Connection, ipfs: any) {
    const electionIdBigInt = alphaToInt(election_name_str);
    const secretKeyBigInt = BigInt('0x' + Buffer.from(secret).toString('hex'));

    const { proof, publicSignals } = await snarkjs.groth16.fullProve({
        identity_secret: secretKeyBigInt,
        election_id: electionIdBigInt,
    },
        "../circom/identity_nullifier_js/identity_nullifier.wasm",
        "../circom/identity_nullifier_js/1_0000.zkey",
    )
    console.log("Proof:", JSON.stringify(proof, null, 2));
    console.log("public signals:", publicSignals);
    const identity_nullifier = to32ByteBuffer(BigInt(publicSignals[0]));

    const curve = await ff.buildBn128();
    const proofProc = await ff.utils.unstringifyBigInts(proof);
    let proofA = g1Uncompressed(curve, proofProc.pi_a);
    proofA = await convert_proof(proofA);
    console.log('proofA', proofA);
    const proofB = g2Uncompressed(curve, proofProc.pi_b);
    console.log('proofB', proofB);
    const proofC = g1Uncompressed(curve, proofProc.pi_c);
    console.log('proofC', proofC);


    const ix = await program.methods.registerVoter(Buffer.from(election_name_str), identity_nullifier, proofA, proofB, proofC)
        .accounts({
            signer: signer.publicKey
        })
        .signers([signer])
        .instruction();

    const latestBlockContext = await provider.connection.getLatestBlockhash();
    const tx = new Transaction({
        feePayer: signer.publicKey,
        recentBlockhash: latestBlockContext.blockhash,
    });
    tx.add(ix);
    tx.sign(signer);

    const sign = await anchor.web3.sendAndConfirmTransaction(connection, tx, [signer], { skipPreflight: true });

    const txData = await provider.connection.getTransaction(sign);

    console.log("meta", JSON.stringify(sign));
    console.log("txData", JSON.stringify(txData));
    const eventIx = txData.meta?.innerInstructions[0].instructions[0];
    const rawData = anchor.utils.bytes.bs58.decode(eventIx?.data);
    const base64Data = anchor.utils.bytes.base64.encode(rawData.subarray(8));
    const event = program.coder.events.decode(base64Data);

    console.log("event", { event });
    console.log("event", JSON.stringify(event));

    const [electionAccountAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("election"), Buffer.from(election_name_str)],
        program.programId
    )
    let currentElection = await program.account.election.fetch(electionAccountAddress)
    console.log("currentElection", { currentElection });


    // TODO: Populate leaves from ipfs here
    let leaves_g = [];
    if (currentElection.nullifiersIpfsCid.length == 46) {
        const response = await (await ipfs.get(new CID(currentElection.nullifiersIpfsCid).toV0().toString()));
        let dataStr = "";
        for await (const chunk of response) {
            if (chunk.content) {
                for await (const data of chunk.content) {
                    dataStr += new TextDecoder().decode(data);
                }
            }
        }
        const data = JSON.parse(dataStr);
        const {depth, leaves} = data;
        leaves_g = leaves.map(l => Buffer.from(l));
    }
    const leaf = Buffer.from(event?.data.nullifier);
    leaves_g.push(leaf);
    console.log('leaves_g', JSON.stringify(leaves_g));
    const tree = new MerkleTree(leaves_g, poseidon, { hashLeaves: false, sort: true });
    const file = JSON.stringify({ depth: 20, leaves: [...leaves_g, '0x' + leaf.toString('hex')] });
    const { cid } = await ipfs.add({ content: file });
    const root = tree.getRoot();
    await program.methods.updateRoot(Buffer.from(election_name_str), root, Buffer.from(cid.toString()))
        .accounts({
            signer: signer.publicKey
        })
        .signers([signer])
        .rpc();

    currentElection = await program.account.election.fetch(electionAccountAddress)
    expect(currentElection.nullifiersIpfsCid.length).toEqual(46);
    expect(currentElection.merkleRoot).toEqual(Array.from(root));
    expect(currentElection.nullifiersIpfsCid).toEqual(cid.toString());
}
