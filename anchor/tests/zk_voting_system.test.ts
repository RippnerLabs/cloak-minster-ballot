import { BN, IdlEvents, Program, utils } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair, Connection, Transaction } from '@solana/web3.js';
import IDL from '../target/idl/zk_voting_system.json';
import { BankrunContextWrapper } from './bankrun-utils/bankrunConnection';
import { ZkVotingSystem } from '../target/types/zk_voting_system';
// @ts-ignore
import * as snarkjs from "snarkjs";
// @ts-ignore
import * as ff from "ffjavascript";
import { convert_proof } from "./proof_utils/pkg"
// @ts-nocheck
import { g1Uncompressed, g2Uncompressed, to32ByteBuffer } from './utils';
import { MerkleTree } from "merkletreejs";
import { poseidon } from "circomlibjs";
import { CID, create } from 'ipfs-http-client';
import { getMinimumBalanceForRentExemptMintWithExtensions } from '@solana/spl-token';
// import fetch, {RequestInit} from "node-fetch";

function alphaToInt(str: string): bigint {
  let res = 0n;
  const A_CODE = "A".charCodeAt(0);
  for (const ch of str.toUpperCase()) {
    res = res * 26n + BigInt(ch.charCodeAt(0) - A_CODE + 1);
  }
  return res;
}
const delay = (ms:number) => new Promise(rs => setTimeout(rs, ms));

