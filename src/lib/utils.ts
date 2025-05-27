import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {poseidon2, poseidon3} from "poseidon-lite";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function ellipsify(str = '', len = 4, delimiter = '..') {
  const strLen = str.length
  const limit = len * 2 + delimiter.length

  return strLen >= limit ? str.substring(0, len) + delimiter + str.substring(strLen - len, strLen) : str
}

// @ts-ignore
export const g1Uncompressed = (curve: any, p1Raw: any) => {
  const p1 = curve.G1.fromObject(p1Raw);
  let buff = new Uint8Array(64);
  curve.G1.toRprUncompressed(buff, 0, p1);

  return Buffer.from(buff);
}

export const g2Uncompressed = (curve: any, p2Raw: any) => {
  const p2 = curve.G2.fromObject(p2Raw);
  let buff = new Uint8Array(128);
  curve.G2.toRprUncompressed(buff, 0, p2);
  return Buffer.from(buff);
}
export const toHex64Padded = (val: any) => BigInt(val).toString(16).padStart(64, "0");
export const to32ByteBuffer = (val: any) => Buffer.from(toHex64Padded(val), "hex");
export function alphaToInt(str: string): bigint {
  let res = 0n;
  const A_CODE = "A".charCodeAt(0);
  for (const ch of str.toUpperCase()) {
      res = res * 26n + BigInt(ch.charCodeAt(0) - A_CODE + 1);
  }
  return res;
}

export const DEPTH = 20;

export const hexToBig = (hex: string) =>
BigInt(hex.startsWith("0x") ? hex : `0x${hex}`);

export const toDec = (x: string | bigint) => BigInt(x).toString();
export const poseidonHash = (x: any[]) => x.length === 2 ? poseidon2(x) : poseidon3(x);
