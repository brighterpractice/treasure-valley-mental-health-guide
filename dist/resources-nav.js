/* resources nav v2 */
(() => {
  const unifiedBrandSvg = "<svg viewBox=\"0 0 48 48\" role=\"img\" aria-hidden=\"true\">\n  <circle cx=\"35.5\" cy=\"11.5\" r=\"3.2\" fill=\"currentColor\"/>\n  <path d=\"M5.5 31.5 16.8 16l7.1 9.6 6.6-10.1 12 16\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.35\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n  <path d=\"M7 34.7c5.7-2.6 10.8-2.6 15.4-.2 4.8 2.5 9.1 2.6 13.1.5 2.3-1.2 4.2-1.5 6.2-.8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>\n  <path d=\"M11 40c4.2-2.4 8-2.4 11.5-.1 3.7 2.4 7.1 2.4 10.4.1 2.2-1.5 4.4-1.8 6.6-.9\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"/>\n</svg>";

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