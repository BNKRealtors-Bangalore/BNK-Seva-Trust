(() => {
  const section = document.querySelector(".transparency-section");
  if (!section) return;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  const headerItems = [
    section.querySelector(".transparency-eyebrow"),
    section.querySelector(".transparency-title"),
    section.querySelector(".transparency-subtitle")
  ];

  const columns = [
    ...section.querySelectorAll(".transparency-column")
  ];

  const footerItems = [
    ...section.querySelectorAll(
      ".transparency-footer .transparency-reveal"
    )
  ];

  // Assign reveal delays.
  headerItems.forEach((item, index) => {
    item?.style.setProperty(
      "--tr-delay",
      `${index * 130}ms`
    );
  });

  columns.forEach((column, columnIndex) => {
    const elements = [
      column.querySelector(".transparency-column-top"),
      column.querySelector(".transparency-column-title"),
      ...column.querySelectorAll(".transparency-link")
    ];

    elements.forEach((element, itemIndex) => {
      if (!element) return;

      const delay =
        420 +
        columnIndex * 115 +
        itemIndex * 85;

      element.style.setProperty(
        "--tr-delay",
        `${delay}ms`
      );
    });
  });

  footerItems.forEach((item, index) => {
    item.style.setProperty(
      "--tr-delay",
      `${1150 + index * 150}ms`
    );
  });

  const animatedItems = section.querySelectorAll(
    ".transparency-reveal, .transparency-link"
  );

  function revealSection() {
    section.classList.add("tr-in-view");

    animatedItems.forEach((item) => {
      item.classList.add("tr-visible");
    });
  }

  // Respect reduced-motion preferences.
  if (reduceMotion.matches ||
      !("IntersectionObserver" in window)) {
    revealSection();
    return;
  }

  // Enable reveal styles only when animation is supported.
  // If already visible, allow the entrance animation to begin.
  section.classList.add("tr-animated");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          revealSection();
          observer.disconnect();
        }
      });
    },
    {
      threshold: 0.08,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  observer.observe(section);
})();
