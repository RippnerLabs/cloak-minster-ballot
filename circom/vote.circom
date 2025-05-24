pragma circom 2.0.4;

include "./node_modules/circomlib/circuits/poseidon.circom";

template Vote(depth) {
    signal input identity_secret;
    signal input election_id;
    signal input siblings[depth];
    signal input path_indices[depth];

    signal output identity_nullifier;
    component identity_nullifier_poseidon = Poseidon(2);
    identity_nullifier_poseidon.inputs[0] <== identity_secret;
    identity_nullifier_poseidon.inputs[1] <== election_id;
    identity_nullifier <== identity_nullifier_poseidon.out;

    signal leaf;
    leaf <== identity_nullifier;

    signal cur[depth+1];
    cur[0] <== leaf;

    var is_right;
    var left;
    var right;
    component cur_node[depth];
    for(var i=0; i < depth; i++) {
        is_right = path_indices[i];
        left = (is_right) * siblings[i] + (1-is_right) * cur[i];
        right = (is_right) * cur[i] + (1-is_right) * siblings[i];
        
        cur_node[i] = Poseidon(2);
        cur_node[i].inputs[0] <-- left;
        cur_node[i].inputs[1] <-- right;
        cur[i+1] <== cur_node[i].out;
    }

    signal output merkle_root;
    merkle_root <== cur[depth];
}

component main {public [election_id]} = Vote(20);