import test from 'node:test';
import assert from 'node:assert/strict';
import { setupInstall } from '../js/install.js';
function fixture(standalone = false) {
  const target = new EventTarget(), button = new EventTarget(), status = {}, help = {};
  const install = setupInstall({ target, button, status, help, isStandalone: () => standalone });
  return { target, button, status, help, ...install };
}
function offer(f, { outcome = 'dismissed', prompt = async () => {}, choice } = {}) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = prompt; event.userChoice = choice || Promise.resolve({ outcome });
  f.target.dispatchEvent(event); return event;
}
test('追加案内がないだけでインストール済みと決めつけない', async () => {
  const f = fixture(); await f.request();
  assert.equal(f.button.disabled, false); assert.equal(f.help.open, true);
  assert.doesNotMatch(f.status.textContent, /インストール済み|追加が完了/);
});
test('明示操作時だけ追加確認を開き、連打・使用済みイベントの再利用を防ぐ', async () => {
  const f = fixture(); let calls = 0, resolveChoice;
  const choice = new Promise(done => { resolveChoice = done; });
  const event = offer(f, { prompt: async () => { calls++; }, choice });
  assert.equal(event.defaultPrevented, true); assert.equal(calls, 0);
  const first = f.request(); await f.request(); assert.equal(calls, 1);
  resolveChoice({ outcome: 'accepted' }); await first;
  assert.match(f.status.textContent, /受け付けました/);
  assert.doesNotMatch(f.status.textContent, /追加が完了しました/);
  await f.request(); assert.equal(calls, 1);
});
test('キャンセル後にブラウザから来た新しい追加確認を使える', async () => {
  const f = fixture(); offer(f); await f.request();
  assert.match(f.status.textContent, /キャンセル/);
  let calls = 0; offer(f, { prompt: async () => { calls++; } }); await f.request();
  assert.equal(calls, 1);
});
test('追加確認が失敗しても復旧案内を出し、例外を外へ漏らさない', async () => {
  const f = fixture(); offer(f, { prompt: async () => { throw new Error('unavailable'); } });
  await f.request(); assert.equal(f.help.open, true); assert.equal(f.button.disabled, false);
  assert.match(f.status.textContent, /開けませんでした/);
});
test('実際の追加完了通知を、遅れて届くuserChoiceで上書きしない', async () => {
  const f = fixture(); let resolveChoice;
  offer(f, { choice: new Promise(done => { resolveChoice = done; }) });
  const request = f.request(); f.target.dispatchEvent(new Event('appinstalled'));
  resolveChoice({ outcome: 'accepted' }); await request;
  assert.equal(f.button.disabled, true); assert.match(f.status.textContent, /追加が完了しました/);
});
test('アプリとして起動中のウィンドウでは追加を繰り返さない', async () => {
  const f = fixture(true); let calls = 0; offer(f, { prompt: async () => { calls++; } });
  await f.request(); assert.equal(calls, 0); assert.equal(f.button.disabled, true);
});
