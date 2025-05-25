import {ChildNodes, SMT} from "@zk-kit/smt";
import { BN, Program, utils } from '@coral-xyz/anchor';
import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair, Connection, Transaction } from '@solana/web3.js';
import IDL from '../target/idl/zk_voting_system.json';
import { ZkVotingSystem } from '../target/types/zk_voting_system';
// @ts-ignore
import * as snarkjs from "snarkjs";
// @ts-ignore
import * as ff from "ffjavascript";
import { convert_proof } from "./proof_utils/pkg"
import { g1Uncompressed, g2Uncompressed, to32ByteBuffer } from './utils';
import { MerkleTree } from "merkletreejs";
// @ts-ignore
import { poseidon, buildPoseidon } from "circomlibjs";
import { CID, create } from 'ipfs-http-client';
import { poseidon2, poseidon3 } from "poseidon-lite"
import { registerVoter } from "./instruction_calls";

function alphaToInt(str: string): bigint {
  let res = 0n;
  const A_CODE = "A".charCodeAt(0);
  for (const ch of str.toUpperCase()) {
    res = res * 26n + BigInt(ch.charCodeAt(0) - A_CODE + 1);
  }
  return res;
}

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
  const TREE_DEPTH = 20;
  let voucherGlobal: any;
  const options = ["option1", "option2", "opt3"];
  let users: Keypair[] = [];
  
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

    users = [];
    for (let i=0;i<3;i++){
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
    for(const user of users) {
      const _ = await registerVoter(user.secretKey, election_name_str, program, user, provider, connection, ipfs);
    }
    expect(1).toEqual(1);
  }, 30000)

  it("Download vouchers", async () => {
    const getWitness = (tree: MerkleTree, leaf: Buffer, index: number) => {
      const proof = tree.getProof(leaf, index);
      let sibling_hashes = proof.map(p => '0x' + p.data.toString('hex'));
      let path_indices = proof.map(p => (p.position == 'left') ? 0 : 1);
      while(sibling_hashes.length < TREE_DEPTH) {
        sibling_hashes.push("0");
        path_indices.push(0);
      }
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
      console.log("[downloadVoucher] secretKeyBigInt", secretKeyBigInt)
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
  voucherGlobal = voucher;
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

  it("Perform Vote", async () => {
  
    const electionBigInt = alphaToInt(election_name_str);
    const secret = wallet.payer.secretKey;
    const secretHexStr = "0x" + Buffer.from(secret).toString('hex');
    const secretBigInt = BigInt(secretHexStr);

    const [electionAccountAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("election"), election_name],
      program.programId
    )
    let currentElection = await program.account.election.fetch(electionAccountAddress)

    let spent_root = [];
    let spent_siblings = [];
    let spent_path = [];
    let spent_leaves = [];

    if (currentElection.spentNullifiersIpfsCid) {
      const response = await ipfs.get(new CID(currentElection.spentNullifiersIpfsCid).toV0().toString());
      let dataStr = "";
      for await (const chunk of response) {
        if(chunk.content) {
          for await (const data of chunk.content) {
            dataStr += new TextDecoder().decode(data);
          }
        }
      }
      const data = JSON.parse(dataStr);
      const { depth, spentLeaves } = data;
      spent_leaves = spentLeaves;
    }
    
    const hexToBig = (hex: string) => {
      BigInt(hex.startsWith("0x") ? hex : `0x${hex}`);
    }
    spent_leaves = spent_leaves.map(hexToBig);
    const DEPTH = 20;
    function rebuildSpentTree(spent) {
      const hash  = (childNodes: ChildNodes) => (childNodes.length === 2 ? poseidon2(childNodes) : poseidon3(childNodes))
      const tree = new SMT(hash, true);
      for (const n of spent) tree.add(n, 1n);
      return tree;
    }
    function getPathBits(key, depth = DEPTH) {
      const bits = [];
      for (let i = 0; i < depth; i++) bits.push(Number((key >> BigInt(i)) & 1n));
      return bits;
    }
    const poseidon = await buildPoseidon();
    const F = poseidon.F;
    const H = (l: bigint, r: bigint) => F.toObject(poseidon([l, r]));
    const toDec = (x: string | bigint) => BigInt(x).toString();

    function makeSpentWitness(tree: SMT, nullifierHex) {
      const nullifier = BigInt(nullifierHex);
      let { siblings } = tree.createProof(nullifier);
      let spent_root;
      if(siblings.length !== 0) {
        spent_root = "0x" + tree.root.toString(16).padStart(64, "0")
        while (siblings.length < DEPTH) {
          siblings.push("0")
        }
        
      } else {
        const defaults:bigint[] = [0n];
        for (let i=1; i<=DEPTH; i++){
          defaults[i] = H(defaults[i-1], defaults[i-1]);
        }
        spent_root=defaults[DEPTH];
        siblings=defaults.slice(0, DEPTH).map(toDec);
      }
        
      const witness = {
        spent_siblings: siblings.map(n =>
          "0x" + n.toString(16).padStart(64, "0")
        ),
        spent_path:   getPathBits(nullifier),
        spent_root:   spent_root,
      };
      tree.add(nullifier, 1n);
      witness["new_spent_root"] =
          "0x" + tree.root.toString(16).padStart(64, "0");
    
      return witness;
    }
    const spentTree = rebuildSpentTree(spent_leaves);
    const nullifier = '0x0cec14f940e42873d68c5af6586cf011775a664610189a006538c9b5fdcdb46f';
    const spentWitness = makeSpentWitness(spentTree, nullifier);
    console.log({
      spent_root:       BigInt(spentWitness.spent_root),          // public
      spent_siblings:   spentWitness.spent_siblings.map(s => BigInt(s)),      // private
      spent_path:       spentWitness.spent_path.map(s => BigInt(s)),          // private
      new_spent_root:   BigInt(spentWitness.new_spent_root),      // public
    });

    // voucherGlobal
    // {
    //   election: alphaToInt(election_name_str),
    //   depth: 20,
    //   leaf_index: index,
    //   nullifier: leaves[index].toString('hex'),
    //   merkle_root: '0x' + tree.getRoot().toString('hex'),
    //   sibling_hashes,
    //   path_indices
    // }
    const circuitInputs = {
      identity_nullifier: secretBigInt,
      membership_merke_tree_siblings: voucherGlobal.sibling_hashes.map((h:string) => BigInt(h)),
      membership_merke_tree_path_indices: voucherGlobal.path_indices,
      spent_root: spentWitness.spent_root,
      spent_siblings: [
        "0",
        "14744269619966411208579211824598458697587494354926760081771325075741142829156",
        "7423237065226347324353380772367382631490014989348495481811164164159255474657",
        "11286972368698509976183087595462810875513684078608517520839298933882497716792",
        "3607627140608796879659380071776844901612302623152076817094415224584923813162",
        "19712377064642672829441595136074946683621277828620209496774504837737984048981",
        "20775607673010627194014556968476266066927294572720319469184847051418138353016",
        "3396914609616007258851405644437304192397291162432396347162513310381425243293",
        "21551820661461729022865262380882070649935529853313286572328683688269863701601",
        "6573136701248752079028194407151022595060682063033565181951145966236778420039",
        "12413880268183407374852357075976609371175688755676981206018884971008854919922",
        "14271763308400718165336499097156975241954733520325982997864342600795471836726",
        "20066985985293572387227381049700832219069292839614107140851619262827735677018",
        "9394776414966240069580838672673694685292165040808226440647796406499139370960",
        "11331146992410411304059858900317123658895005918277453009197229807340014528524",
        "15819538789928229930262697811477882737253464456578333862691129291651619515538",
        "19217088683336594659449020493828377907203207941212636669271704950158751593251",
        "21035245323335827719745544373081896983162834604456827698288649288827293579666",
        "6939770416153240137322503476966641397417391950902474480970945462551409848591",
        "10941962436777715901943463195175331263348098796018438960955633645115732864202"
      ],
      spent_path: spentWitness.spent_path.map(s => BigInt(s))
    }
    const circuitInputs1 = {
      identity_nullifier: secretBigInt.toString(),
      membership_merke_tree_siblings: voucherGlobal.sibling_hashes.map((h:string) => BigInt(h).toString()),
      membership_merke_tree_path_indices: voucherGlobal.path_indices.map((h:string) => BigInt(h).toString()),
      spent_root: spentWitness.spent_root.toString(),
      spent_siblings: spentWitness.spent_siblings.map(s => BigInt(s).toString()),
      spent_path: spentWitness.spent_path.map(s => BigInt(s).toString())
    }
    console.log("circuitInputs", JSON.stringify(circuitInputs1, null, 2));
    const {proof, publicSignals} = await snarkjs.groth16.fullProve(circuitInputs,
      "../circom/vote_js/vote.wasm",
      "../circom/vote_js/1_0000.zkey"
    );
    console.log("vote - proof", proof);
    console.log("vote - publicSignals", publicSignals);

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
    const ix = await program.methods.vote(election_name, proofA, proofB, proofC, membership_merkle_root, new_spent_root, Buffer.from(options[0]))
    .accounts({
      signer: signer.publicKey,
    })
    .signers([signer])
    .instruction();

    const latestBlockContext = await provider.connection.getLatestBlockhash();
    const tx = new Transaction({
      feePayer: wallet.payer.publicKey,
      recentBlockhash: latestBlockContext.blockhash,
    });
    tx.add(ix)
    tx.sign(signer);

    const sign = await anchor.web3.sendAndConfirmTransaction(connection, tx, [wallet.payer], {skipPreflight: true});

    const txData = await provider.connection.getTransaction(sign);
    const eventIx = txData.meta?.innerInstructions[0].instructions[0];
    const rawData = utils.bytes.bs58.decode(eventIx?.data);
    const base64Data = utils.bytes.base64.encode(rawData.subarray(8));
    const event = program.coder.events.decode(base64Data);

    console.log("event", {event});

    currentElection = await program.account.election.fetch(electionAccountAddress)
    console.log("vote - currentElection", { currentElection });

    expect(1).toEqual(1);
  })


}, 50000000)
