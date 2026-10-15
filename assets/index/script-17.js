(() => {
  const section = document.getElementById("voices-of-seva");
  if (!section) return;

  /* =========================================
     TESTIMONIAL DATA
     Replace with approved, genuine testimonials.
  ========================================= */

  const defaultTestimonials = [
    {
      id: "savitri",
      name: "Savitri Devi",
      role: "Food Seva Beneficiary",
      category: "beneficiary",
      quote:
        "The meals we receive are not just food, they are Baba’s blessings. It gives us strength and hope every day.",
      image: "images/optimized/beneficiary_2-1122.webp",
      video: null
    },
    {
      id: "rohit",
      name: "Rohit Sharma",
      role: "Seva Volunteer",
      category: "volunteer",
      quote:
        "Volunteering with BNK Seva Trust has changed my perspective on life. It has taught me the true meaning of service and gratitude.",
      image: "images/optimized/volunteer_1-1122.webp",
      video: null
    },
    {
      id: "priya",
      name: "Priya Mehta",
      role: "Donor",
      category: "donor",
      quote:
        "Supporting the temple project feels like being a part of something divine. It is an honour to contribute to Baba’s work and see the impact firsthand.",
      image: "images/optimized/donor_1-1122.webp",
      video: null
    },
    {
      id: "ramesh",
      name: "Ramesh Kumar",
      role: "Community Member",
      category: "community",
      quote:
        "BNK Seva Trust has brought real change to our community — from health camps to education support. We feel cared for and included in this journey.",
      image: "images/optimized/community_member_1-1122.webp",
      video: null
    },
    {
      id: "mohan",
      name: "Mohan Dutta",
      role: "Seva Beneficiary",
      category: "beneficiary",
      quote:
        "A helping hand can bring comfort, dignity and hope when it matters most.",
      image: "images/optimized/beneficiary_1-1122.webp",
      video: null
    },
    {
      id: "anjali",
      name: "Anjali Singh",
      role: "Seva Volunteer",
      category: "volunteer",
      quote:"Seeing a smile on someone’s face after a simple act of kindness is the most rewarding part of being a volunteer.",
      image: "images/optimized/volunteer_2-1122.webp",
      video: null
    },
    {
      id: "prakash",
      name: "Prakash varma",
      role: "Seva Contributor",
      category: "donor",
      quote:
      "Volunteering has taught me that true happiness comes from helping others. Every day of seva leaves me feeling grateful.",
      image: "images/optimized/donor_2-1122.webp",
      video: null
    },
     {
      id: "sunitha",
      name: "Sunitha Mishra",
      role: "Community Member",
      category: "community",
      quote:
      "It is heartwarming to see people supporting one another. These initiatives are bringing hope and kindness to our community.",
      image: "images/optimized/community_member_2-1122.webp",
      video: null
    },
  ];

  let testimonials = [...defaultTestimonials];
  let activeCategory = "all";

  const categoryNames = {
    beneficiary: "Beneficiary",
    volunteer: "Volunteer",
    donor: "Donor",
    community: "Community Member"
  };

  const categoryIcons = {
    beneficiary: "♧",
    volunteer: "♡",
    donor: "♡",
    community: "♧"
  };

  const adminVoiceCategory = value => ({
    Beneficiary: "beneficiary",
    Volunteer: "volunteer",
    Donor: "donor",
    "Community Member": "community"
  }[value] || "community");

  /* =========================================
     DOM ELEMENTS
  ========================================= */

  const carousel =
    document.getElementById("voicesCarousel");

  const viewport =
    document.getElementById("voicesViewport");

  const track =
    document.getElementById("voicesTrack");

  const prevButton =
    document.getElementById("voicesPrev");

  const nextButton =
    document.getElementById("voicesNext");

  const pagination =
    document.getElementById("voicesPagination");

  const status =
    document.getElementById("voicesCarouselStatus");

  const tabs = [
    ...document.querySelectorAll(
      "#voicesTabs .voices-tab"
    )
  ];

  const modal =
    document.getElementById("voicesVideoModal");

  const modalClose =
    document.getElementById("voicesVideoClose");

  const video =
    document.getElementById("voicesVideoPlayer");

  const videoError =
    document.getElementById("voicesVideoError");

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  let currentIndex = 0;
  let cards = [];
  let autoTimer = null;
  let isHovered = false;
  let hasFocus = false;
  let isVisible = false;
  let lastFocused = null;

  const AUTO_INTERVAL = 7200;

  /* =========================================
     CREATE TESTIMONIAL CARD
  ========================================= */

  function createCard(item, index) {
    const card = document.createElement("article");

    card.className = "voice-card";
    card.dataset.category = item.category;
    card.style.setProperty(
      "--voices-delay",
      `${550 + index * 90}ms`
    );

    // Image area
    const imageArea = document.createElement("div");
    imageArea.className = "voice-card-image";

    const image = document.createElement("img");
    image.src = item.image;
    image.alt = "";
    image.loading = index < 4 ? "eager" : "lazy";
    image.decoding = "async";

    // Portrait only — roles appear beneath quotes, not as image pills.
    // If an image is missing, use a styled placeholder, not the broken-image icon.
    if (item.image) {
      image.addEventListener("error", () => {
        image.remove();
        const fallback = document.createElement("span");
        fallback.className = "voice-card-image-fallback";
        fallback.setAttribute("aria-hidden", "true");
        fallback.textContent = "♡";
        imageArea.appendChild(fallback);
      }, { once: true });
      imageArea.appendChild(image);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "voice-card-image-fallback";
      fallback.setAttribute("aria-hidden", "true");
      fallback.textContent = "♡";
      imageArea.appendChild(fallback);
    }

    // Optional video
    if (item.video) {
      const play = document.createElement("button");
      play.type = "button";
      play.className = "voice-card-play";
      play.setAttribute(
        "aria-label",
        "Play testimonial video: " + item.name
      );

      play.addEventListener("click", () => {
        openVideo(item.video);
      });

      imageArea.appendChild(play);
    }

    // Quote
    const body = document.createElement("div");
    body.className = "voice-card-body";

    const quoteMark = document.createElement("span");
    quoteMark.className = "voice-quote-mark";
    quoteMark.setAttribute("aria-hidden", "true");
    quoteMark.textContent = "“";

    const quote = document.createElement("blockquote");
    quote.className = "voice-card-quote";
    quote.textContent = item.quote;

    // Profile
    const profile = document.createElement("div");
    profile.className = "voice-profile";

    // No duplicate portrait beneath the quote: show just name and role.
    const profileText = document.createElement("div");

    const name = document.createElement("h3");
    name.className = "voice-profile-name";
    name.textContent = item.name;

    const role = document.createElement("span");
    role.className = "voice-profile-role";
    role.textContent = item.role;

    profileText.append(name, role);
    profile.appendChild(profileText);

    body.append(quoteMark, quote, profile);
    card.append(imageArea, body);

    return card;
  }

  /* =========================================
     RENDER CARDS
  ========================================= */

  function renderCards() {
    const fragment = document.createDocumentFragment();

    getFilteredTestimonials().forEach((item, index) => {
      fragment.appendChild(createCard(item, index));
    });

    track.replaceChildren(fragment);

    cards = [...track.querySelectorAll(".voice-card")];
  }

  /* =========================================
     RESPONSIVE VISIBLE CARD COUNT
  ========================================= */

  function getVisibleCount() {
    const value = getComputedStyle(carousel)
      .getPropertyValue("--voices-per-view");

    return Math.max(1, parseInt(value, 10) || 4);
  }

  function getMaxIndex() {
    return Math.max(
      0,
      getFilteredTestimonials().length - getVisibleCount()
    );
  }

  /* =========================================
     UPDATE CAROUSEL POSITION
  ========================================= */

  function goTo(index) {
    currentIndex = Math.min(
      Math.max(index, 0),
      getMaxIndex()
    );

    const firstCard = cards[0];
    const targetCard = cards[currentIndex];

    if (!firstCard || !targetCard) return;

    // Move exactly one card width, including gap.
    const distance =
      targetCard.offsetLeft - firstCard.offsetLeft;

    track.style.transform =
      `translate3d(${-distance}px, 0, 0)`;

    const visibleCount = getVisibleCount();

    // Keep off-screen cards out of keyboard navigation.
    cards.forEach((card, index) => {
      const visible =
        index >= currentIndex &&
        index < currentIndex + visibleCount;

      card.inert = !visible;
      card.setAttribute(
        "aria-hidden",
        String(!visible)
      );
    });

    prevButton.disabled = currentIndex === 0;
    nextButton.disabled =
      currentIndex >= getMaxIndex();

    updateDots();
    syncTabs();

    status.textContent =
      `Showing testimonials ${currentIndex + 1} to ` +
      `${Math.min(
        currentIndex + visibleCount,
        getFilteredTestimonials().length
      )} of ${getFilteredTestimonials().length}`;
  }

  /* =========================================
     PAGINATION DOTS
  ========================================= */

  function renderDots() {
    pagination.replaceChildren();

    const count = getMaxIndex() + 1;

    for (let i = 0; i < count; i++) {
      const dot = document.createElement("button");

      dot.type = "button";
      dot.className = "voices-dot";
      dot.setAttribute(
        "aria-label",
        `Show testimonial position ${i + 1}`
      );

      dot.addEventListener("click", () => {
        goTo(i);
        restartAutoplay();
      });

      pagination.appendChild(dot);
    }

    updateDots();
  }

  function updateDots() {
    const dots = pagination.querySelectorAll(
      ".voices-dot"
    );

    dots.forEach((dot, index) => {
      const active = index === currentIndex;

      dot.classList.toggle("active", active);
      dot.setAttribute(
        "aria-current",
        active ? "true" : "false"
      );
    });
  }

  /* =========================================
     CATEGORY SPOTLIGHT TABS

     Keeps the mixed four-card layout in
     your reference. Selecting a category
     navigates to its first matching story.
  ========================================= */

  function syncTabs() {
    tabs.forEach(tab => {
      const active =
        tab.dataset.voiceCategory === activeCategory;

      tab.classList.toggle("active", active);
      tab.setAttribute(
        "aria-pressed",
        String(active)
      );
    });
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      activeCategory = tab.dataset.voiceCategory;
      renderCards();
      renderDots();
      goTo(0);

      restartAutoplay();
    });
  });

  /* =========================================
     LEFT / RIGHT BUTTONS
  ========================================= */

  prevButton.addEventListener("click", () => {
    goTo(currentIndex - 1);
    restartAutoplay();
  });

  nextButton.addEventListener("click", () => {
    goTo(currentIndex + 1);
    restartAutoplay();
  });

  /* =========================================
     OPTIONAL AUTOMATIC SLIDING
  ========================================= */

  function stopAutoplay() {
    if (autoTimer !== null) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();

    if (
      reduceMotion ||
      isHovered ||
      hasFocus ||
      !isVisible ||
      !modal.hidden ||
      document.hidden ||
      getMaxIndex() === 0
    ) {
      return;
    }

    autoTimer = setInterval(() => {
      const next =
        currentIndex >= getMaxIndex()
          ? 0
          : currentIndex + 1;

      goTo(next);
    }, AUTO_INTERVAL);
  }

  function restartAutoplay() {
    startAutoplay();
  }

  section.addEventListener("mouseenter", () => {
    isHovered = true;
    stopAutoplay();
  });

  section.addEventListener("mouseleave", () => {
    isHovered = false;
    startAutoplay();
  });

  section.addEventListener("focusin", () => {
    hasFocus = true;
    stopAutoplay();
  });

  section.addEventListener("focusout", event => {
    if (
      !event.relatedTarget ||
      !section.contains(event.relatedTarget)
    ) {
      hasFocus = false;
      startAutoplay();
    }
  });

  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.hidden) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    }
  );

  /* =========================================
     VIDEO MODAL
  ========================================= */

  function openVideo(src) {
    lastFocused = document.activeElement;
    stopAutoplay();

    videoError.hidden = true;
    video.hidden = false;
    video.src = src;

    modal.hidden = false;
    document.body.style.overflow = "hidden";

    modalClose.focus();

    video.play().catch(() => {
      // Autoplay may require the visitor to press Play.
    });
  }

  function closeVideo() {
    video.pause();
    video.removeAttribute("src");
    video.load();

    modal.hidden = true;
    document.body.style.overflow = "";

    lastFocused?.focus();
    startAutoplay();
  }

  video.addEventListener("error", () => {
    video.hidden = true;
    videoError.hidden = false;
  });

  modalClose.addEventListener("click", closeVideo);

  modal.addEventListener("click", event => {
    if (event.target === modal) closeVideo();
  });

  document.addEventListener("keydown", event => {
    if (!modal.hidden) {
      if (event.key === "Escape") {
        closeVideo();
      }

      // Keep keyboard focus inside the open dialog.
      if (event.key === "Tab") {
        const focusables = video.hidden
          ? [modalClose]
          : [modalClose, video];

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (
          event.shiftKey &&
          document.activeElement === first
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last
        ) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }

    // Keyboard navigation within the carousel.
    if (!carousel.contains(document.activeElement)) {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(currentIndex + 1);
      restartAutoplay();
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(currentIndex - 1);
      restartAutoplay();
    }
  });

  /* =========================================
     STAGGERED SCROLL REVEAL
  ========================================= */

  function revealSection() {
    section.classList.add("voices-in-view");
  }

  function getFilteredTestimonials() {
    return activeCategory === "all"
      ? testimonials
      : testimonials.filter(
      item => item.category === activeCategory
    );
  }

  function applyAdminVoices(content) {
    const published = (content?.records?.stories || [])
      .filter(item => item.status === "Published")
      .map((item, index) => {
        const category = adminVoiceCategory(item.category);
        return {
          id: item.id || `admin-voice-${index}`,
          name: item.name || categoryNames[category],
          role: categoryNames[category],
          category,
          quote: item.quote || "A published voice from BNK Seva Trust.",
          image: item.image || "",
          video: null
        };
      });

    testimonials = [...defaultTestimonials, ...published];
    renderCards();
    renderDots();
    goTo(0);
    restartAutoplay();
  }

  document.addEventListener("bnk:site-content", event => {
    applyAdminVoices(event.detail);
  });

  async function loadAdminVoices() {
    try {
      const response = await fetch("/api/site-content", { cache: "no-store" });
      if (!response.ok) return;
      applyAdminVoices(await response.json());
    } catch {
      // Keep the built-in voices if public content is unavailable.
    }
  }

  renderCards();
  renderDots();
  goTo(0);
  loadAdminVoices();

  if (
    !reduceMotion &&
    "IntersectionObserver" in window
  ) {
    section.classList.add("voices-ready");

    // Header / cards reveal once.
    const revealObserver = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          revealSection();
          revealObserver.disconnect();
        }
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -35px 0px"
      }
    );

    revealObserver.observe(section);

    // Automatic sliding only while on screen.
    const visibilityObserver = new IntersectionObserver(
      entries => {
        isVisible = entries[0].isIntersecting;

        if (isVisible) {
          startAutoplay();
        } else {
          stopAutoplay();
        }
      },
      { threshold: 0.2 }
    );

    visibilityObserver.observe(section);
  } else {
    revealSection();
    isVisible = true;
    startAutoplay();
  }

  /* =========================================
     HANDLE SCREEN RESIZING
  ========================================= */

  let resizeFrame;

  function updateResponsiveLayout() {
    cancelAnimationFrame(resizeFrame);

    resizeFrame = requestAnimationFrame(() => {
      renderDots();
      goTo(currentIndex);
      restartAutoplay();
    });
  }

  window.addEventListener(
    "resize",
    updateResponsiveLayout
  );

  if ("ResizeObserver" in window) {
    new ResizeObserver(updateResponsiveLayout)
      .observe(viewport);
  }

})();
