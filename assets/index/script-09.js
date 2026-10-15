(() => {
  const revealSections = [
    {
      root: "#special-seva",
      selectors: [
        ".special-seva-eyebrow",
        ".special-seva-header h2",
        ".special-seva-header p",
        ".special-featured-card",
        ".special-seva-card"
      ]
    },
    {
      root: "#choose-seva",
      selectors: [
        ".choose-seva-ornament",
        ".choose-seva-header h2",
        ".choose-seva-header p",
        ".choose-seva-card",
        ".choose-seva-donation"
      ]
    },
    {
      root: "#upcoming-seva",
      selectors: [
        ".upcoming-seva-eyebrow",
        ".upcoming-seva-heading h2",
        ".upcoming-view-all",
        ".upcoming-featured",
        ".upcoming-side-event"
      ]
    },
    {
      root: "#temple-journey",
      selectors: [
        ".journey-eyebrow",
        ".journey-copy h2",
        ".journey-title",
        ".journey-links",
        ".journey-timeline"
      ]
    },
    {
      root: "#temple-updates",
      selectors: [
        ".temple-updates-eyebrow",
        ".temple-updates-ornament",
        ".temple-updates-header h2",
        ".temple-updates-subtitle",
        ".temple-update-card",
        ".temple-updates-footer"
      ]
    }
  ];

  const items = [];
  const delayStep = 90;
  const maxDelay = 720;

  revealSections.forEach(({ root, selectors }) => {
    const section = document.querySelector(root);
    if (!section) return;

    let index = 0;

    selectors.forEach((selector) => {
      section.querySelectorAll(selector).forEach((item) => {
        if (item.classList.contains("reveal")) return;

        item.classList.add("reveal");
        item.style.setProperty(
          "--reveal-delay",
          Math.min(index * delayStep, maxDelay) + "ms"
        );

        items.push(item);
        index += 1;
      });
    });
  });

  if (!items.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  if (!("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver((entries, revealObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, {
    rootMargin: "0px 0px -12% 0px",
    threshold: 0.14
  });

  items.forEach((item) => observer.observe(item));
})();
