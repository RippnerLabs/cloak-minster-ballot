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
    console.log("dataStr",dataStr);
}

main()