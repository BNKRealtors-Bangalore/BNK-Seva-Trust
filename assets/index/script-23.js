/* BNK Seva Trust — same-document navigation, with consistent history and mobile position. */
(() => {
  const header = document.querySelector('.site-header');
  const gotoSection = (id) => {
    const section = document.getElementById(id);
    if (!section) return;
    const topOffset = id === 'home' ? 0 : (header?.getBoundingClientRect().height || 0) + 4;
    const top = Math.max(0, window.scrollY + section.getBoundingClientRect().top - topOffset);
    // Instant section navigation avoids stopping halfway through long sticky
    // sections, including the animated temple journey, on mobile.
    window.scrollTo({ top, behavior: 'instant' });
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest('.site-header a[href^="#"], .bnk-footer a[href^="#"]');
    if (!link || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const id = decodeURIComponent(link.getAttribute('href').slice(1));
    if (!id || !document.getElementById(id)) return;

    // Keep the donation integration's existing click behavior unchanged.
    if (id === 'donate') return;

    event.preventDefault();
    const url = new URL(window.location.href);
    url.hash = '#' + encodeURIComponent(id);
    // Leaving a product detail restores the regular Store without a page reload.
    url.searchParams.delete('product');
    const destination = url.pathname + url.search + url.hash;
    if (destination !== location.pathname + location.search + location.hash) {
      history.pushState({}, '', destination);
    }
    window.BNKStoreSyncSection?.();
    gotoSection(id);
  });

  // Back/forward must return to the selected section, never arbitrarily to Store.
  window.addEventListener('popstate', () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (id && document.getElementById(id)) requestAnimationFrame(() => gotoSection(id));
    else if (!new URLSearchParams(location.search).has('product')) requestAnimationFrame(() => gotoSection('home'));
  });

  // Deep section links are resolved after all sections are in the DOM.
  const navigationEntry = performance.getEntriesByType('navigation')[0];
  if (location.hash && navigationEntry?.type !== 'reload' &&
      !new URLSearchParams(location.search).has('product')) {
    window.addEventListener('load', () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (id && document.getElementById(id)) gotoSection(id);
    }, { once: true });
  }
})();
