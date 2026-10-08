import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright' : 'playwright');
const packaged = process.env.QUICK_CALC_CHROMIUM_PACKAGE ? (await import(process.env.QUICK_CALC_CHROMIUM_PACKAGE + '/build/index.js')).default : null;
const executablePath = process.env.QUICK_CALC_EXECUTABLE || (packaged ? await packaged.executablePath() : null);
const browser = await chromium.launch({ headless: true, args: packaged ? packaged.args : ['--no-sandbox'], ...(executablePath ? { executablePath } : {}) });
let server;
if (!process.env.QUICK_CALC_TEST_URL) {
  const root = resolve('.');
  server = createServer((request, response) => {
    const pathname = new URL(request.url,'http://localhost').pathname;
    if (!pathname.startsWith('/quick-calc/')) { response.writeHead(404).end(); return; }
    const file = resolve(root, decodeURIComponent(pathname.slice('/quick-calc/'.length)) || 'index.html');
    if (!file.startsWith(root+sep)) { response.writeHead(403).end(); return; }
    try { const bytes = readFileSync(file); response.writeHead(200, { 'Content-Type': {'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png'}[extname(file)] || 'application/octet-stream' }); response.end(bytes); }
    catch { response.writeHead(404).end(); }
  });
  await new Promise(done => server.listen(0,'127.0.0.1',done));
}
const url = process.env.QUICK_CALC_TEST_URL || `http://127.0.0.1:${server.address().port}/quick-calc/`;
const origin = new URL(url).origin;
mkdirSync('qa', { recursive: true });
const passed = [], errors = [], requests = [];
const context = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, colorScheme: 'dark', permissions: ['clipboard-read','clipboard-write'] });
context.on('request', r => requests.push(r.url()));
const page = await context.newPage();
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url); await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
const keys = async text => { for (const key of text) await page.locator(`[data-key="${key}"]`).click(); };
const value = async expected => assert.equal(await page.locator('#result').innerText(), expected);
await keys('0.1+0.2='); await value('0.3'); passed.push('小数演算・タップ入力');
await page.locator('[data-key="M+"]').click();
await page.reload(); await page.locator('[data-key="MR"]').click(); await value('0.3');
assert.equal(await page.locator('#memory-indicator').isVisible(),true); assert.equal(await page.locator('#history-count').innerText(),'1'); passed.push('メモリー・履歴の再読み込み後の保存');
await page.locator('[data-key="AC"]').click(); await keys('200+10%='); await value('220');
await page.locator('[data-key="AC"]').click(); await keys('12.5*8+320/4='); await value('180');
await page.locator('#toast.visible').waitFor({state:'hidden'}); await page.screenshot({ path:'qa/mobile-dark.png', fullPage:true });
await page.locator('#copy-calculation').click();
await page.waitForFunction(() => document.querySelector('#toast').textContent === '計算画面をコピーしました');
const clipboard = await page.evaluate(async () => {
  const items=await navigator.clipboard.read(), blob=await items[0].getType('image/png');
  const img=await createImageBitmap(blob), text=await (await items[0].getType('text/plain')).text();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return { width:img.width,height:img.height,type:blob.type,text,bytes:Array.from(bytes) };
});
assert.equal(clipboard.type,'image/png'); assert.equal(clipboard.width,960); assert.equal(clipboard.text,'12.5 × 8 + 320 ÷ 4 = 180');
writeFileSync('qa/copied-calculation.png',Buffer.from(clipboard.bytes)); passed.push('Chromium内のPNGクリップボード書込・読取');
const longImage = await page.evaluate(async () => {
  const {renderCalculation} = await import('./js/clipboard.js');
  const canvas = renderCalculation({expression:Array(120).fill('0.1').join(' + '),result:'12'}, {background:'#142033',expression:'#a5b4ca',result:'#f3f6fc'});
  return {width:canvas.width,height:canvas.height,png:canvas.toDataURL('image/png').split(',')[1]};
});
assert.equal(longImage.width,960); assert.ok(longImage.height>600); writeFileSync('qa/copied-long-calculation.png',Buffer.from(longImage.png,'base64')); passed.push('長い式のPNG折り返し');
await page.evaluate(() => { navigator.clipboard.write = async () => { throw new Error('test unsupported'); }; });
await page.locator('#copy-calculation').click();
await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('テキストをコピーしました'));
assert.equal(await page.evaluate(() => navigator.clipboard.readText()),clipboard.text); passed.push('画像コピー拒否時のテキストフォールバック');
await page.evaluate(() => { navigator.clipboard.writeText = async () => { throw new Error('test denied'); }; document.execCommand = () => false; });
await page.locator('#copy-calculation').click(); await page.locator('#manual-copy').waitFor({state:'visible'});
assert.equal(await page.locator('#manual-text').inputValue(),clipboard.text); await page.locator('#manual-close').click(); passed.push('全コピー拒否時も計算を継続可能');
await page.locator('[data-key="AC"]').click(); await page.keyboard.type('100+20'); await page.keyboard.press('Enter'); await value('120');
await page.keyboard.type('*2'); await page.keyboard.press('Enter'); await value('240');
await page.keyboard.press('Escape'); await page.keyboard.type('12+'); await value('12');
await page.keyboard.press('Backspace'); assert.equal(await page.locator('#expression').innerText(),'12'); passed.push('キーボード・継続計算・未完成式・Backspace');
await page.keyboard.press('Escape'); await page.keyboard.type('10/0'); await value('Error');
await page.keyboard.press('Backspace'); await page.keyboard.type('2'); await value('5'); passed.push('0除算と復旧');
for (const [width,height] of [[320,568],[360,740],[412,915],[1280,900]]) {
  await page.setViewportSize({width,height});
  await page.keyboard.press('Escape'); await page.keyboard.type('999999999999999+0.1');
  const layout = await page.evaluate(() => ({scroll:document.documentElement.scrollWidth, width:innerWidth, result:document.querySelector('#result').getBoundingClientRect().right, display:document.querySelector('.display').getBoundingClientRect().right, buttons:[...document.querySelectorAll('[data-key]')].map(b=>({w:b.clientWidth,h:b.clientHeight}))}));
  assert.ok(layout.scroll<=layout.width,`horizontal overflow at ${width}`); assert.ok(layout.result<=layout.display);
  assert.ok(layout.buttons.every(b=>b.w>=44&&b.h>=42));
}
passed.push('320/360/412/1280pxで横スクロールなし・結果収まり・キーサイズ');
await page.setViewportSize({width:360,height:740}); await page.keyboard.press('Escape'); await keys('12.5*8+320/4=');
await page.locator('#about-open').click(); await page.locator('#theme').selectOption('light'); await page.locator('#about-close').click();
await page.locator('#about-open').click();
await page.evaluate(() => {
  const event = new Event('beforeinstallprompt', {cancelable:true});
  window.installPromptTestCount = 0;
  event.prompt = async () => { window.installPromptTestCount++; };
  event.userChoice = Promise.resolve({outcome:'accepted'});
  window.dispatchEvent(event);
});
await page.locator('#install-app').click();
await page.waitForFunction(() => document.querySelector('#install-status').textContent.includes('受け付けました'));
assert.equal(await page.evaluate(() => window.installPromptTestCount),1);
await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
assert.equal(await page.locator('#install-app').isEnabled(),false);
await page.screenshot({path:'qa/install-about.png',fullPage:true});
await page.locator('#about-close').click(); passed.push('アプリ内追加ボタン・合成イベントでの確認受付と完了表示（OSインストールは未確認）');
await page.locator('#toast.visible').waitFor({state:'hidden'}); await page.screenshot({ path:'qa/mobile-light.png',fullPage:true });
await page.setViewportSize({width:1280,height:900}); await page.screenshot({path:'qa/desktop-light.png',fullPage:true});
await page.locator('#history-panel summary').click(); await page.locator('#history-list button').first().click(); await value('180'); passed.push('履歴再利用');
await page.locator('#history-panel summary').click(); await page.locator('#history-clear').click(); await page.locator('#delete-ok').click();
assert.equal(await page.locator('#history-count').innerText(),'0'); assert.equal(await page.locator('#memory-indicator').isVisible(),true); passed.push('履歴削除でM値を維持');
const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
assert.equal(manifest.id,'/quick-calc/'); assert.equal(manifest.scope,'/quick-calc/');
const cacheEntries = await page.evaluate(async () => { const keys=await caches.keys(); const cache=await caches.open(keys.find(k=>k.startsWith('yuu-quick-calc-'))); return (await cache.keys()).map(r=>r.url); });
assert.ok(cacheEntries.some(u=>u.endsWith('/vendor/decimal.mjs'))); assert.ok(cacheEntries.some(u=>u.endsWith('/icons/maskable-512.png'))); passed.push('PWA固有ID・必要資産キャッシュ');
await context.setOffline(true); await page.reload(); await page.locator('[data-key="AC"]').click(); await keys('0.1+0.2='); await value('0.3');
await page.locator('[data-key="MR"]').click(); await value('0.3');
await page.locator('#copy-calculation').click(); await page.waitForFunction(() => document.querySelector('#toast').textContent==='計算画面をコピーしました');
passed.push('ネット遮断・再読み込み後の演算・M・画像コピー');
await context.setOffline(false); await page.reload();
await page.evaluate(() => localStorage.setItem('yuu.quick-calc.user.v1','null')); await page.reload(); await page.locator('[data-key="7"]').click(); await value('7'); passed.push('壊れた保存形式から復旧');
await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('test quota','QuotaExceededError'); }; });
await page.keyboard.press('Escape'); await page.keyboard.type('0.1+0.2'); await page.keyboard.press('Enter'); await value('0.3');
assert.match(await page.locator('#toast').innerText(),/一時保存/); await page.locator('[data-key="M+"]').click(); passed.push('保存拒否の通知・一時利用の継続');
assert.equal(errors.length,0,JSON.stringify(errors)); assert.ok(requests.every(r=>new URL(r).origin===origin)); passed.push('外部通信なし・ブラウザエラーなし');
const report = { passed, errors, externalRequests: requests.filter(r=>new URL(r).origin!==origin), clipboard:{...clipboard,bytes:undefined}, userAgent:await page.evaluate(()=>navigator.userAgent), unverified:['Android Chrome実機','Windows Chrome実機','実機ホーム画面への追加','実アプリへの画像貼り付け','GitHub Pages公開後の確認'] };
writeFileSync('qa/browser-report.json',JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2));
await browser.close();
if (server) await new Promise(done => server.close(done));
