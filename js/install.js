// A missing install prompt does not prove that the app is installed.
export function setupInstall({ target = window, button, status, help, isStandalone = () => matchMedia('(display-mode: standalone)').matches }) {
  let pending = null, busy = false, installedHere = false;
  function render(message) {
    button.disabled = busy || installedHere || isStandalone();
    status.textContent = message || (isStandalone() ? 'アプリとして起動中です。' : pending ? 'ホーム画面に追加できます。' : 'Chromeが追加を許可すると、確認画面を開けます。');
  }
  target.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); pending = event; render();
  });
  target.addEventListener('appinstalled', () => {
    pending = null; installedHere = true; render('ホーム画面への追加が完了しました。');
  });
  async function request() {
    if (busy || installedHere || isStandalone()) return;
    if (!pending) {
      help.open = true;
      render('この画面から追加する確認を、Chromeがまだ許可していません。下の方法を確認してください。');
      return;
    }
    const event = pending; pending = null; busy = true; render('追加の確認画面を開いています…');
    try {
      // Keep prompt() inside the click handler to preserve user activation.
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (!installedHere) render(outcome === 'accepted' ? '追加を受け付けました。端末での完了をお待ちください。' : '追加をキャンセルしました。');
    } catch {
      if (!installedHere) { help.open = true; render('追加の確認画面を開けませんでした。下の方法を確認してください。'); }
    } finally { busy = false; render(status.textContent); }
  }
  button.addEventListener('click', request); render();
  return { request };
}
