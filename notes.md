node_modules/ipfs-utils/src/http.js:127
    return this.fetch(resource, { ...options, method: 'POST', duplex: 'half' })

0b350c8c7a16110d8d61c9a3c71c4c35cb39fc779787820fde8c291d06bfe55c0d75f913175fefd21161e6b6c7399cee2c4215016e07abd395ab3dc15856ecaa

➜  anchor git:(main) ✗ ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin \
  '["http://localhost:3000"]'

➜  anchor git:(main) ✗ ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods \
  '["GET","POST","PUT","OPTIONS"]'

➜  anchor git:(main) ✗ ipfs config --json API.HTTPHeaders.Access-Control-Allow-Credentials '["true"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers \
  '["Content-Type","Authorization"]'