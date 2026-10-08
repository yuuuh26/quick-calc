import { Calculator } from './model.js';
import { formatValue } from './format.js';
import { expressionText } from './engine.js';
import { load, save } from './storage.js';
import { copyCalculation, copyText } from './clipboard.js';
const $ = id => document.getElementById(id);
const loaded = load(), model = new Calculator(loaded.data);
let theme = ['dark', 'light', 'system'].includes(loaded.data.theme) ? loaded.data.theme : 'system';
let toastTimer, saveWarning = false;
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() { document.documentElement.dataset.theme = theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : theme; }
applyTheme(); systemTheme.addEventListener('change', applyTheme); $('theme').value = theme;
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500); }
function persist() {
  const saved = save({ ...model.snapshot(), theme });
  if (!saved && !saveWarning) { saveWarning = true; toast('端末に保存できません。今回の操作は一時保存になります。'); }
  return saved;
}
function renderHistory() {
  $('history-count').textContent = model.history.length; $('history-empty').hidden = !!model.history.length;
  $('history-clear').disabled = !model.history.length;
  $('history-list').replaceChildren(...model.history.map((entry, index) => {
    const li = document.createElement('li'), button = document.createElement('button');
    const expression = document.createElement('span'), result = document.createElement('strong');
    expression.textContent = expressionText(entry.tokens); result.textContent = '= ' + formatValue(entry.result);
    button.append(expression, result); button.addEventListener('click', () => { model.reuse(index); render(); $('history-panel').open = false; window.scrollTo({ top: 0, behavior: 'instant' }); }); li.append(button); return li;
  }));
}
function fitResult() {
  const result = $('result'), line = result.parentElement; let size = 44;
  result.style.fontSize = size + 'px';
  const available = line.clientWidth - $('equals-mark').getBoundingClientRect().width - 8;
  while (result.getBoundingClientRect().width > available && size > 16) result.style.fontSize = --size + 'px';
}
function render() {
  $('expression').textContent = model.text; $('expression').scrollTop = $('expression').scrollHeight;
  $('result').textContent = model.display; $('equals-mark').textContent = model.finalized ? '=' : '';
  $('error').textContent = model.error; $('memory-indicator').hidden = !model.memoryUsed;
  $('memory-indicator').title = 'M: ' + formatValue(model.memory);
  $('calculation-state').textContent = model.error ? '計算を確認' : model.finalized ? '確定' : model.incomplete ? '入力途中' : model.tokens.length ? '途中結果' : '入力待ち';
  $('copy-calculation').disabled = !!model.error;
  renderHistory(); fitResult();
}
function input(key) { const historyLength = model.history.length; model.input(key); render(); const saved = persist(); if (model.notice) toast(model.notice); else if (saved && key === '=' && model.history.length > historyLength) toast('履歴に保存しました'); }
document.querySelectorAll('[data-key]').forEach(button => button.addEventListener('click', () => input(button.dataset.key)));
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  const map = { Enter: '=', Backspace: 'back', Escape: 'AC' };
  const key = map[event.key] || event.key;
  if (/^[0-9.+\-*/%=]$/.test(key) || ['back', 'AC'].includes(key)) {
    if (event.key === 'Enter' && event.target.tagName === 'BUTTON' && !event.target.hasAttribute('data-key')) return;
    event.preventDefault(); input(key);
  }
});
function manualCopy(text) { $('manual-text').value = text; $('manual-copy').showModal(); $('manual-text').focus(); $('manual-text').select(); }
$('copy-calculation').addEventListener('click', async () => {
  if (model.error) return;
  const css = getComputedStyle(document.documentElement);
  const copied = await copyCalculation({ expression: model.text, result: model.display, incomplete: model.incomplete }, { background: css.getPropertyValue('--surface').trim(), expression: css.getPropertyValue('--muted').trim(), result: css.getPropertyValue('--text').trim() });
  if (copied.kind === 'image') toast('計算画面をコピーしました');
  else if (copied.kind === 'text') toast('画像コピーが使えないため、テキストをコピーしました');
  else manualCopy(copied.text);
});
$('manual-close').addEventListener('click', () => $('manual-copy').close());
$('about-open').addEventListener('click', () => $('about').showModal());
$('about-close').addEventListener('click', () => $('about').close());
$('theme').addEventListener('change', () => { theme = $('theme').value; applyTheme(); persist(); });
$('history-clear').addEventListener('click', () => $('delete-confirm').showModal());
$('delete-cancel').addEventListener('click', () => $('delete-confirm').close());
$('delete-ok').addEventListener('click', () => { model.history = []; const saved = persist(); render(); $('delete-confirm').close(); toast(saved ? '履歴を削除しました' : '履歴を削除しました。端末への保存はできません。'); });
$('copy-url').addEventListener('click', async () => { const url = $('public-url').href; if (await copyText(url)) toast('コピーしました'); else manualCopy(url); });
if (location.origin !== 'https://yuuuh26.github.io' || !location.pathname.startsWith('/quick-calc/')) $('url-label').textContent = '公開予定URL';
window.addEventListener('resize', fitResult); render();
if (!loaded.ok) toast('保存内容を読み込めませんでした。');
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(async () => {
    await navigator.serviceWorker.ready; $('offline-status').textContent = 'オフラインでも利用できます。';
  }).catch(() => { $('offline-status').textContent = 'オフライン準備ができませんでした。接続中は利用できます。'; });
} else $('offline-status').textContent = 'この環境はオフライン保存に対応していません。';
