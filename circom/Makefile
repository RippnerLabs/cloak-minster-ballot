snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="new" -v
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
snarkjs groth16 setup ../identity_nullifier.r1cs pot12_final.ptau 1_0000.zkey
snarkjs zkey export verificationkey 1_0000.zkey verification_key.json
snarkjs groth16 prove 1_0000.zkey witness.wtns proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json


node generate_witness.js ./vote.wasm input.json witness.wtns
snarkjs powersoftau new bn128 14 pot14_0000.ptau -v
snarkjs powersoftau contribute pot14_0000.ptau pot14_0001.ptau --name="new" -v
snarkjs powersoftau prepare phase2 pot14_0001.ptau pot14_final.ptau -v
snarkjs groth16 setup ../vote.r1cs pot14_final.ptau 1_0000.zkey
snarkjs zkey export verificationkey 1_0000.zkey verification_key.json
snarkjs groth16 prove 1_0000.zkey witness.wtns proof.json public.json
snarkjs groth16 verify verification_key.json public.json proof.json