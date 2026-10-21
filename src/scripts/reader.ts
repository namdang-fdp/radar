export {};

let toastTimer: number | undefined;
function toast(message: string) {
  const element = document.querySelector<HTMLElement>('#toast');
  if (!element) return;
  element.textContent = message;
  window.clearTimeout(toastTimer);
  element.classList.add('is-open');
  toastTimer = window.setTimeout(() => { element.classList.remove('is-open'); }, 4500);
}
async function updateState(id: string, state: 'saved' | 'read', value: boolean) {
  const response = await fetch(`/api/articles/${id}/state`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ state, value }) });
  if (!response.ok) throw new Error('Chưa lưu được thay đổi. Bạn thử lại nhé.');
}
document.querySelectorAll<HTMLButtonElement>('[data-bookmark]').forEach((button) => {
  button.addEventListener('click', async () => {
    const saved = button.getAttribute('aria-pressed') !== 'true';
    button.disabled = true;
    try {
      await updateState(button.dataset.bookmark!, 'saved', saved);
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', saved ? 'Bỏ lưu bài viết' : 'Lưu bài viết');
      button.title = saved ? 'Bỏ lưu bài viết' : 'Lưu để đọc sau';
      button.classList.toggle('saved', saved);
      const icon = button.querySelector<HTMLElement>('.t-icon-swap');
      if (icon) icon.dataset.state = saved ? 'b' : 'a';
      const label = button.querySelector('[data-save-label]');
      if (label) label.textContent = saved ? 'Đã lưu' : 'Lưu bài viết';
      document.querySelectorAll('[data-saved-count]').forEach((count) => { count.textContent = String(Math.max(0, Number(count.textContent) + (saved ? 1 : -1))); });
      toast(saved ? 'Đã lưu vào góc đọc của bạn.' : 'Đã bỏ lưu bài viết.');
    } catch (error) { toast((error as Error).message); }
    finally { button.disabled = false; }
  });
});
const readButton = document.querySelector<HTMLButtonElement>('[data-read]');
function showRead(value: boolean) {
  if (!readButton) return;
  const wasRead = readButton.getAttribute('aria-pressed') === 'true';
  if (wasRead !== value) document.querySelectorAll('[data-unread-count]').forEach((count) => { count.textContent = String(Math.max(0, Number(count.textContent) + (value ? -1 : 1))); });
  readButton.setAttribute('aria-pressed', String(value));
  readButton.querySelector('span')!.textContent = value ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc';
}
let readTimer: number | undefined;
const article = document.querySelector<HTMLElement>('[data-article-id]');
if (article && article.dataset.isRead !== 'true') readTimer = window.setTimeout(async () => {
  if (document.visibilityState !== 'visible') return;
  try { await updateState(article.dataset.articleId!, 'read', true); showRead(true); } catch { /* Opening an article remains usable when state cannot be saved. */ }
}, 1500);
readButton?.addEventListener('click', async () => {
  window.clearTimeout(readTimer);
  const value = readButton.getAttribute('aria-pressed') !== 'true';
  readButton.disabled = true;
  try { await updateState(readButton.dataset.read!, 'read', value); showRead(value); toast(value ? 'Đã đánh dấu đã đọc.' : 'Đã đánh dấu chưa đọc.'); }
  catch (error) { toast((error as Error).message); }
  finally { readButton.disabled = false; }
});
const refresh = document.querySelector<HTMLButtonElement>('[data-refresh]');
let polling = false;
async function pollCollection() {
  if (polling || !refresh) return;
  polling = true;
  refresh.disabled = true;
  refresh.classList.add('refreshing');
  refresh.querySelector('[data-refresh-label]')!.textContent = 'Đang lấy bài mới…';
  let failures = 0;
  const poll = async () => {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) throw new Error('Status unavailable');
      const { run } = await response.json();
      if (run && run.status !== 'running') {
        sessionStorage.setItem('radar-update', run.status === 'completed' ? `Đã cập nhật thư viện.${run.failedSources ? ` ${run.failedSources} nguồn cần kiểm tra.` : ''}` : 'Lượt cập nhật gặp lỗi. Bạn có thể thử lại.');
        window.location.reload();
        return;
      }
      failures = 0;
    } catch { failures++; }
    if (failures >= 5) {
      toast('Mất kết nối trạng thái. Tải lại trang để kiểm tra.');
      refresh.disabled = false; refresh.classList.remove('refreshing'); polling = false;
      refresh.querySelector('[data-refresh-label]')!.textContent = 'Cập nhật bài';
      return;
    }
    window.setTimeout(poll, 2500);
  };
  window.setTimeout(poll, 1500);
}
refresh?.addEventListener('click', async () => {
  refresh.disabled = true;
  try {
    const response = await fetch('/api/refresh', { method: 'POST' });
    const result = await response.json();
    if (response.status === 409 || response.ok) { await pollCollection(); return; }
    throw new Error(result.error || 'Chưa cập nhật được.');
  } catch (error) { refresh.disabled = false; toast((error as Error).message); }
});
if (refresh?.dataset.running === 'true') void pollCollection();
const updateMessage = sessionStorage.getItem('radar-update');
if (updateMessage) { toast(updateMessage); sessionStorage.removeItem('radar-update'); }
const menu = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
const navigation = document.querySelector<HTMLElement>('#navigation');
const mobile = window.matchMedia('(max-width: 900px)');
function syncNavigation() {
  if (!mobile.matches) {
    document.body.classList.remove('nav-open');
    menu?.setAttribute('aria-expanded', 'false');
  }
  const open = mobile.matches && document.body.classList.contains('nav-open');
  if (navigation) navigation.inert = mobile.matches && !open;
  const workspace = document.querySelector<HTMLElement>('.workspace');
  if (workspace) workspace.inert = open;
}
syncNavigation();
mobile.addEventListener('change', syncNavigation);
function closeMenu() { document.body.classList.remove('nav-open'); menu?.setAttribute('aria-expanded', 'false'); syncNavigation(); menu?.focus(); }
menu?.addEventListener('click', () => { document.body.classList.toggle('nav-open'); const open = document.body.classList.contains('nav-open'); menu.setAttribute('aria-expanded', String(open)); syncNavigation(); if (open) document.querySelector<HTMLButtonElement>('[data-menu-close]')?.focus(); });
document.querySelectorAll('[data-menu-close]').forEach((button) => button.addEventListener('click', closeMenu));
document.addEventListener('keydown', (event) => {
  if (!document.body.classList.contains('nav-open')) return;
  if (event.key === 'Escape') closeMenu();
  if (event.key === 'Tab') {
    const targets = [...document.querySelectorAll<HTMLElement>('#navigation a, #navigation button')].filter((element) => element.offsetParent !== null);
    if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === targets.at(-1)) { event.preventDefault(); targets[0]?.focus(); }
  }
});
