import { create } from "ipfs-http-client";

export const ipfs = create({ url: "http://127.0.0.1:5001/api/v0" })