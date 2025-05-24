node generate_witness.js ./identity_nullifier.wasm input.json witness.wtns
snarks powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name "new" -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="new" -v
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
snarkjs groth16 setup ../identity_nullifier.r1cs pot12_final.ptau 1_0000.zkey
snarkjs zkey export verificationkey 1_0000.zkey verification_key.json
snarkjs groth16 prove 1_0000.zkey witness.wtns proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json