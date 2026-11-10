import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const dir=path.dirname(require.resolve('onnxruntime-web'));
fs.mkdirSync('public/ai-runtime',{recursive:true});
const names=fs.readdirSync(dir).filter(n=>/^ort-wasm.*\.(mjs|wasm)$/.test(n));
for(const n of names)fs.copyFileSync(path.join(dir,n),path.join('public/ai-runtime',n));
console.log(`Prepared ${names.length} pinned on-device runtime assets.`);
