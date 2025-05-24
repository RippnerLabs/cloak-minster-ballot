import fs from "fs";
import process from "process";
import * as ff from "ffjavascript";
const {unstringifyBigInts, leInt2Buff} = ff.utils;

async function main() {
    const inputFile = process.argv[2];
    if (!inputFile) {
        throw new Error("inputFile not specified");
    }
    const dataStr = fs.readFileSync(inputFile);
    let data = JSON.parse(dataStr);
    console.log({data});
    for(const key in data) {
        if (key == "vk_alpha_1") {
            for(let j in data[key]) {
                data[key][j] = leInt2Buff(unstringifyBigInts(data[key][j]), 32).reverse();
            }
        } else if (key == ["vk_beta_2", "vk_gamma_2", "vk_delta_2"]) {
            for (let j in data[key]) {
                const temp = Array.from(leInt2Buff(unstringifyBigInts(data[key][j][0]), 32)).concat(Array.from(leInt2Buff(unstringifyBigInts(data[key][j][1]), 32))).reverse();
                data[key][j][0] = temp.slice(0,32);
                data[key][j][1] = temp.slice(32, 64);
            }
        } else if (key == "IC") {
            for(let j in data[key]) {
                for (let k in data[key][j]) {
                    data[key][j][k] = leInt2Buff(unstringifyBigInts(data[key][j][k]), 32).reverse();
                }
            }
        }
    }

    const outputFilePath = process.argv[3];
    if(!outputFilePath) {
        throw new Error("outputFile not specified");
    }
    const outputFile = fs.openSync(outputFilePath, "w");
    let s = `use groth16_solana::groth16::Groth16Verifyingkey;\n\npub const VERIFYINGKEY: Groth16Verifyingkey =  Groth16Verifyingkey {\n\tnr_pubinputs: ${data.IC.length},\n\n`
    s += "\tvk_alpha_g1: [\n"
    for (var j = 0; j < data.vk_alpha_1.length -1 ; j++) {
      console.log(typeof(data.vk_alpha_1[j]))
      s += "\t\t" + Array.from(data.vk_alpha_1[j])/*.reverse().toString()*/ + ",\n"
    }
    s += "\t],\n\n"
    fs.writeSync(outputFile,s)
    s = "\tvk_beta_g2: [\n"
    for (var j = 0; j < data.vk_beta_2.length -1 ; j++) {
      for (var z = 0; z < 2; z++) {
        s += "\t\t" + Array.from(data.vk_beta_2[j][z])/*.reverse().toString()*/ + ",\n"
      }
    }
    s += "\t],\n\n"
    fs.writeSync(outputFile,s)
    s = "\tvk_gamme_g2: [\n"
    for (var j = 0; j < data.vk_gamma_2.length -1 ; j++) {
      for (var z = 0; z < 2; z++) {
        s += "\t\t" + Array.from(data.vk_gamma_2[j][z])/*.reverse().toString()*/ + ",\n"
      }
    }
    s += "\t],\n\n"
    fs.writeSync(outputFile,s)
 
    s = "\tvk_delta_g2: [\n"
    for (var j = 0; j < data.vk_delta_2.length -1 ; j++) {
      for (var z = 0; z < 2; z++) {
        s += "\t\t" + Array.from(data.vk_delta_2[j][z])/*.reverse().toString()*/ + ",\n"
      }
    }
    s += "\t],\n\n"
    fs.writeSync(outputFile,s)
    s = "\tvk_ic: &[\n"
    let x = 0;
 
    for (var ic in data.IC) {
      s += "\t\t[\n"
      // console.log(data.IC[ic])
      for (var j = 0; j < data.IC[ic].length - 1 ; j++) {
        s += "\t\t\t" + data.IC[ic][j]/*.reverse().toString()*/ + ",\n"
      }
      x++;
      s += "\t\t],\n"
    }
    s += "\t]\n};"
    fs.writeSync(outputFile,s)
}

main()