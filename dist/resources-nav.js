(() => {
  const dropdowns = [...document.querySelectorAll('.nav-dropdown')];

  function sync(details) {
    const summary = details.querySelector(':scope > summary');
    if (summary) summary.setAttribute('aria-expanded', String(details.open));
  }

  dropdowns.forEach(details => {
    sync(details);
    details.addEventListener('toggle', () => {
      if (details.open) {
        dropdowns.forEach(other => {
          if (other !== details && other.open) other.open = false;
        });
      }
      sync(details);
    });

    details.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        details.open = false;
        sync(details);
      });
    });
  });

  document.addEventListener('click', event => {
    dropdowns.forEach(details => {
      if (details.open && !details.contains(event.target)) {
        details.open = false;
        sync(details);
      }
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    dropdowns.forEach(details => {
      if (!details.open) return;
      details.open = false;
      sync(details);
      details.querySelector(':scope > summary')?.focus();
    });
  });
})();