(() => {
  const section = document.getElementById(
    "stay-connected"
  );

  if (!section) return;

  const form = document.getElementById(
    "bnkConnectForm"
  );

  const emailInput = document.getElementById(
    "bnkConnectEmail"
  );

  const submitButton = document.getElementById(
    "bnkConnectSubmit"
  );

  const message = document.getElementById(
    "bnkConnectMessage"
  );

  /* =====================================
     STAGGERED REVEAL
  ===================================== */

  const revealElements = [
    ...section.querySelectorAll(
      ".bnk-connect-reveal"
    )
  ];

  revealElements.forEach((item, index) => {
    item.style.setProperty(
      "--connect-delay",
      `${index * 150}ms`
    );
  });

  function revealSection() {
    revealElements.forEach(item => {
      item.classList.add("is-visible");
    });
  }

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (
    !reducedMotion &&
    "IntersectionObserver" in window
  ) {
    section.classList.add("connect-motion");

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          revealSection();
          observer.disconnect();
        }
      },
      {
        threshold: 0.15
      }
    );

    observer.observe(section);
  } else {
    revealSection();
  }

  /* =====================================
     SUBSCRIPTION FEEDBACK
  ===================================== */

  function showMessage(text) {
    message.hidden = false;
    message.textContent = text;
  }

  emailInput.addEventListener("input", () => {
    message.hidden = true;
    message.textContent = "";
  });

  /* =====================================
     FORM SUBMISSION
  ===================================== */

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    const email = emailInput.value.trim();
    const endpoint = form.dataset.endpoint?.trim();

    if (!endpoint) {
      showMessage(
        "Newsletter subscriptions are not yet connected. " +
        "Please try again once subscriptions are available."
      );
      return;
    }

    submitButton.disabled = true;
    form.setAttribute("aria-busy", "true");

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        throw new Error("Subscription failed");
      }

      showMessage(
        "Thank you for subscribing to BNK Seva updates."
      );

      form.reset();

    } catch (error) {
      showMessage(
        "We couldn't complete your subscription. " +
        "Please try again later."
      );

    } finally {
      submitButton.disabled = false;
      form.removeAttribute("aria-busy");
    }
  });

})();
