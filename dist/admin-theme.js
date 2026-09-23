const STORAGE_KEY = 'tvmhg-admin-theme';
const root = document.documentElement;
const toggle = document.getElementById('adminThemeToggle');
const label = document.getElementById('adminThemeLabel');

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

applyTheme(currentTheme(), { persist: false });
