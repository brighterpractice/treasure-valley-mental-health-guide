const STORAGE_KEY = 'tvmhg-admin-theme';
const root = document.documentElement;

function ensureToggle() {
  const existing = document.getElementById('adminThemeToggle');
  if (existing) return existing;

  const host = document.querySelector('.admin-sidebar-bottom');
  if (!host) return null;

  const button = document.createElement('button');
  button.id = 'adminThemeToggle';
  button.className = 'admin-theme-toggle';
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = '<span class="admin-theme-toggle-copy"><strong id="adminThemeLabel">Light mode</strong></span><span class="admin-theme-switch" aria-hidden="true"></span>';
  host.prepend(button);
  return button;
}

const toggle = ensureToggle();
const label = document.getElementById('adminThemeLabel');

function preferredTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function currentTheme() {
  return root.dataset.adminTheme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme, { persist = true } = {}) {
  const next = theme === 'dark' ? 'dark' : 'light';
  root.dataset.adminTheme = next;
  const dark = next === 'dark';

  if (toggle) {
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
  }
  if (label) label.textContent = dark ? 'Dark mode' : 'Light mode';

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
  }
  meta.content = dark ? '#0b1320' : '#f5f8fb';

  if (persist) localStorage.setItem(STORAGE_KEY, next);
}

applyTheme(preferredTheme(), { persist: false });

if (toggle) {
  toggle.addEventListener('click', () => {
    applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  });
}

window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY && (event.newValue === 'dark' || event.newValue === 'light')) {
    applyTheme(event.newValue, { persist: false });
  }
});