describe('zk-voting-system', () => {
  let signer: Keypair;
  let leaves: any[];
  let tree: MerkleTree;
  let election_name: Buffer;
  let provider: anchor.Provider;
  let program: Program<ZkVotingSystem>;
  let connection: Connection;
  let wallet: anchor.Wallet;
  let ipfs: any;
  let userSecrets: Uint8Array[];
  const ipfsEndpoint: string = "http://127.0.0.1:5001/api/v0";
  const election_name_str = "new election";

  beforeAll(async () => {
    connection = new Connection("http://127.0.0.1:8899", "confirmed");

    wallet = anchor.Wallet.local();
    provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    })
    program = new Program<ZkVotingSystem>(IDL as ZkVotingSystem, provider);
    signer = wallet.payer;
    leaves = [];
    tree = new MerkleTree(leaves, poseidon, { hashLeaves: false, sort: true });

    election_name = Buffer.from("new election");
    ipfs = create({ url:  ipfsEndpoint})

    userSecrets = [
      new Uint8Array([123, 83, 2834]),
      new Uint8Array([981, 12, 812]),
      new Uint8Array([12]),
    ]
  }, 10000)

  it('Initialize Election', async () => {
    let options = ["option1", "option2", "opt3"];

    await program.methods
      .initElection(election_name, new BN(1), new BN(0), options)
      .accounts({
        signer: signer.publicKey,
      })
      .signers([signer])
      .rpc()

    const [electionAccountAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("election"), election_name],
      program.programId
    )
    const currentElection = await program.account.election.fetch(electionAccountAddress)
    console.log("currentElection", { currentElection });
    expect(currentElection.admin).toEqual(signer.publicKey);
    expect(currentElection.options.length).toEqual(options.length);
    expect(currentElection.tallies.length).toEqual(options.length);
  })

  it("Register voter", async () => {

    // async function registerVoter(secret: Uint8Array) {
      const electionIdBigInt = alphaToInt(election_name_str);
      // const secretKeyBigInt = BigInt('0x' + Buffer.from(secret).toString('hex'));
      const secretKeyBigInt = BigInt('0x' + Buffer.from(wallet.payer.secretKey).toString('hex'));

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


      const ix = await program.methods.registerVoter(election_name, identity_nullifier, proofA, proofB, proofC)
        .accounts({
          signer: signer.publicKey
        })
        .signers([signer])
        .instruction();

      const latestBlockContext = await provider.connection.getLatestBlockhash();
      const tx = new Transaction({
        feePayer: wallet.payer.publicKey,
        recentBlockhash: latestBlockContext.blockhash,
      });
      tx.add(ix);
      tx.sign(signer);

      const sign = await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet.payer], { skipPreflight: true });

      const txData = await provider.connection.getTransaction(sign);

      console.log("meta", JSON.stringify(sign));
      console.log("txData", JSON.stringify(txData));
      const eventIx = txData.meta?.innerInstructions[0].instructions[0];
      const rawData = utils.bytes.bs58.decode(eventIx?.data);
      const base64Data = utils.bytes.base64.encode(rawData.subarray(8));
      const event = program.coder.events.decode(base64Data);

      console.log("event", { event });
      console.log("event", JSON.stringify(event));

      const [electionAccountAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("election"), election_name],
        program.programId
      )
      let currentElection = await program.account.election.fetch(electionAccountAddress)
      console.log("currentElection", { currentElection });


      // TODO: Populate leaves from ipfs here

      const leaf = Buffer.from(event?.data.nullifier);
      leaves.push(leaf);
      tree = new MerkleTree(leaves, poseidon, { hashLeaves: false, sort: true });
      const file = JSON.stringify({ depth: 20, leaves: leaves.map(l => '0x' + l.toString('hex')) });
      const { cid } = await ipfs.add({ content: file });
      const root = tree.getRoot();
      await program.methods.updateRoot(election_name, root, Buffer.from(cid.toString()))
        .accounts({
          signer: signer.publicKey
        })
        .signers([signer])
        .rpc();
      
        console.log("electionAccountAddress", electionAccountAddress);
      
      currentElection = await program.account.election.fetch(electionAccountAddress)
      console.log("[registerVoter] currentElection", currentElection);
      expect(currentElection.nullifiersIpfsCid.length).toEqual(46);
    // }
    // userSecrets.map(async secret => {
    //   await registerVoter(secret);
    // })

    expect(1).toEqual(1);
  })

  it("Register voter - 2", async () => {

    // async function registerVoter(secret: Uint8Array) {
      const electionIdBigInt = alphaToInt(election_name_str);
      // const secretKeyBigInt = BigInt('0x' + Buffer.from(secret).toString('hex'));
      const kp= Keypair.generate();
      const secretKeyBigInt = BigInt('0x' + Buffer.from(kp.secretKey).toString('hex'));

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


      const ix = await program.methods.registerVoter(election_name, identity_nullifier, proofA, proofB, proofC)
        .accounts({
          signer: signer.publicKey
        })
        .signers([signer])
        .instruction();

      const latestBlockContext = await provider.connection.getLatestBlockhash();
      const tx = new Transaction({
        feePayer: wallet.payer.publicKey,
        recentBlockhash: latestBlockContext.blockhash,
      });
      tx.add(ix);
      tx.sign(signer);

      const sign = await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet.payer], { skipPreflight: true });

      const txData = await provider.connection.getTransaction(sign);

      console.log("meta", JSON.stringify(sign));
      console.log("txData", JSON.stringify(txData));
      const eventIx = txData.meta?.innerInstructions[0].instructions[0];
      const rawData = utils.bytes.bs58.decode(eventIx?.data);
      const base64Data = utils.bytes.base64.encode(rawData.subarray(8));
      const event = program.coder.events.decode(base64Data);

      console.log("event", { event });
      console.log("event", JSON.stringify(event));

      const [electionAccountAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("election"), election_name],
        program.programId
      )
      let currentElection = await program.account.election.fetch(electionAccountAddress)
      console.log("currentElection", { currentElection });


      // TODO: Populate leaves from ipfs here

      const leaf = Buffer.from(event?.data.nullifier);
      leaves.push(leaf);
      tree = new MerkleTree(leaves, poseidon, { hashLeaves: false, sort: true });
      const file = JSON.stringify({ depth: 20, leaves: leaves.map(l => '0x' + l.toString('hex')) });
      const { cid } = await ipfs.add({ content: file });
      const root = tree.getRoot();
      await program.methods.updateRoot(election_name, root, Buffer.from(cid.toString()))
        .accounts({
          signer: signer.publicKey
        })
        .signers([signer])
        .rpc();
      
        console.log("electionAccountAddress", electionAccountAddress);
      
      currentElection = await program.account.election.fetch(electionAccountAddress)
      console.log("[registerVoter] currentElection", currentElection);
      expect(currentElection.nullifiersIpfsCid.length).toEqual(46);
    // }
    // userSecrets.map(async secret => {
    //   await registerVoter(secret);
    // })

    expect(1).toEqual(1);
  })


  it("Register voter - 3", async () => {

    // async function registerVoter(secret: Uint8Array) {
      const electionIdBigInt = alphaToInt(election_name_str);
      // const secretKeyBigInt = BigInt('0x' + Buffer.from(secret).toString('hex'));
      const kp= Keypair.generate();
      const secretKeyBigInt = BigInt('0x' + Buffer.from(kp.secretKey).toString('hex'));

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


      const ix = await program.methods.registerVoter(election_name, identity_nullifier, proofA, proofB, proofC)
        .accounts({
          signer: signer.publicKey
        })
        .signers([signer])
        .instruction();

      const latestBlockContext = await provider.connection.getLatestBlockhash();
      const tx = new Transaction({
        feePayer: wallet.payer.publicKey,
        recentBlockhash: latestBlockContext.blockhash,
      });
      tx.add(ix);
      tx.sign(signer);

      const sign = await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet.payer], { skipPreflight: true });

      const txData = await provider.connection.getTransaction(sign);

      console.log("meta", JSON.stringify(sign));
      console.log("txData", JSON.stringify(txData));
      const eventIx = txData.meta?.innerInstructions[0].instructions[0];
      const rawData = utils.bytes.bs58.decode(eventIx?.data);
      const base64Data = utils.bytes.base64.encode(rawData.subarray(8));
      const event = program.coder.events.decode(base64Data);

      console.log("event", { event });
      console.log("event", JSON.stringify(event));

      const [electionAccountAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("election"), election_name],
        program.programId
      )
      let currentElection = await program.account.election.fetch(electionAccountAddress)
      console.log("currentElection", { currentElection });


      // TODO: Populate leaves from ipfs here

      const leaf = Buffer.from(event?.data.nullifier);
      leaves.push(leaf);
      tree = new MerkleTree(leaves, poseidon, { hashLeaves: false, sort: true });
      const file = JSON.stringify({ depth: 20, leaves: leaves.map(l => '0x' + l.toString('hex')) });
      const { cid } = await ipfs.add({ content: file });
      const root = tree.getRoot();
      await program.methods.updateRoot(election_name, root, Buffer.from(cid.toString()))
        .accounts({
          signer: signer.publicKey
        })
        .signers([signer])
        .rpc();
      
        console.log("electionAccountAddress", electionAccountAddress);
      
      currentElection = await program.account.election.fetch(electionAccountAddress)
      console.log("[registerVoter] currentElection", currentElection);
      expect(currentElection.nullifiersIpfsCid.length).toEqual(46);
    // }
    // userSecrets.map(async secret => {
    //   await registerVoter(secret);
    // })

    expect(1).toEqual(1);
  })

  it("Download vouchers", async () => {
    const getWitness = (tree: MerkleTree, leaf: Buffer, index: number) => {
      const proof = tree.getProof(leaf, index);
      const sibling_hashes = proof.map(p => '0x' + p.data.toString('hex'));
      const path_indices = proof.map(p => (p.position == 'left') ? 0 : 1);
      return {
        sibling_hashes, path_indices
      }
    }

    // async function downloadVoucher(secret: Uint8Array) {
      const [electionAccountAddr] = PublicKey.findProgramAddressSync(
        [Buffer.from("election"), election_name],
        program.programId
      );
      const electionAccount = await program.account.election.fetch(electionAccountAddr);
      // const secretKeyBigInt = BigInt('0x' + Buffer.from(secret).toString('hex'));
      const secretKeyBigInt = BigInt('0x' + Buffer.from(wallet.payer.secretKey).toString('hex'));
      console.log("[downloadVoucher] electionAccount", electionAccount)
      const response = await ipfs.get(new CID(electionAccount.nullifiersIpfsCid).toV0().toString());
      let dataStr = '';
      for await (const chunk of response) {
        if (chunk.content) {
          for await (const data of chunk.content) {
            dataStr += new TextDecoder().decode(data);
          }
        }
      }
      console.log("dataStr", dataStr);
      const data = JSON.parse(dataStr);
      
      const { depth, leaves } = data;
      console.log("leaves", leaves);
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
      
      const index = leaves.indexOf(identity_nullifier);
      if (index === -1) throw 'You are not registered';

      const tree = new MerkleTree(leaves, poseidon, {hashLeaves: false, sort: true});
      const { sibling_hashes, path_indices} = getWitness(tree, identity_nullifier, index);

      const voucher = {
        election: alphaToInt(election_name_str),
        depth: 20,
        leaf_index: index,
        nullifier: leaves[index].toString('hex'),
        merkle_root: '0x' + tree.getRoot().toString('hex'),
        sibling_hashes,
        path_indices
      }
      console.log("voucher", voucher);
  //     return voucher
  // }
  //   userSecrets.map(async secret => {
  //     const v = await downloadVoucher(secret);
  //     console.log(JSON.stringify(v));
  //   })

    expect(1).toEqual(1);
    // Convert secret key to BigInt (assuming it's a Uint8Array)
    // const secretKeyBigInt = BigInt('0x' + Buffer.from(signer.secretKey).toString('hex'));
  })

  it("Close Registration & Open voting", async () => {
    await program.methods.closeRegistration(election_name)
      .accounts({
        signer: wallet.payer.publicKey,
      })
      .signers([wallet.payer])
      .rpc();

    const [electionAccountAddr] = PublicKey.findProgramAddressSync(
      [Buffer.from("election"), election_name],
      program.programId
    );
    const electionAccount = await program.account.election.fetch(electionAccountAddr);

    expect(electionAccount.isRegistrationOpen).toEqual(false);
    expect(electionAccount.isVotingOpen).toEqual(true);
  })



}, 50000000)
