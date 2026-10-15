(() => {
  const section = document.getElementById("seva-stories");
  if (!section) return;

  const grid = section.querySelector("#storiesGrid");
  const filters = [
    ...section.querySelectorAll(
      "#storiesFilters button"
    )
  ];
  const moreButton =
    section.querySelector("#storiesMore");
  const status =
    section.querySelector("#storiesStatus");

  /* =====================================
     STORY CONTENT

     These are illustrative sample stories.
     Replace with approved Trust content.

     date: YYYY-MM-DD or null
     link: published story URL or null
  ===================================== */

  const defaultStories = [
    {
      id: "meal-memory",
      title: "A Meal That Became a Memory",
      description:
        "For many, it was just a meal. For him, it was care, kindness and a reminder that he is not forgotten.",
      category: "food",
      image: "images/optimized/stories-food-397.webp",
      date: null,
      link: "stories/meal-memory.html",
      layout: "featured",
      theme: "dark"
    },
    {
      id: "child-dream",
      title: "The First Step Towards a Child's Dream",
      description:
        "With a little support and encouragement, a brighter future begins.",
      category: "education",
      image: "images/stories-education.jpg",
      date: null,
      link: "stories/child-dream.html",
      layout: "standard",
      theme: "dark"
    },
    {
      id: "temple-community",
      title: "Building a Temple, Building a Community",
      description:
        "A sacred vision bringing people together through faith, compassion and collective seva.",
      category: "temple",
      image: "images/optimized/stories-temple-784.webp",
      date: null,
      link: "stories/temple-community.html",
      layout: "wide",
      theme: "dark"
    },
    {
      id: "healthcare-day",
      title: "A Day of Healthcare Seva",
      description:
        "Compassionate healthcare and support for communities in need.",
      category: "healthcare",
      image: "images/stories-healthcare.jpg",
      date: null,
      link: "stories/healthcare-day.html",
      layout: "standard",
      theme: "light"
    },
    {
      id: "why-we-serve",
      title: "Why We Serve",
      description:
        "The meaning of seva, shared through people who choose to help.",
      category: "volunteers",
      image: "images/stories-volunteers.jpg",
      date: null,
      link: "stories/why-we-serve.html",
      layout: "standard",
      theme: "light"
    },
    {
      id: "babas-grace",
      title: "In Baba's Grace",
      description:
        "Reflections on devotion, faith and the spiritual journey.",
      category: "spiritual",
      image: "images/optimized/stories-baba-1600.webp",
      date: null,
      link: "stories/babas-grace.html",
      layout: "standard",
      theme: "dark"
    },

    /* More story pages available through Load More */
    {
      id: "community-together",
      title: "The Strength of Togetherness",
      description:
        "How collective acts of kindness can bring a community closer.",
      category: "community",
      image: "images/stories-community.jpg",
      date: null,
      link: "stories/community-together.html",
      layout: "standard",
      theme: "light"
    },
    {
      id: "greener-tomorrow",
      title: "A Greener Tomorrow",
      description:
        "Small steps towards a more sustainable and caring world.",
      category: "environment",
      image: "images/stories-environment.jpg",
      date: null,
      link: "stories/greener-tomorrow.html",
      layout: "wide",
      theme: "dark"
    },
    {
      id: "journey-of-service",
      title: "A Journey of Service",
      description:
        "The people and values behind an enduring commitment to seva.",
      category: "volunteers",
      image: "images/optimized/stories-service-591.webp",
      date: null,
      link: "stories/journey-of-service.html",
      layout: "standard",
      theme: "dark"
    }
  ];

  let stories = [...defaultStories];

  const categoryLabels = {
    temple: "Temple Project",
    food: "Food Seva",
    education: "Education",
    healthcare: "Healthcare",
    community: "Community",
    volunteers: "Volunteers",
    spiritual: "Baba / Spiritual",
    environment: "Environment"
  };

  const categoryIcons = {
    temple: "♙",
    food: "♨",
    education: "▣",
    healthcare: "✚",
    community: "♡",
    volunteers: "♥",
    spiritual: "❀",
    environment: "❧"
  };

  const adminStoryCategory = value => ({
    Beneficiary: "community",
    Volunteer: "volunteers",
    Donor: "community",
    "Community Member": "community"
  }[value] || "community");

  const adminStoryLabel = value => ({
    Beneficiary: "Beneficiary",
    Volunteer: "Volunteer",
    Donor: "Donor",
    "Community Member": "Community Member"
  }[value] || "Voice of Seva");

  const PAGE_SIZE = 6;
  let category = "all";
  let visibleCount = PAGE_SIZE;
  let hasRevealed = false;

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  function getFilteredStories() {
    return category === "all"
      ? stories
      : stories.filter(
          story => story.category === category
        );
  }

  function formatDate(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString + "T12:00:00");

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).toUpperCase();
  }

  /* =====================================
     CREATE STORY CARD
  ===================================== */

  function createStoryCard(story, index) {
    const card = document.createElement("a");

    const safeLayout = [
      "featured", "wide", "standard"
    ].includes(story.layout)
      ? story.layout
      : "standard";

    const safeTheme =
      story.theme === "light" ? "light" : "dark";

    card.className =
      `story-card story-${safeLayout} story-${safeTheme}`;

    // Assign a real story link after publication.
    card.href = story.link || "#";

    if (!story.link) {
      card.addEventListener("click", event => {
        event.preventDefault();
        // Do not navigate to an unpublished story.
      });
      card.setAttribute(
        "aria-label",
        story.title + " — story coming soon"
      );
    } else {
      card.setAttribute(
        "aria-label",
        "Read story: " + story.title
      );
    }

    const photo = document.createElement("div");
    photo.className = "story-image";

    const image = document.createElement("img");
    image.src = story.image;
    image.alt = story.title;
    image.loading = "lazy";
    image.decoding = "async";

    photo.appendChild(image);

    const badge = document.createElement("span");
    badge.className = "story-category";

    const badgeIcon = document.createElement("span");
    badgeIcon.className = "story-category-icon";
    badgeIcon.setAttribute("aria-hidden", "true");
    badgeIcon.textContent =
      categoryIcons[story.category] || "❀";

    badge.append(
      badgeIcon,
      document.createTextNode(
        categoryLabels[story.category] || "Seva"
      )
    );

    const body = document.createElement("div");
    body.className = "story-body";

    if (story.date) {
      const date = document.createElement("time");
      date.className = "story-date";
      date.dateTime = story.date;
      date.textContent = formatDate(story.date);
      body.appendChild(date);
    }

    const title = document.createElement("h3");
    title.className = "story-title";
    title.textContent = story.title;

    const description = document.createElement("p");
    description.className = "story-description";
    description.textContent = story.description;

    body.append(title, description);

    const arrow = document.createElement("span");
    arrow.className = "story-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "→";

    card.append(photo, badge, body, arrow);

    if (hasRevealed && !reduceMotion) {
      card.classList.add("story-enter");
      card.style.setProperty(
        "--story-delay",
        `${Math.min(index, 8) * 85}ms`
      );
    }

    return card;
  }

  /* =====================================
     RENDER / FILTER / LOAD MORE
  ===================================== */

  function renderStories() {
    const filtered = getFilteredStories();
    const visible = filtered.slice(0, visibleCount);

    const fragment = document.createDocumentFragment();

    visible.forEach((story, index) => {
      fragment.appendChild(
        createStoryCard(story, index)
      );
    });

    grid.replaceChildren(fragment);

    moreButton.hidden =
      visible.length >= filtered.length;

    status.textContent = filtered.length
      ? `Showing ${visible.length} of ${filtered.length} stories`
      : "No stories in this category yet.";
  }

  function applyAdminStories(content) {
    const records = content?.records?.stories || [];
    const hasEditableDefaults = records.some(item =>
      defaultStories.some(story => story.id === item.id)
    );
    const published = records.filter(item => item.status === "Published")
      .map((item, index) => ({
        id: item.id || `admin-story-${index}`,
        title: item.name || adminStoryLabel(item.category),
        description: item.quote || "A published voice from BNK Seva Trust.",
        category: item.siteCategory || adminStoryCategory(item.category),
        image: item.image || "images/stories-community.jpg",
        date: null,
        link: item.link || null,
        layout: item.layout || (index === 2 ? "wide" : "standard"),
        theme: index % 3 === 1 ? "light" : "dark"
      }));
    stories = hasEditableDefaults ? published : [...defaultStories, ...published];
    category = "all";
    visibleCount = PAGE_SIZE;
    renderStories();
  }

  filters.forEach(button => {
    button.addEventListener("click", () => {
      category = button.dataset.category;
      visibleCount = PAGE_SIZE;

      filters.forEach(filter => {
        const active = filter === button;
        filter.classList.toggle("active", active);
        filter.setAttribute(
          "aria-pressed",
          String(active)
        );
      });

      renderStories();
    });
  });

  moreButton.addEventListener("click", () => {
    const previousCount = visibleCount;
    visibleCount += PAGE_SIZE;

    renderStories();

    const cards = grid.querySelectorAll(".story-card");
    cards[previousCount]?.focus({
      preventScroll: true
    });
  });

  /* =====================================
     STAGGERED SCROLL REVEAL
  ===================================== */

  const header = section.querySelector(
    ".stories-header"
  );
  const pills = section.querySelector(
    ".stories-filters"
  );
  const footer = section.querySelector(
    ".stories-footer"
  );

  function revealSection() {
    if (hasRevealed) return;
    hasRevealed = true;

    header.classList.add("is-visible");

    window.setTimeout(() => {
      pills.classList.add("is-visible");
    }, 120);

    grid.querySelectorAll(".story-card")
      .forEach((card, index) => {
        if (reduceMotion) return;

        card.classList.add("story-enter");
        card.style.setProperty(
          "--story-delay",
          `${260 + index * 100}ms`
        );
      });

    window.setTimeout(() => {
      footer.classList.add("is-visible");
    }, 400);
  }

  document.addEventListener("bnk:site-content", event => {
    applyAdminStories(event.detail);
  });
  if (window.BNK_SITE_CONTENT) applyAdminStories(window.BNK_SITE_CONTENT);

  async function loadStoriesContent() {
    try {
      const response = await fetch("/api/site-content", { cache: "no-store" });
      if (!response.ok) return;
      applyAdminStories(await response.json());
    } catch {
      // Keep the built-in cards if public content is unavailable.
    }
  }

  renderStories();
  loadStoriesContent();

  if (
    reduceMotion ||
    !("IntersectionObserver" in window)
  ) {
    revealSection();
    return;
  }

  section.classList.add("stories-animate");

  const observer = new IntersectionObserver(
    entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        revealSection();
        observer.disconnect();
      }
    },
    {
      threshold: 0.1,
      rootMargin: "0px 0px -35px 0px"
    }
  );

  observer.observe(section);
})();
