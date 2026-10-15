(() => {
  const gallerySection =
    document.getElementById("seva-gallery");

  if (!gallerySection) return;

  /* ==========================================
     GALLERY DATABASE

     Add new image or video entries here.
     In production, this can be replaced with
     data fetched from your administration API.
  ========================================== */

  const galleryItems = [
    {
      id: "temple-01",
      title: "Temple Construction Journey",
      category: "temple",
      image: "images/optimized/01_temple_construction-1280.webp",
      type: "image",
      size: "featured",
      description: "Temple project gallery"
    },
    {
      id: "baba-01",
      title: "Baba's Blessings",
      category: "spiritual",
      image: "images/optimized/02_babas_blessings-1600.webp",
      type: "image",
      size: "wide",
      description: "Spiritual moments"
    },
    {
      id: "food-01",
      title: "Food Seva",
      category: "food",
      image: "images/optimized/03_food_seva-1448.webp",
      type: "image",
      size: "small",
      description: "Serving meals with compassion"
    },
    {
      id: "education-01",
      title: "Education Seva",
      category: "education",
      image: "images/optimized/04_education_seva-1448.webp",
      type: "image",
      size: "small",
      description: "Supporting children's education"
    },
    {
      id: "healthcare-01",
      title: "Healthcare Seva",
      category: "healthcare",
      image: "images/optimized/05_healthcare_seva-1448.webp",
      type: "image",
      size: "small",
      description: "Community health and care"
    },
    {
      id: "events-01",
      title: "Temple Celebration",
      category: "events",
      image: "images/optimized/06_temple_celebration-1448.webp",
      type: "image",
      size: "small",
      description: "Devotional gathering"
    },
    {
      id: "environment-01",
      title: "Plantation Drive",
      category: "environment",
      image: "images/optimized/07_plantation_drive-1448.webp",
      type: "image",
      size: "small",
      description: "Growing greener communities"
    },
    {
      id: "volunteers-01",
      title: "Volunteer Activities",
      category: "volunteers",
      image: "images/optimized/08_volunteer_activities-1122.webp",
      type: "image",
      size: "tall",
      description: "Volunteers working together"
    },
    {
      id: "animal-01",
      title: "Gau Seva",
      category: "animal",
      image: "images/optimized/09_gau_seva-1448.webp",
      type: "image",
      size: "small",
      description: "Compassionate care for animals"
    },
    {
      id: "community-01",
      title: "Community Seva",
      category: "community",
      image: "images/optimized/10_community_seva-1448.webp",
      type: "image",
      size: "small",
      description: "Supporting local communities"
    },
    {
      id: "environment-02",
      title: "Tree Plantation",
      category: "environment",
      image: "images/optimized/11_tree_plantation-1600.webp",
      type: "image",
      size: "small",
      description: "Environmental Seva activity"
    },
    {
      id: "spiritual-02",
      title: "Sacred Temple Moments",
      category: "spiritual",
      image: "images/optimized/12_temple_moments-1600.webp",
      type: "image",
      size: "small",
      description: "Faith and devotion"
    }
  ];

  /* ==========================================
     CONFIGURATION
  ========================================== */

  const PAGE_SIZE = 12;

  const grid =
    document.getElementById("sevaGalleryGrid");

  const filters =
    document.querySelectorAll(
      "#sevaGalleryFilters button"
    );

  const moreButton =
    document.getElementById("sevaGalleryMore");

  const status =
    document.getElementById("sevaGalleryStatus");

  const lightbox =
    document.getElementById("sevaLightbox");

  const mediaContainer =
    document.getElementById("sevaLightboxMedia");

  const lightboxTitle =
    document.getElementById("sevaLightboxTitle");

  const lightboxDetails =
    document.getElementById("sevaLightboxDetails");

  const lightboxCounter =
    document.getElementById("sevaLightboxCounter");

  const previousButton =
    document.getElementById("sevaLightboxPrev");

  const nextButton =
    document.getElementById("sevaLightboxNext");

  const closeButton =
    document.getElementById("sevaLightboxClose");

  let selectedCategory = "all";
  let visibleCount = PAGE_SIZE;
  let currentIndex = 0;
  let filteredItems = [];
  let lastFocusedElement = null;

  const reduceMotion =
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

  /* ==========================================
     FILTER DATA
  ========================================== */

  function getFilteredItems() {
    if (selectedCategory === "all") {
      return [...galleryItems];
    }

    return galleryItems.filter(
      item => item.category === selectedCategory
    );
  }

  /* ==========================================
     CREATE GALLERY CARD
  ========================================== */

  function createGalleryCard(item, index) {
    const card = document.createElement("button");

    card.type = "button";
    card.className =
      "seva-gallery-item gallery-" +
      (["small", "wide", "tall", "large", "featured"]
        .includes(item.size) ? item.size : "small");

    card.setAttribute(
      "aria-label",
      (item.type === "video" ? "Play video: " : "View photo: ") +
      item.title
    );

    card.style.setProperty(
      "--gallery-delay",
      `${Math.min(index % PAGE_SIZE, 11) * 65}ms`
    );

    const img = document.createElement("img");
    img.src = item.image;
    img.alt = item.title;
    img.loading = "lazy";
    img.decoding = "async";

    card.appendChild(img);

    if (item.type === "video") {
      const playIcon = document.createElement("span");
      playIcon.className = "seva-gallery-play";
      playIcon.setAttribute("aria-hidden", "true");
      card.appendChild(playIcon);
    }

    const title = document.createElement("span");
    title.className = "seva-gallery-item-title";
    title.textContent = item.title;
    card.appendChild(title);

    card.addEventListener("click", () => {
      // Only navigate through entries currently displayed.
      const displayedItems =
        filteredItems.slice(0, visibleCount);

      const itemIndex = displayedItems.findIndex(
        current => current.id === item.id
      );

      openLightbox(itemIndex);
    });

    return card;
  }

  /* ==========================================
     RENDER GALLERY
  ========================================== */

  function renderGallery() {
    filteredItems = getFilteredItems();

    const currentItems =
      filteredItems.slice(0, visibleCount);

    const fragment = document.createDocumentFragment();

    currentItems.forEach((item, index) => {
      fragment.appendChild(
        createGalleryCard(item, index)
      );
    });

    grid.replaceChildren(fragment);

    moreButton.hidden =
      currentItems.length >= filteredItems.length;

    if (filteredItems.length === 0) {
      status.textContent =
        "No moments have been added to this category yet.";
    } else {
      status.textContent =
        `Showing ${currentItems.length} of ` +
        `${filteredItems.length} moments`;
    }

    if (reduceMotion) {
      gallerySection.classList.remove("gallery-animate");
    } else {
      // Restart the entrance animation for filtered items.
      gallerySection.classList.remove("gallery-animate");
      void grid.offsetWidth;
      gallerySection.classList.add("gallery-animate");
    }
  }

  /* ==========================================
     CATEGORY FILTERING
  ========================================== */

  filters.forEach(button => {
    button.addEventListener("click", () => {
      selectedCategory = button.dataset.category;
      visibleCount = PAGE_SIZE;

      filters.forEach(filter => {
        const isActive = filter === button;
        filter.classList.toggle("active", isActive);
        filter.setAttribute(
          "aria-pressed",
          String(isActive)
        );
      });

      renderGallery();
    });
  });

  /* ==========================================
     LOAD MORE
  ========================================== */

  moreButton.addEventListener("click", () => {
    visibleCount += PAGE_SIZE;
    renderGallery();

    // Focus the first newly added card if available
    // only when there is no more button to use.
    if (moreButton.hidden) {
      grid.querySelector(".seva-gallery-item:last-child")
        ?.focus({ preventScroll: true });
    }
  });

  /* ==========================================
     LIGHTBOX
  ========================================== */

  function getDisplayedItems() {
    return filteredItems.slice(0, visibleCount);
  }

  function openLightbox(index) {
    const items = getDisplayedItems();

    if (index < 0 || index >= items.length) return;

    lastFocusedElement = document.activeElement;
    currentIndex = index;

    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    updateLightbox();
    closeButton.focus();
  }

  function updateLightbox() {
    const items = getDisplayedItems();
    const item = items[currentIndex];
    if (!item) return;

    // Stop an existing video before switching.
    const previousVideo =
      mediaContainer.querySelector("video");

    if (previousVideo) {
      previousVideo.pause();
      previousVideo.removeAttribute("src");
      previousVideo.load();
    }

    mediaContainer.replaceChildren();

    if (item.type === "video" && item.video) {
      const video = document.createElement("video");
      video.src = item.video;
      video.poster = item.image;
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";

      mediaContainer.appendChild(video);
    } else {
      const image = document.createElement("img");
      image.src = item.image;
      image.alt = item.title;

      mediaContainer.appendChild(image);
    }

    lightboxTitle.textContent = item.title;
    lightboxDetails.textContent = item.description || "";
    lightboxCounter.textContent =
      `${currentIndex + 1} / ${items.length}`;
  }

  function closeLightbox() {
    const video = mediaContainer.querySelector("video");

    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }

    mediaContainer.replaceChildren();

    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    lastFocusedElement?.focus();
  }

  function changeLightbox(direction) {
    const items = getDisplayedItems();
    if (!items.length) return;

    currentIndex =
      (currentIndex + direction + items.length) %
      items.length;

    updateLightbox();
  }

  previousButton.addEventListener("click", () => {
    changeLightbox(-1);
  });

  nextButton.addEventListener("click", () => {
    changeLightbox(1);
  });

  closeButton.addEventListener("click", closeLightbox);

  lightbox.addEventListener("click", event => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  /* ==========================================
     KEYBOARD NAVIGATION
  ========================================== */

  document.addEventListener("keydown", event => {
    if (lightbox.hidden) return;

    if (event.key === "Escape") {
      closeLightbox();
    }

    if (event.key === "ArrowRight") {
      changeLightbox(1);
    }

    if (event.key === "ArrowLeft") {
      changeLightbox(-1);
    }

    if (event.key === "Tab") {
      const controls = [
        closeButton,
        previousButton,
        ...mediaContainer.querySelectorAll(
          "video, button, [tabindex='0']"
        ),
        nextButton
      ].filter(el => !el.disabled);

      if (!controls.length) return;

      const first = controls[0];
      const last = controls[controls.length - 1];

      if (event.shiftKey &&
          document.activeElement === first) {
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
  });

  /* ==========================================
     INITIALIZE
  ========================================== */

  renderGallery();
})();
