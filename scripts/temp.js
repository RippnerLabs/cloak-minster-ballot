import {CID, create} from "ipfs-http-client";

async function main() {
    const ipfs = create({url: "http://127.0.0.1:5001/api/v0"});
    const response = await ipfs.get(new CID("QmYhW6R7hdz2X6sGTfB6peLKBrXCGszuiQBjNjied5ahGC").toV0().toString());
    let dataStr = '';
    for await (const chunk of response) {
      if (chunk.content) {
        for await (const data of chunk.content) {
          dataStr += new TextDecoder().decode(data);
        }
      }
    }
    console.log("dataStr", dataStr);
}

import { SMT } from "@zk-kit/smt";
import { poseidon2 , poseidon3}       from "poseidon-lite";

const DEPTH = 20;
const hash  = (childNodes) => (childNodes.length === 2 ? poseidon2(childNodes) : poseidon3(childNodes))
function rebuildSpentTree(spent) {
  const tree = new SMT(hash, true);
  for (const n of spent) tree.add(n, 1n);
  return tree;
}
function getPathBits(key, depth = DEPTH) {
  const bits = [];
  for (let i = 0; i < depth; i++) bits.push(Number((key >> BigInt(i)) & 1n));
  return bits;
}

function makeSpentWitness(tree, nullifierHex) {
  const nullifier = BigInt(nullifierHex);
  const { siblings } = tree.createProof(nullifier);   // membership === false
  while (siblings.length < DEPTH) {
    siblings.push("0")
  }
  const witness = {
    spent_siblings: siblings.map(n =>
      "0x" + n.toString(16).padStart(64, "0")
    ),
    spent_path:   getPathBits(nullifier),             // [0/1,…] length == DEPTH
    spent_root:   "0x" + tree.root.toString(16).padStart(64, "0")  // public input
  };
  tree.add(nullifier, 1n);
  witness["new_spent_root"] =
      "0x" + tree.root.toString(16).padStart(64, "0");               // public output

  return witness;
}

/* ------------------------------------------------------------------ *
 * 5. Example usage                                                   *
 * ------------------------------------------------------------------ */
async function demo() {
  // Imagine two nullifiers have already voted
  const alreadySpent = [
    BigInt("0x0cec14f940e42873d68c5af6586cf011775a664610189a006538c9b5fdcdb46f"),
    BigInt("0xed857bfd6b3de6c6fe4eb9040075c649dff8800573c8faa30fdb64a4ee77b70c")
  ];

  const tree = rebuildSpentTree(alreadySpent);

  const voterNullifier =
    "0x0cec14f940e42873d68c5af6586cf011775a664610189a006538c9b5fdc7b46f";

    

  const w = makeSpentWitness(tree, voterNullifier);
  console.log("voterNullifier", BigInt(voterNullifier));

  // ---- what you feed into vote.circom ------------------------------
  console.log({
    election_id:      "...",
    vote_plain:       "0",
    spent_root:       BigInt(w.spent_root),          // public
    spent_siblings:   w.spent_siblings.map(s => BigInt(s)),      // private
    spent_path:       w.spent_path.map(s => BigInt(s)),          // private
    new_spent_root:   BigInt(w.new_spent_root),      // public
    voter_siblings:   "...",                 // from voter tree
    voter_path:       "..."
  });
}

demo().catch(console.error);
