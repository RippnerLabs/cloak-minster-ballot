const voucher = {
  election: 52208898341821768n,
  depth: 20,
  leaf_index: 0,
  nullifier: '0x0cec14f940e42873d68c5af6586cf011775a664610189a006538c9b5fdcdb46f',
  merkle_root: '0xed857bfd6b3de6c6fe4eb9040075c649dff8800573c8faa30fdb64a4ee77b70c',
  sibling_hashes: [
    '0x0efeb60d3d870241cbdec86643637a1fc1bf7af409ba40f4a89a357f935e978c',
    '0x1a1698e51013a7ef88535808d09a3dde88144125c3e48d3a4bfd7795301973fd',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0'
  ],
  path_indices: [
    1, 1, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0
  ]
}

async function main() {
    const input_json = {
        identity_secret: BigInt(
            '0x' + Buffer.from([46,224,228,187,198,89,53,158,70,251,107,132,212,43,229,186,151,4,236,23,129,88,136,192,48,119,57,121,188,182,131,117,102,81,64,227,91,44,208,19,132,166,152,121,190,253,149,184,159,15,144,151,194,87,171,42,250,159,56,59,240,37,53,224]).toString('hex'),
        ).toString(),
        election_id: BigInt(voucher.election).toString(),
        path_indices: voucher.path_indices,
        siblings: voucher.sibling_hashes.map(h => BigInt(h).toString())
    }
    console.log(JSON.stringify(input_json, null, 2));
}
main()