import { BankrunProvider } from 'anchor-bankrun';
import { BN, IdlEvents, Program, utils } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair, Connection, Transaction } from '@solana/web3.js';
import IDL from '../target/idl/zk_voting_system.json';
import { startAnchor, BanksClient, ProgramTestContext } from 'solana-bankrun';
import { BankrunContextWrapper } from './bankrun-utils/bankrunConnection';
import { ZkVotingSystem } from '../target/types/zk_voting_system';
// @ts-ignore
import * as snarkjs from "snarkjs";
// @ts-ignore
import * as ff from "ffjavascript";
import {convert_proof} from "./proof_utils/pkg"
// @ts-nocheck
import { g1Uncompressed, g2Uncompressed, to32ByteBuffer } from './utils';
// const ipfsClient = require('ipfs-http-client');
import {MerkleTree} from "merkletreejs";
import { poseidon } from "circomlibjs";

describe('zk-voting-system', () => {
  let signer: Keypair;
  let leaves: Buffer[];
  let tree: MerkleTree;
  let election_name: Buffer;
  let provider: BankrunProvider;
  let program: Program<ZkVotingSystem>;
  let banksClient: BanksClient;
  let context: ProgramTestContext;
  let bankrunContextWrapper: BankrunContextWrapper;
  let connection: Connection;

  beforeAll(async () => {

    context = await startAnchor(
      '',
      [{ name: 'zk_voting_system', programId: new PublicKey(IDL.address) }],
      [],
      BigInt(500000),
    );
    banksClient = context.banksClient;
    provider = new BankrunProvider(context);
    bankrunContextWrapper = new BankrunContextWrapper(context);
    connection = bankrunContextWrapper.connection.toConnection();
    connection = provider.connection;
    program = new Program<ZkVotingSystem>(IDL as ZkVotingSystem, provider);
    signer = provider.wallet.payer;
    // ipfs = ipfsClient.create({url: "http://127.0.0.1:5001/api/v0"});
    leaves = [];
    tree = new MerkleTree(leaves, poseidon, {hashLeaves: false, sort: true});

    election_name = Buffer.from("new election");

    // event listeners
    // program.addEventListener(
    //   'nullifierAdded',
    //   async (ev: IdlEvents<ZkVotingSystem>['nullifierAdded']) => {
    //     leaves.push(Buffer.from(ev.nullifier));
    //     tree = new MerkleTree(leaves, poseidon, {sort: true});
    //   }
    // )

    // setInterval(async () => {
    //   if (leaves.length == 0) return;
    //   const file = JSON.stringify({depth: 20, leaves: leaves.map(l => '0x' + l.toString('hex'))});
    //   // const {cid} = await ipfs.add(file);
    //   let cid = "asdsada";
    //   const root = tree.getRoot();
    //   await program.methods.updateRoot(election_name, root, Buffer.from(cid.toString()))
    //   .accounts({
    //     signer: signer.publicKey,
    //   })
    //   .signers([signer])
    //   .rpc();

    //   leaves = [];
    // }, 1_000)

  }, 10000)

  it('Initialize Election', async () => {
    let options = ["option1", "option2", "opt3"];

    await program.methods
      .initElection(election_name, new BN(1747904987), new BN(1747903287), options)
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
    console.log("currentElection", {currentElection});
    expect(currentElection.admin).toEqual(signer.publicKey);
    expect(currentElection.options.length).toEqual(options.length);
    expect(currentElection.tallies.length).toEqual(options.length);
  })

  it("Register voter", async () => {

    function alphaToInt(str: string): bigint {
      let res = 0n;
      const A_CODE = "A".charCodeAt(0);
      for (const ch of str.toUpperCase()) {
        res = res * 26n + BigInt(ch.charCodeAt(0) - A_CODE + 1);
      }
      return res;
    }

    const election_name_str = "new election";
    const election_name = Buffer.from(election_name_str);
    const electionIdBigInt = alphaToInt(election_name_str);
    
    // Convert secret key to BigInt (assuming it's a Uint8Array)
    const secretKeyBigInt = BigInt('0x' + Buffer.from(signer.secretKey).toString('hex'));
    
    const {proof, publicSignals} = await snarkjs.groth16.fullProve({
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

    const tx = new Transaction();
    tx.recentBlockhash = context.lastBlockhash;
    tx.add(ix);
    tx.sign(signer);
    const simRes = await banksClient.simulateTransaction(tx);
    const meta = await banksClient.processTransaction(tx);
    console.log("meta", JSON.stringify(meta), JSON.stringify(simRes));
    const eventIx = meta?.innerInstructions[0].instructions[0];
    const rawData = utils.bytes.bs58.decode(eventIx?.data);
    const base64Data = utils.bytes.base64.encode(rawData.subarray(8));
    const event = program.coder.events.decode(base64Data);
    console.log("event", {event});

    const [electionAccountAddr] = PublicKey.findProgramAddressSync(
      [Buffer.from("election"), election_name],
      program.programId
    );
    const electionAccount = await program.account.election.fetch(electionAccountAddr);
    const delay = (ms:number) => new Promise(res => setTimeout(res, ms));
    await delay(5000);
    expect(1).toEqual(1);
  })

  // it("Cast Vote", async () => {})

}, 50000000)
