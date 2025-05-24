pragma circom 2.0.4;

include "./node_modules/circomlib/circuits/poseidon.circom";

template SparseNonMembership(depth) {
    signal input key;
    signal input spent_path[depth];
    signal input spent_siblings[depth];
    signal input curr_root;
    signal output new_root;

    var curr=0;
    component h_left[depth];
    for(var i=0;i<depth;i++){
        var is_right = spent_path[i];
        var l = (is_right) * spent_siblings[i] + (1-is_right) * curr;
        var r = (is_right) * curr + (1-is_right) * spent_siblings[i];

        h_left[i] = Poseidon(2);
        h_left[i].inputs[0] <-- l;
        h_left[i].inputs[1] <-- r;
        curr = h_left[i].out;
    }

    curr_root === curr;

    curr=1;
    component h_right[depth];
    for(var i=0;i<depth;i++) {
        var is_right = spent_path[i];
        var l2 = (is_right) * spent_siblings[i] + (1-is_right)* curr;
        var r2 = (is_right) * curr + (1-is_right) * spent_siblings[i];
        h_right[i] = Poseidon(2);
        h_right[i].inputs[0] <-- l2;
        h_right[i].inputs[1] <-- r2;
        curr = h_right[i].out;
    }

    new_root <== curr;
}

template Vote(depth) {
    signal input identity_nullifier;
    signal input membership_merke_tree_siblings[depth];
    signal input membership_merke_tree_path_indices[depth];

    signal leaf;
    leaf <== identity_nullifier;

    signal cur[depth+1];
    cur[0] <== leaf;

    var is_right;
    var left;
    var right;
    component cur_node[depth];
    for(var i=0; i < depth; i++) {
        is_right = membership_merke_tree_path_indices[i];
        left = (is_right) * membership_merke_tree_siblings[i] + (1-is_right) * cur[i];
        right = (is_right) * cur[i] + (1-is_right) * membership_merke_tree_siblings[i];
        
        cur_node[i] = Poseidon(2);
        cur_node[i].inputs[0] <-- left;
        cur_node[i].inputs[1] <-- right;
        cur[i+1] <== cur_node[i].out;
    }

    signal output membership_merkle_root;
    membership_merkle_root <== cur[depth];

    // spent leaves
    signal input spent_root;
    signal input spent_siblings[depth];
    signal input spent_path[depth];

    component spent_tree = SparseNonMembership(depth);
    spent_tree.key <== identity_nullifier;
    spent_tree.spent_path <== spent_path;
    spent_tree.spent_siblings <== spent_siblings; 
    spent_tree.curr_root <== spent_root;

    signal output new_spent_root;
    new_spent_root <== spent_tree.new_root;
}

component main = Vote(20);