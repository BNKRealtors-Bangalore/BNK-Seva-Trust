(() => {
  /* ========================================
     SPECIAL SEVA CONFIGURATION
     Replace null with verified amounts.
  ======================================== */

  let specialSevaConfig = {
    chalisa: [
      { copies: 108, amount: 2100 },
      { copies: 216, amount: 4200 },
      { copies: 501, amount: null },
      { copies: 1008, amount: null }
    ]
  };

  const optionsContainer =
    document.getElementById("chalisaOptions");

  const chalisaDonate =
    document.getElementById("chalisaDonate");

  const chalisaDonateSecondary =
    document.getElementById("chalisaDonateSecondary");

  const generalAmount =
    document.getElementById("generalSevaAmount");

  if (!optionsContainer) return;

  let selectedChalisaIndex = 0;

  const formatINR = (amount) =>
    amount == null
      ? "₹X"
      : "₹" + amount.toLocaleString("en-IN");

  async function loadSpecialSevaPricing() {
    try {
      const response = await fetch("/api/pricing-config", { cache: "no-store" });
      if (!response.ok) return;
      const config = await response.json();
      if (!Array.isArray(config.specialSevaChalisa)) return;
      specialSevaConfig = { ...specialSevaConfig, chalisa: config.specialSevaChalisa };
      selectedChalisaIndex = 0;
      renderChalisaOptions();
    } catch {
      // Keep built-in defaults if admin pricing cannot load.
    }
  }

  function renderChalisaOptions() {
    optionsContainer.innerHTML = "";

    specialSevaConfig.chalisa.forEach((option, index) => {
      const button = document.createElement("button");
      const selected = index === selectedChalisaIndex;

      button.type = "button";
      button.className =
        "special-chalisa-option" +
        (selected ? " selected" : "");

      button.setAttribute("aria-pressed", String(selected));

      button.innerHTML = `
        <span class="special-option-radio"
          aria-hidden="true"></span>
        <span class="special-option-copies">
          <span class="special-number">${option.copies.toLocaleString("en-IN")}</span>
          <span class="special-unit">Copies</span>
        </span>
        <span class="special-option-price">
          <span class="special-number">${formatINR(option.amount)}</span>
        </span>
      `;

      button.addEventListener("click", () => {
        selectedChalisaIndex = index;
        renderChalisaOptions();
      });

      optionsContainer.appendChild(button);
    });
  }

  function proceedToDonation(details) {
    document.dispatchEvent(
      new CustomEvent("bnk:seva-donation", {
        detail: details
      })
    );
  }

  function donateChalisa() {
    const selected =
      specialSevaConfig.chalisa[selectedChalisaIndex];

    proceedToDonation({
      sevaId: "hanuman-chalisa-vitaran",
      sevaName: `Hanuman Chalisa Vitaran (${selected.copies} copies)`,
      copies: selected.copies,
      amount: selected.amount,
      currency: "INR"
    });
  }

  chalisaDonate?.addEventListener("click", donateChalisa);

  chalisaDonateSecondary?.addEventListener(
    "click",
    donateChalisa
  );

  document.querySelectorAll(
    ".special-seva-donate"
  ).forEach((button) => {
    button.addEventListener("click", () => {
      const sevaId = button.dataset.seva;

      const card = button.closest(".special-seva-card");
      const sevaName =
        card?.querySelector("h3")?.textContent?.trim() ||
        "General Seva";

      let amount = null;

      if (sevaId === "general-seva") {
        amount = Number(generalAmount.value);

        if (
          !Number.isSafeInteger(amount) ||
          amount < 1
        ) {
          alert("Please enter a valid contribution amount.");
          generalAmount.focus();
          return;
        }
      }

      proceedToDonation({
        sevaId,
        sevaName,
        amount,
        currency: "INR"
      });
    });
  });

  renderChalisaOptions();
  loadSpecialSevaPricing();
})();
