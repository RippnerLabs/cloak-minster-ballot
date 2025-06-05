import { Program } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import IDL from '../target/idl/zk_voting_system.json';
import { ZkVotingSystem } from '../target/types/zk_voting_system';
import { MerkleTree } from "merkletreejs";
import { poseidon } from "circomlibjs";
import { create } from 'ipfs-http-client';
import { downloadVoucher, performVote, registerVoter } from "./instruction_calls";

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
  const ipfsEndpoint: string = "https://ipfs.rippner.com/api/v0";
  const election_name_str = "new election";
  const options = ["option1", "option2", "opt3"];
  let users: Keypair[] = [];
  let vouchers = [];

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
    ipfs = create({ url: ipfsEndpoint })

    users = [];
    for (let i = 0; i < 3; i++) {
      users.push(Keypair.generate())
    }
    // Airdrop SOL to users for transaction fees
    for (const user of users) {
      const airdropSignature = await connection.requestAirdrop(
        user.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(airdropSignature);
    }

  }, 10000)

  it('Initialize Election', async () => {
    await program.methods
      .initElection(election_name, options)
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
    expect(currentElection.name).toEqual(election_name_str);
    expect(currentElection.isRegistrationOpen).toEqual(true);
    expect(currentElection.isVotingOpen).toEqual(false);
    expect(currentElection.isVotingOpen).toEqual(false);
    expect(currentElection.options.length).toEqual(options.length);
    expect(currentElection.options).toEqual(options);
    expect(currentElection.tallies.length).toEqual(options.length);
  })

  it("Register voter", async () => {
    for (const user of users) {
      const _ = await registerVoter(user.secretKey, election_name_str, program, user, provider, connection, ipfs);
    }
    expect(1).toEqual(1);
  }, 30000)

  it("Download vouchers", async () => {
    for (const user of users) {
      const v = await downloadVoucher(user.secretKey, election_name_str, program, ipfs);
      vouchers.push(v);
    }

    expect(vouchers.length).toEqual(users.length);
    expect(1).toEqual(1);
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

  it("Perform Vote", async () => {
    for(let i=0; i<users.length; i++) {
      await performVote(vouchers[i], election_name_str, program, signer, provider, connection, ipfs, options[0]);
    }

    expect(1).toEqual(1);
  }, 300000)

  it("Conclude election", async () => {
    await program.methods.concludeElection(Buffer.from(election_name_str))
    .accounts({
      signer: signer.publicKey
    })
    .rpc();
  })


}, 50000000)
