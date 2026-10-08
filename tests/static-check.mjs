import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const manifest = JSON.parse(readFileSync('manifest.webmanifest'));
for (const key of ['id', 'start_url', 'scope']) assert.equal(manifest[key], '/quick-calc/');
for (const icon of manifest.icons) {
  const bytes = readFileSync(icon.src);
  assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes);
  assert.equal(icon.type, 'image/png');
}
const html = readFileSync('index.html','utf8');
for (const pattern of [/noindex/, /manifest.webmanifest/, /Made by YUU/, /v1.0/, /apple-touch-icon/, /favicon.png/]) assert.match(html,pattern);
for (const file of readdirSync('js')) {
  const code = readFileSync('js/'+file,'utf8');
  assert.doesNotMatch(code, /\beval\s*\(|new\s+Function\s*\(|\bfetch\s*\(|\bXMLHttpRequest\b|\bsendBeacon\b|\bWebSocket\b/);
}
console.log('Static checks passed: PNG dimensions, PWA identity, metadata, no eval/external code endpoints.');
