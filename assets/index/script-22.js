(() => {
  const footer = document.querySelector(".bnk-footer");
  if (!footer) return;

  /* =====================================
     AUTOMATIC COPYRIGHT YEAR
  ===================================== */

  const year = document.getElementById("bnkFooterYear");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  /* =====================================
     STAGGERED REVEAL
  ===================================== */

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const columns = [
    ...footer.querySelectorAll(
      ".bnk-footer-main > .bnk-footer-reveal"
    )
  ];

  // First reveal the main footer columns.
  columns.forEach((column, index) => {
    column.style.setProperty(
      "--footer-delay",
      `${index * 110}ms`
    );
  });

  // Add subtler staggered reveals to the links.
  const links = footer.querySelectorAll(
    ".bnk-footer-column li"
  );

  links.forEach((item, index) => {
    item.classList.add("bnk-footer-reveal");

    item.style.setProperty(
      "--footer-delay",
      `${Math.min(index % 10, 9) * 55}ms`
    );
  });

  function reveal(target) {
    target.classList.add("is-visible");
  }

  const elements = footer.querySelectorAll(
    ".bnk-footer-reveal"
  );

  if (
    reduceMotion ||
    !("IntersectionObserver" in window)
  ) {
    elements.forEach(reveal);
    return;
  }

  footer.classList.add("footer-motion-ready");

  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.08,
      rootMargin: "0px 0px -15px 0px"
    }
  );

  elements.forEach(element => {
    observer.observe(element);
  });

})();
