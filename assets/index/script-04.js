(() => {
  /* ======================================
     SPONSORSHIP CONFIGURATION
     Set verified amount once available.
     amount: null = estimate pending
  ====================================== */

  let sponsorships = [
    {
      id: "temple-bell",
      name: "Temple Bell",
      description:
        "The sacred bell that calls devotees, marks prayers and fills the temple with divine sound.",
      image: "/images/optimized/bell-1254.webp",
      category: "devotion",
      amount: null
    },
    {
      id: "murti-sthapana",
      name: "Murti Sthapana",
      description:
        "Sponsor the consecration of sacred murtis and bring divine presence to the temple.",
      image: "/images/optimized/moorthy-1254.webp",
      category: "devotion",
      amount: null
    },
    {
      id: "prayer-hall",
      name: "Prayer Hall",
      description:
        "Support the creation of a serene prayer hall for collective worship, chanting and satsang.",
      image: "/images/optimized/prayerhall-1254.webp",
      category: "devotion",
      amount: null
    },
    {
      id: "temple-garden",
      name: "Temple Garden",
      description:
        "Help develop a peaceful temple garden for reflection, nature and devotional gatherings.",
      image: "images/optimized/garden-1086.webp",
      category: "facilities",
      amount: null
    },
    {
      id: "main-entrance",
      name: "Main Entrance",
      description:
        "Help create a beautiful and welcoming entrance to the sacred temple premises.",
      image: "/images/optimized/entrance-1086.webp",
      category: "facilities",
      amount: null
    },
    {
      id: "marble-flooring",
      name: "Marble Flooring",
      description:
        "Support elegant, durable flooring throughout the sacred temple spaces.",
      image: "/images/optimized/flooring-1254.webp",
      category: "facilities",
      amount: null
    },
    {
      id: "temple-lighting",
      name: "Temple Lighting",
      description:
        "Illuminate sacred spaces with thoughtfully designed devotional lighting.",
      image: "/images/optimized/lightings-1254.webp",
      category: "facilities",
      amount: null
    },
    {
      id: "anna-seva-kitchen",
      name: "Prasad & Anna Seva Kitchen",
      description:
        "Support a dedicated kitchen for preparing prasad and serving nourishing meals.",
      image: "/images/optimized/kitchen-1254.webp",
      category: "community",
      amount: null
    },
    {
      id: "water-facility",
      name: "Water Facility",
      description:
        "Help provide clean drinking water and essential water facilities for devotees.",
      image: "/images/optimized/water-1086.webp",
      category: "facilities",
      amount: null
    },
    {
      id: "spiritual-library",
      name: "Spiritual Library",
      description:
        "Create a peaceful space for spiritual literature, learning and reflection.",
      image: "/images/optimized/library-1086.webp",
      category: "community",
      amount: null
    },
    {
      id: "community-hall",
      name: "Community Hall",
      description:
        "Support a welcoming space for seva activities, gatherings and community programmes.",
      image: "/images/optimized/hall-1254.webp",
      category: "community",
      amount: null
    },
    {
      id: "satsang-space",
      name: "Satsang Space",
      description:
        "Help create a dedicated space for bhajans, spiritual discourse and devotion.",
      image: "/images/optimized/satsang-1254.webp",
      category: "devotion",
      amount: null
    },
    {
      id: "other-facilities",
      name: "Other Temple Facilities",
      description:
        "Contribute towards essential facilities that support the temple and its devotees.",
      image: "/images/optimized/other-1254.webp",
      category: "facilities",
      amount: null
    }
  ];

  const viewport =
    document.getElementById("sponsorViewport");

  const track =
    document.getElementById("sponsorTrack");

  const previous =
    document.getElementById("sponsorPrev");

  const next =
    document.getElementById("sponsorNext");

  if (!viewport || !track) return;

  const formatter = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  });

  const prefersReducedMotion =
    window.matchMedia("(prefers-reduced-motion: reduce)");

  let paused = false;
  let groupWidth = 0;
  let lastFrame = 0;

  // Autoscroll speed in pixels per second.
  const scrollSpeed = 30;

  async function loadSponsorshipPricing() {
    try {
      const response = await fetch("/api/pricing-config", { cache: "no-store" });
      if (!response.ok) return;
      const config = await response.json();
      if (!config.sponsorshipAmounts) return;
      sponsorships = sponsorships.map((item) => ({
        ...item,
        amount: Object.prototype.hasOwnProperty.call(config.sponsorshipAmounts, item.id)
          ? config.sponsorshipAmounts[item.id]
          : item.amount
      }));
      renderCards();
      calculateWidth();
    } catch {
      // Keep built-in defaults if admin pricing cannot load.
    }
  }

  const escapeHTML = (value) =>
    String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));

  function makeCard(item) {
    const card = document.createElement("article");
    card.className = "sponsor-card";

    const estimate =
      item.amount === null
        ? "Verified estimate pending"
        : formatter.format(item.amount);

    card.innerHTML = `
      <figure class="sponsor-card-image">
        <img
          src="${escapeHTML(item.image)}"
          alt="${escapeHTML(item.name)}"
          loading="lazy" decoding="async"
        />
      </figure>

      <div class="sponsor-card-content">
        <h3 class="sponsor-card-title">
          ${escapeHTML(item.name)}
        </h3>

        <p class="sponsor-card-description">
          ${escapeHTML(item.description)}
        </p>

        <div class="sponsor-card-bottom">
          <div class="sponsor-estimate">
            <span class="sponsor-shield" aria-hidden="true">♢</span>
            <span>${escapeHTML(estimate)}</span>
          </div>

          <button class="sponsor-donate" type="button">
            DONATE <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    `;

    card.querySelector(".sponsor-donate")
      .addEventListener("click", () => {
        document.dispatchEvent(
          new CustomEvent("temple:sponsor-selected", {
            detail: {
              id: item.id,
              name: item.name,
              amount: item.amount
            }
          })
        );
      });

    return card;
  }

  function renderCards() {
    // Repeat cards within each group so even smaller
    // categories support a continuous carousel.
    const items = [];
    while (items.length < 8) {
      items.push(...sponsorships);
    }

    track.replaceChildren();

    // Three identical runs create a seamless loop.
    for (let runIndex = 0; runIndex < 3; runIndex++) {
      const run = document.createElement("div");
      run.className = "sponsor-run";

      items.forEach((item) => {
        run.appendChild(makeCard(item));
      });

      track.appendChild(run);
    }

    requestAnimationFrame(() => {
      calculateWidth();
      viewport.scrollLeft = groupWidth;
    });
  }

  function calculateWidth() {
    const runs = track.querySelectorAll(".sponsor-run");

    if (runs.length < 2) return;

    groupWidth =
      runs[1].offsetLeft - runs[0].offsetLeft;
  }

  function wrapScrollPosition() {
    if (!groupWidth) return;

    if (viewport.scrollLeft < groupWidth * 0.5) {
      viewport.scrollLeft += groupWidth;
    } else if (
      viewport.scrollLeft > groupWidth * 1.5
    ) {
      viewport.scrollLeft -= groupWidth;
    }
  }

  // Continuous automatic scroll from left to right.
  function animate(timestamp) {
    if (!lastFrame) lastFrame = timestamp;

    const delta = Math.min(timestamp - lastFrame, 60);
    lastFrame = timestamp;

    if (!paused &&
        !prefersReducedMotion.matches &&
        groupWidth) {
      viewport.scrollLeft -=
        scrollSpeed * delta / 1000;

      wrapScrollPosition();
    }

    requestAnimationFrame(animate);
  }

  // Mouse hover pauses scrolling.
  viewport.addEventListener("mouseenter", () => {
    paused = true;
  });

  viewport.addEventListener("mouseleave", () => {
    paused = false;
  });

  // Pause during touch interaction or keyboard focus.
  viewport.addEventListener("touchstart", () => {
    paused = true;
  }, { passive: true });

  viewport.addEventListener("touchend", () => {
    paused = false;
  }, { passive: true });

  viewport.addEventListener("focusin", () => {
    paused = true;
  });

  viewport.addEventListener("focusout", (event) => {
    if (!viewport.contains(event.relatedTarget)) {
      paused = false;
    }
  });

  viewport.addEventListener("scroll", () => {
    wrapScrollPosition();
  }, { passive: true });

  // Manual arrow controls
  function scrollCards(direction) {
    const firstCard = track.querySelector(".sponsor-card");

    const distance = firstCard
      ? firstCard.offsetWidth + 16
      : 300;

    // Temporarily pause the automatic movement
    // while the manual navigation is taking place.
    paused = true;

    viewport.scrollBy({
      left: direction * distance,
      behavior: prefersReducedMotion.matches
        ? "instant"
        : "smooth"
    });
  }

  previous.addEventListener("click", () => {
    scrollCards(-1);
  });

  next.addEventListener("click", () => {
    scrollCards(1);
  });

  document.querySelector(".sponsor-carousel-wrap")
    .addEventListener("mouseleave", () => {
      paused = false;
    });

  window.addEventListener("resize", () => {
    calculateWidth();
    if (groupWidth) {
      viewport.scrollLeft = groupWidth;
    }
  });

  renderCards();
  loadSponsorshipPricing();
  requestAnimationFrame(animate);
})();
