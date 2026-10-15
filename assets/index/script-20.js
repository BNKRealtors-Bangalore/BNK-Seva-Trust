(() => {
  const section = document.getElementById("csr-partnership");
  if (!section) return;
  const revealItems = [...section.querySelectorAll('.csr-reveal')];
  revealItems.forEach((item, index) => item.style.setProperty('--csr-delay', `${index * 90}ms`));
  const show = () => revealItems.forEach(item => item.classList.add('is-visible'));
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries, obs) => {
      if (entries.some(entry => entry.isIntersecting)) {
        show();
        obs.disconnect();
      }
    }, { threshold: 0.18 });
    observer.observe(section);
  } else {
    show();
  }

  const openButton = document.getElementById("openCsrPartnerForm");
  const proposalButton = document.getElementById("downloadCsrProposal");
  const modal = document.getElementById("csrPartnerModal");
  const closeButton = document.getElementById("closeCsrPartnerForm");
  const form = document.getElementById("csrPartnerForm");
  const status = document.getElementById("csrPartnerStatus");
  let lastFocused = null;

  const openModal = () => {
    if (!modal) return;
    lastFocused = document.activeElement;
    modal.hidden = false;
    modal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    status.hidden = true;
    status.textContent = "";
    form.querySelector("input, select, textarea, button")?.focus();
  };

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.hidden = true;
    document.body.style.overflow = "";
    lastFocused?.focus?.();
  };

  openButton?.addEventListener("click", openModal);
  proposalButton?.addEventListener("click", openModal);
  closeButton?.addEventListener("click", closeModal);
  modal?.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && modal && !modal.hidden) closeModal();
  });

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    const submit = form.querySelector(".csr-form-submit");
    submit.disabled = true;
    submit.textContent = "Submitting...";
    try {
      const endpoint = "/api/public-submissions/csr";
      const response = await fetch(window.location.protocol === "file:" ? `http://127.0.0.1:3000${endpoint}` : endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(data)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not submit CSR details.");
      form.reset();
      status.textContent = "Thank you. Your CSR partnership details have been received.";
      status.hidden = false;
    } catch (error) {
      status.textContent = error.message;
      status.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = "Submit Details";
    }
  });
})();
