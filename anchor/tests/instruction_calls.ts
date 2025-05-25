// @ts-ignore
import * as ff from "ffjavascript";
// @ts-ignore
import * as snarkjs from "snarkjs";
import { alphaToInt, buildSpentTree, g1Uncompressed, g2Uncompressed, hexToBig, to32ByteBuffer, toDec } from "./utils";
import { convert_proof } from "./proof_utils/pkg/proof_utils";
import { ZkVotingSystem } from "anchor/target/types/zk_voting_system";
import { Program } from "@coral-xyz/anchor";
import { Provider } from "@coral-xyz/anchor";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { CID } from "ipfs-http-client";
import MerkleTree from "merkletreejs";
// @ts-ignore
import { poseidon, buildPoseidon } from "circomlibjs"

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

    let leaves_g = [];
    if (currentElection.nullifiersIpfsCid.length == 46) {
        console.log("registerVoter - cid", currentElection.nullifiersIpfsCid);
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
        console.log("registerVoter - data - dataStr", dataStr);
        const { depth, leaves } = data;
        console.log("registerVoter - data - leaves", leaves);
        leaves_g = leaves.map((h: string) => Buffer.from(h.replace(/^0x/, ''), 'hex'));
    }
    console.log("registerVoter - data - leaves_g", leaves_g);
    const leaf = Buffer.from(event?.data.nullifier, 'hex');
    leaves_g.push(leaf);
    console.log("registerVoter - data - leaf", leaf);
    const tree = new MerkleTree(leaves_g, poseidon, { hashLeaves: false, sort: true });
    const file = JSON.stringify({ depth: 20, leaves: leaves_g.map(l => "0x" + l.toString('hex')) });
    console.log("registerVoter - data - file", file);
    const { cid } = await ipfs.add({ content: file });
    console.log("registerVoter - data - cid", cid.toString());
    const root = tree.getRoot();
    await program.methods.updateRoot(Buffer.from(election_name_str), root, Buffer.from(cid.toString()))
        .accounts({
            signer: signer.publicKey
        })
        .signers([signer])
        .rpc();

    currentElection = await program.account.election.fetch(electionAccountAddress)
    expect(currentElection.nullifiersIpfsCid.length).toEqual(46);
    // expect(currentElection.merkleRoot).toEqual(Array.from(root));
    // expect(currentElection.nullifiersIpfsCid).toEqual(cid.toString());
}

async function getLeavesFromIpfs(ipfs: any, cid: string) {
    const response = await ipfs.get(new CID(cid).toV0().toString());
    let dataStr = '';
    for await (const chunk of response) {
        if (chunk.content) {
            for await (const data of chunk.content) {
                dataStr += new TextDecoder().decode(data);
            }
        }
    }
    const data = JSON.parse(dataStr);
    const { depth, leaves } = data;
    return leaves;
}

const TREE_DEPTH = 20;

export async function downloadVoucher(secret: Uint8Array, election_name_str: string, program: Program<ZkVotingSystem>, ipfs: any) {

    const getWitness = (tree: MerkleTree, leaf: Buffer, index: number) => {
        const proof = tree.getProof(leaf, index);
        let sibling_hashes = proof.map(p => '0x' + p.data.toString('hex'));
        let path_indices = proof.map(p => (p.position == 'left') ? 0 : 1);
        while (sibling_hashes.length < TREE_DEPTH) {
            sibling_hashes.push("0");
            path_indices.push(0);
        }
        return {
            sibling_hashes, path_indices
        }
    }

    const [electionAccountAddr] = PublicKey.findProgramAddressSync(
        [Buffer.from("election"), Buffer.from(election_name_str)],
        program.programId
    );
    const electionAccount = await program.account.election.fetch(electionAccountAddr);
    const secretKeyBigInt = BigInt('0x' + Buffer.from(secret).toString('hex'));
    console.log("[downloadVoucher] secretKeyBigInt", secretKeyBigInt)

    const electionIdBigInt = alphaToInt(election_name_str);
    const { proof, publicSignals } = await snarkjs.groth16.fullProve({
        identity_secret: secretKeyBigInt,
        election_id: electionIdBigInt,
    },
        "../circom/identity_nullifier_js/identity_nullifier.wasm",
        "../circom/identity_nullifier_js/1_0000.zkey",
    )
    console.log("Proof:", JSON.stringify(proof, null, 2));
    console.log("public signals:", publicSignals);
    const identity_nullifier = "0x" + to32ByteBuffer(BigInt(publicSignals[0])).toString('hex');

    const leaves = await getLeavesFromIpfs(ipfs, electionAccount.nullifiersIpfsCid);
    const index = leaves.indexOf(identity_nullifier);
    console.log("[downloadVoucher] leaves", leaves);
    console.log("[downloadVoucher] identity_nullifier", identity_nullifier);
    if (index === -1) throw 'You are not registered';

    const tree = new MerkleTree(leaves, poseidon, { hashLeaves: false, sort: true });
    const { sibling_hashes, path_indices } = getWitness(tree, identity_nullifier, index);

    const voucher = {
        election: alphaToInt(election_name_str),
        leaf_index: index,
        nullifier: leaves[index].toString('hex'),
        merkle_root: '0x' + tree.getRoot().toString('hex'),
        sibling_hashes,
        path_indices
    }
    console.log("voucher", voucher);
    return voucher
}

