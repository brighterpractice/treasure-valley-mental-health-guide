/* resources nav v3 */
(() => {
  const unifiedBrandSvg = "<svg viewBox=\"0 0 48 48\" role=\"img\" aria-hidden=\"true\">\n  <circle cx=\"36\" cy=\"10\" r=\"3.1\" fill=\"currentColor\"/>\n  <path d=\"M36 4.7v2.1M36 13.2v2.1M30.7 10h2.1M39.2 10h2.1\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\" stroke-linecap=\"round\"/>\n  <path d=\"M5.5 31.5 15.8 18l5.7 7.2 5.6-10.3 15.4 16.6Z\" fill=\"currentColor\" opacity=\".14\"/>\n  <path d=\"M5.5 31.5 15.8 18l5.7 7.2 5.6-10.3 15.4 16.6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.25\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n  <path d=\"M15.8 18l3 4 2.7-2.2 5.6-4.9 4.2 4.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.35\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".8\"/>\n  <path d=\"M7 34.1c5.8-2.3 10.8-2 14.9.6 4.4 2.8 8.7 2.9 12.8.3 2.7-1.7 5.1-1.9 7.3-.8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>\n  <path d=\"M11 40.2c4.1-2.5 7.9-2.5 11.4-.2 3.8 2.4 7.2 2.3 10.4-.1 2.1-1.6 4.3-1.9 6.7-1\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"/>\n</svg>";

  document.querySelectorAll('.align-brand-mark, .brand-mark').forEach(mark => {
    mark.innerHTML = unifiedBrandSvg;
  });

  document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
    const link = document.createElement('a');
    link.href = '/resources';
    link.textContent = 'Resources';

    if (dropdown.closest('nav')?.querySelector('a.active[href="/resources"]')) {
      link.classList.add('active');
    }

    dropdown.replaceWith(link);
  });
})();