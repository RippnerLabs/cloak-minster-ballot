import fs from "node:fs/promises";
import { buildPoseidon } from "circomlibjs";

const DEPTH = 20;
const poseidon = await buildPoseidon();
const F = poseidon.F;
const H = (l: bigint, r: bigint) => F.toObject(poseidon([l, r]));
const toDec = (x: string | bigint) => BigInt(x).toString();

/* ------------------------------------------------------------------ *
 * 2. Pre-compute default nodes for an *empty* SMT                     *
 * ------------------------------------------------------------------ */
const defaults: bigint[] = [0n];            // level 0 (leaves)
for (let i = 1; i <= DEPTH; i++) {
  defaults[i] = H(defaults[i - 1], defaults[i - 1]);
}
const EMPTY_ROOT = defaults[DEPTH];

/* ------------------------------------------------------------------ *
 * 3. Helper: path bits from key                                       *
 * ------------------------------------------------------------------ */
function pathBits(key: bigint, d = DEPTH) {
  const out: number[] = [];
  for (let i = 0; i < d; i++) out.push(Number((key >> BigInt(i)) & 1n));
  return out;
}

/* ------------------------------------------------------------------ *
 * 4. Voucher coming from register-voter                               *
 * ------------------------------------------------------------------ */
const voucher = {
  nullifier:
    "0x0cec14f940e42873d68c5af6586cf011775a664610189a006538c9b5fdcdb46f",
  sibling_hashes: [
    "0x0efeb60d3d870241cbdec86643637a1fc1bf7af409ba40f4a89a357f935e978c",
    "0x1a1698e51013a7ef88535808d09a3dde88144125c3e48d3a4bfd7795301973fd"
  ],
  path_indices: [1, 1]
};

/* ------------------------------------------------------------------ *
 * 5. Build vote.circom input object                                   *
 * ------------------------------------------------------------------ */
const nullifierBig = BigInt(voucher.nullifier);

const membershipSibs = [
  ...voucher.sibling_hashes.map(toDec),
  ...Array(DEPTH - voucher.sibling_hashes.length).fill("0")
];

const membershipPath = [
  ...voucher.path_indices,
  ...Array(DEPTH - voucher.path_indices.length).fill(0)
].map(String);

// ---------- spent tree witness for the *first* vote -----------------
const spentSibs = defaults.slice(0, DEPTH).map(toDec); // default node per level
const spentPath = pathBits(nullifierBig).map(String);

const input = {
  identity_nullifier: toDec(nullifierBig),

  membership_merke_tree_siblings: membershipSibs,
  membership_merke_tree_path_indices: membershipPath,

  spent_root: toDec(EMPTY_ROOT),
  spent_siblings: spentSibs,
  spent_path: spentPath
};

/* ------------------------------------------------------------------ *
 * 6. Write file                                                      *
 * ------------------------------------------------------------------ */
await fs.writeFile("input.json", JSON.stringify(input, null, 2));
console.log("✓ wrote input.json  (identity_nullifier =", input.identity_nullifier, ")");