export async function performVote(voucher: any, election_name_str: string, program: Program<ZkVotingSystem>, signer: anchor.web3.Keypair, provider: Provider, connection: anchor.web3.Connection, ipfs: any, option: string) {
    const [electionAccountAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("election"), Buffer.from(election_name_str)],
        program.programId
    )
    let currentElection = await program.account.election.fetch(electionAccountAddress)
    let spent_leaves = [];
    let spent_leaves_hex = [];
    let spent_leaves_bigints = [];

    if (currentElection.spentNullifiersIpfsCid) {
        const response = await ipfs.get(new CID(currentElection.spentNullifiersIpfsCid).toV0().toString());
        let dataStr = "";
        for await (const chunk of response) {
            if (chunk.content) {
                for await (const data of chunk.content) {
                    dataStr += new TextDecoder().decode(data);
                }
            }
        }
        const data = JSON.parse(dataStr);
        const { depth, spentLeaves } = data;
        console.log("performVote - spentLeaves", spentLeaves);
        spent_leaves = spentLeaves
        spent_leaves_hex = spentLeaves.map((l:string)=> Buffer.from(l.replace(/^0x/, ''), 'hex'));
        console.log("performVote - spent_leaves_hex", spent_leaves_hex);
        spent_leaves_bigints = spentLeaves.map(hexToBig);
    }
    const poseidon = await buildPoseidon();
    const spentTree = buildSpentTree(spent_leaves_bigints, poseidon);
    const nullifier_bigint = BigInt(voucher.nullifier);
    // Check if nullifier already exists
    if (spentTree.has(nullifier_bigint)) {
        console.error(`❌ Nullifier already exists in spent tree!`);
        return;
    }
    const smtTreeProof = spentTree.createNonMembershipProof(nullifier_bigint);

    const circuitInputs = {
        identity_nullifier: toDec(nullifier_bigint),
        membership_merke_tree_siblings: [...voucher.sibling_hashes, ...Array(20 - voucher.sibling_hashes.length).fill('0')],
        membership_merke_tree_path_indices: [...voucher.path_indices, ...Array(20 - voucher.path_indices.length).fill(0)].map(String),
        
        spent_root: toDec(smtTreeProof.root),
        spent_siblings: smtTreeProof.siblings.map(s => s.toString()),
        spent_path: smtTreeProof.pathBits.map(String)
    };

    console.log("circuitInputs", JSON.stringify(circuitInputs, null, 2));
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(circuitInputs,
        "../circom/vote_js/vote.wasm",
        "../circom/vote_js/1_0000.zkey"
    );
    // console.log("vote - proof", proof);
    // console.log("vote - publicSignals", publicSignals);
    const membership_merkle_root = to32ByteBuffer(BigInt(publicSignals[0]));
    const new_spent_root = to32ByteBuffer(BigInt(publicSignals[1]));

    const curve = await ff.buildBn128();
    const proofProc = await ff.utils.unstringifyBigInts(proof);
    let proofA = g1Uncompressed(curve, proofProc.pi_a);
    proofA = convert_proof(proofA);
    console.log("proofA", proofA)
    const proofB = g2Uncompressed(curve, proofProc.pi_b);
    console.log("proofB", proofB)
    const proofC = g1Uncompressed(curve, proofProc.pi_c);
    console.log("proofC", proofC)

    spent_leaves_hex.push(Buffer.from(voucher.nullifier.replace(/^0x/, ""), 'hex'));
    console.log("performVote - spent_leaves_hex", spent_leaves_hex);
    const file = JSON.stringify({ depth: TREE_DEPTH, spentLeaves:  spent_leaves_hex.map(l => "0x" + l.toString('hex'))});
    console.log("performVote - file", file);
    const {cid} = await ipfs.add({content: file});
    const ix = await program.methods.vote(Buffer.from(election_name_str), proofA, proofB, proofC, membership_merkle_root, new_spent_root, Buffer.from(cid.toString()), Buffer.from(option))
      .accounts({
        signer: signer.publicKey,
      })
      .signers([signer])
      .instruction();

    const latestBlockContext = await provider.connection.getLatestBlockhash();
    const tx = new Transaction({
      feePayer: signer.publicKey,
      recentBlockhash: latestBlockContext.blockhash,
    });
    tx.add(ix)
    tx.sign(signer);

    const sign = await anchor.web3.sendAndConfirmTransaction(connection, tx, [signer], { skipPreflight: true });

    const txData = await provider.connection.getTransaction(sign);
    const eventIx = txData.meta?.innerInstructions[0].instructions[0];
    const rawData = anchor.utils.bytes.bs58.decode(eventIx?.data);
    const base64Data = anchor.utils.bytes.base64.encode(rawData.subarray(8));
    const event = program.coder.events.decode(base64Data);

    console.log("event", { event });

    currentElection = await program.account.election.fetch(electionAccountAddress)
    console.log("vote - currentElection", { currentElection });
    expect(1).toEqual(1);

}