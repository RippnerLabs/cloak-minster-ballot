import { create } from "ipfs-http-client";

const ipfsUrl = process.env.NEXT_PUBLIC_IPFS_URL || "https://ipfs.rippner.com/api/v0";

export const ipfs = create({ url: ipfsUrl });