// ADMIN CONFIGURATION
  // Update these amounts from your backend / admin panel.

  let contributionConfig = [
    { sqft: 1, amount: 2500 },
    { sqft: 2, amount: 5000 },
    { sqft: 5, amount: 12500 },
    { sqft: 10, amount: 25000 },
    { sqft: 20, amount: 50000 },
    { sqft: 50, amount: 125000 },
    { sqft: 100, amount: 250000 }
  ];

  // Place your transparent lotus PNG in the images folder.

  const contributionGrid =
    document.getElementById("contributionOptions");

  const customContribution =
    document.getElementById("customContribution");

  const contributeButton =
    document.getElementById("contributeButton");

  const formatRupees = (amount) =>
    "₹" + Number(amount).toLocaleString("en-IN");

  let selectedContribution = null;

  async function loadContributionPricing() {
    try {
      const response = await fetch("/api/pricing-config", { cache: "no-store" });
      if (!response.ok) return;
      const config = await response.json();
      if (!Array.isArray(config.contributionOptions) || !config.contributionOptions.length) return;
      contributionConfig = config.contributionOptions;
      selectedContribution = null;
      renderContributionCards();
    } catch {
      // Keep built-in defaults if admin pricing cannot load.
    }
  }

  // Generate contribution cards
  function renderContributionCards() {
    contributionGrid.innerHTML = "";

    contributionConfig.forEach((option, index) => {
      const card = document.createElement("button");
      const isSelected =
        selectedContribution?.sqft === option.sqft;

      card.type = "button";
      card.className =
        "contribution-card contribution-reveal" +
        (isSelected ? " selected" : "");
      card.style.setProperty("--contribution-delay", `${120 + index * 55}ms`);

      card.setAttribute("aria-pressed", String(isSelected));

      card.innerHTML = `
        <span class="contribution-check"
          aria-hidden="true">✓</span>

      

        <span class="contribution-card-area">
          <span class="contribution-number">${option.sqft}</span>
          <span class="contribution-unit">Sq. Ft.</span>
        </span>

        <br>

        <span class="contribution-card-price">
          <span class="contribution-number">${formatRupees(option.amount)}</span>
        </span>
      `;

      card.addEventListener("touchstart", () => {
        card.classList.add("is-touching");
      }, { passive: true });

      card.addEventListener("touchend", () => {
        window.setTimeout(() => card.classList.remove("is-touching"), 180);
      });

      card.addEventListener("touchcancel", () => {
        card.classList.remove("is-touching");
      });

      card.addEventListener("click", () => {
        selectedContribution = option;
        customContribution.value = "";
        renderContributionCards();
      });

      contributionGrid.appendChild(card);
    });
  }

  // Switch to custom amount when user types
  customContribution.addEventListener("input", () => {
    selectedContribution = null;
    renderContributionCards();
  });

  // Contribution action
  contributeButton.addEventListener("click", () => {
    const amount = selectedContribution
      ? selectedContribution.amount
      : Number(customContribution.value);

    if (
      !Number.isSafeInteger(amount) ||
      amount < 1
    ) {
      alert("Please enter a valid contribution amount.");
      customContribution.focus();
      return;
    }

    const contributionDetails = {
      amount,
      squareFeet: selectedContribution?.sqft ?? null,
      currency: "INR"
    };

    document.dispatchEvent(
      new CustomEvent("bnk:donation-selected", {
        detail: {
          category: "Temple Project",
          sevaName: selectedContribution
            ? `${selectedContribution.sqft} sq. ft. Temple Contribution`
            : "Temple Contribution",
          amount: contributionDetails.amount,
          currency: contributionDetails.currency
        }
      })
    );
  });

  contributeButton.addEventListener("touchstart", () => {
    contributeButton.classList.add("is-touching");
  }, { passive: true });

  contributeButton.addEventListener("touchend", () => {
    window.setTimeout(() => contributeButton.classList.remove("is-touching"), 180);
  });

  contributeButton.addEventListener("touchcancel", () => {
    contributeButton.classList.remove("is-touching");
  });

  renderContributionCards();
  loadContributionPricing();

  const contributionSection = document.querySelector(".contribution-section");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    contributionSection.classList.add("is-visible");
  } else if ("IntersectionObserver" in window) {
    const contributionObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          contributionSection.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -10% 0px" });

    contributionObserver.observe(contributionSection);
  } else {
    contributionSection.classList.add("is-visible");
  }
