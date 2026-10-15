(() => {
  const section = document.getElementById("join-seva");
  if (!section) return;

  const cards = [
    ...section.querySelectorAll(".bnk-volunteer-card")
  ];

  const form = document.getElementById("bnkVolunteerForm");
  const formCard = section.querySelector(".bnk-volunteer-form-card");
  const areaSelect = document.getElementById("volArea");
  const nameInput = document.getElementById("volName");
  const phoneInput = document.getElementById("volPhone");
  const submitButton =
    document.getElementById("bnkVolunteerSubmit");
  const feedback =
    document.getElementById("bnkVolunteerFeedback");

  /* =========================================
     VOLUNTEER CARD SELECTION
  ========================================= */

  function syncSelectedCard() {
    const selectedArea = areaSelect.value;

    cards.forEach(card => {
      const isSelected =
        card.dataset.area === selectedArea;

      card.classList.toggle("is-selected", isSelected);
      card.setAttribute(
        "aria-pressed",
        String(isSelected)
      );
    });
  }

  cards.forEach(card => {
    card.addEventListener("click", () => {
      areaSelect.value = card.dataset.area;

      syncSelectedCard();

      formCard?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      window.setTimeout(() => {
        nameInput?.focus({ preventScroll: true });
      }, 420);

      // Light interaction when selected.
      if (
        !window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches
      ) {
        card.animate(
          [
            { scale: 1 },
            { scale: 1.025 },
            { scale: 1 }
          ],
          {
            duration: 340,
            easing: "ease-out"
          }
        );
      }
    });
  });

  // Dropdown changes also update the cards.
  areaSelect.addEventListener(
    "change",
    syncSelectedCard
  );

  syncSelectedCard();

  /* =========================================
     STAGGERED SCROLL REVEAL
  ========================================= */

  const revealElements = [
    ...section.querySelectorAll(".vol-reveal")
  ];

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  revealElements.forEach(element => {
    let delay = 0;

    if (
      element.classList.contains(
        "bnk-volunteer-card"
      )
    ) {
      const index = cards.indexOf(element);
      delay = 90 + index * 65;
    }

    if (
      element.classList.contains(
        "bnk-volunteer-right"
      )
    ) {
      delay = 180;
    }

    element.style.setProperty(
      "--vol-delay",
      `${delay}ms`
    );
  });

  function showAll() {
    revealElements.forEach(element => {
      element.classList.add("is-visible");
    });
  }

  if (
    reduceMotion ||
    !("IntersectionObserver" in window)
  ) {
    showAll();
  } else {
    section.classList.add("vol-motion-ready");

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add(
              "is-visible"
            );

            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -20px 0px"
      }
    );

    revealElements.forEach(element => {
      observer.observe(element);
    });
  }

  /* =========================================
     FORM FEEDBACK
  ========================================= */

  function showFeedback(message, type = "") {
    feedback.hidden = false;
    feedback.textContent = message;

    feedback.className =
      "bnk-vol-feedback" +
      (type ? ` is-${type}` : "");
  }

  function clearFeedback() {
    feedback.hidden = true;
    feedback.textContent = "";
    feedback.className = "bnk-vol-feedback";
  }

  form.addEventListener("input", clearFeedback);
  form.addEventListener("change", clearFeedback);

  /* =========================================
     PHONE VALIDATION
  ========================================= */

  function validatePhone() {
    const raw = phoneInput.value.trim();
    const digits = raw.replace(/\D/g, "");

    const validFormat = /^\+?[\d\s()-]+$/.test(raw);
    const validLength =
      digits.length >= 7 && digits.length <= 15;

    phoneInput.setCustomValidity(
      validFormat && validLength
        ? ""
        : "Enter a valid phone number."
    );

    return phoneInput.checkValidity();
  }

  phoneInput.addEventListener("input", () => {
    phoneInput.setCustomValidity("");
  });

  /* =========================================
     REGISTRATION SUBMISSION
  ========================================= */

  form.addEventListener("submit", async event => {
    event.preventDefault();

    clearFeedback();

    if (!validatePhone()) {
      phoneInput.reportValidity();
      return;
    }

    if (!form.reportValidity()) return;

    const data = new FormData(form);

    const application = {
      name: String(data.get("name") || "").trim(),
      phone: String(data.get("phone") || "").trim(),
      email: String(data.get("email") || "").trim(),
      city: String(data.get("city") || "").trim(),
      areaOfInterest: String(
        data.get("areaOfInterest") || ""
      ),
      availability: String(
        data.get("availability") || ""
      )
    };

    // Add your real backend endpoint to the
    // section's data-submit-url attribute.
    const endpoint =
      section.dataset.submitUrl?.trim();

    if (!endpoint) {
      showFeedback(
        "The registration form is ready, but online " +
        "submissions have not been connected yet. " +
        "Please configure the registration endpoint."
      );
      return;
    }

    const originalText =
      submitButton.querySelector("span").textContent;

    submitButton.disabled = true;
    submitButton.querySelector("span").textContent =
      "SUBMITTING...";

    form.setAttribute("aria-busy", "true");

    try {
      const submitUrl =
        window.location.protocol === "file:"
          ? `http://127.0.0.1:3000${endpoint}`
          : endpoint;

      const response = await fetch(submitUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(application)
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Registration request failed.");

      showFeedback(
        "Thank you for your interest in volunteering. " +
        "Your registration has been received.",
        "success"
      );

      form.reset();
      syncSelectedCard();

    } catch (error) {
      showFeedback(
        error.message ||
        "We couldn't submit your registration. Please try again later.",
        "error"
      );

      console.error(
        "Volunteer registration error:",
        error
      );

    } finally {
      submitButton.disabled = false;

      submitButton.querySelector("span").textContent =
        originalText;

      form.removeAttribute("aria-busy");
    }
  });

})();
