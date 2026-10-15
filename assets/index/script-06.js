(() => {

  /* =====================================
     SEVA CONFIGURATION
  ===================================== */

  const sevaCategories = [
    {
      id: "temple-construction",
      name: "Temple Construction",
      description: "Help build the temple for future generations.",
      image: "images/optimized/donation 1-1536.webp"
    },
    {
      id: "temple-square-feet",
      name: "Temple by Sq. Ft.",
      description: "Contribute by designated area.",
      image: "images/optimized/donation 2-1536.webp"
    },
    {
      id: "temple-element",
      name: "Murti / Temple Element",
      description: "Sponsor sacred elements of the temple.",
      image: "images/optimized/donation 3-1536.webp"
    },
    {
      id: "hanuman-chalisa",
      name: "Hanuman Chalisa Vitaran",
      description: "Help distribute Hanuman Chalisa.",
      image: "images/optimized/donation 4-1536.webp"
    },
    {
      id: "anna-seva",
      name: "Anna Seva",
      description: "Sponsor meals for people in need.",
      image: "images/optimized/donation 5-1536.webp"
    },
    {
      id: "education-seva",
      name: "Education Seva",
      description: "Support education for a brighter future.",
      image: "images/optimized/donation 6-1536.webp"
    },
    {
      id: "healthcare-seva",
      name: "Healthcare Seva",
      description: "Support medical camps and care.",
      image: "images/optimized/donation 7-1536.webp"
    },
    {
      id: "animal-gau-seva",
      name: "Animal / Gau Seva",
      description: "Support animal and gau seva.",
      image: "images/optimized/donation 8-1536.webp"
    },
    {
      id: "environment-seva",
      name: "Environment Seva",
      description: "Support plantation and green initiatives.",
      image: "images/optimized/donation 9-1536.webp"
    },
    {
      id: "general-seva",
      name: "General Seva",
      description: "Contribute towards various seva activities.",
      image: "images/optimized/donation 10-1254.webp"
    },
    {
      id: "custom-contribution",
      name: "Custom Contribution",
      description: "Contribute any amount from your heart.",
      image: "images/optimized/donation 11-1254.webp"
    }
  ];

  /* =====================================
     ELEMENTS
  ===================================== */

  const grid =
    document.getElementById("chooseSevaGrid");

  const amountButtons =
    document.querySelectorAll(".choose-amount");

  const customInput =
    document.getElementById("chooseCustomAmount");

  const donateButton =
    document.getElementById("chooseDonateButton");

  if (!grid || !customInput || !donateButton) return;

  let selectedSeva = sevaCategories[0];
  let selectedAmount = "custom";

  const formatChooseAmount = (amount) =>
    "₹" + Number(amount).toLocaleString("en-IN");

  async function loadChooseDonationPricing() {
    try {
      const response = await fetch("/api/pricing-config", { cache: "no-store" });
      if (!response.ok) return;
      const config = await response.json();
      if (!Array.isArray(config.sevaDonationAmounts)) return;
      const values = config.sevaDonationAmounts
        .map((amount) => Number(amount))
        .filter((amount) => Number.isSafeInteger(amount) && amount > 0);
      amountButtons.forEach((button, index) => {
        if (button.dataset.amount === "custom") return;
        const amount = values[index];
        if (!amount) return;
        button.dataset.amount = String(amount);
        button.textContent = formatChooseAmount(amount);
      });
      if (selectedAmount !== "custom" && !values.map(String).includes(selectedAmount)) {
        selectedAmount = "custom";
        customInput.value = "";
      }
      updateAmountSelection();
    } catch {
      // Keep built-in defaults if admin pricing cannot load.
    }
  }

  /* =====================================
     RENDER SEVA CARDS
  ===================================== */

  function renderSevaCards() {
    grid.innerHTML = "";

    sevaCategories.forEach((seva) => {

      const card = document.createElement("button");

      const selected =
        selectedSeva.id === seva.id;

      card.type = "button";

      card.className =
        "choose-seva-card" +
        (selected ? " selected" : "");

      card.setAttribute(
        "aria-pressed",
        String(selected)
      );

      const image = document.createElement("div");
      image.className = "choose-seva-image";

      const img = document.createElement("img");
      img.src = seva.image;
      img.alt = "";
      img.loading = "lazy";
      image.appendChild(img);

      const heading = document.createElement("h3");
      heading.textContent = seva.name;

      const description = document.createElement("p");
      description.textContent = seva.description;

      const radio = document.createElement("span");
      radio.className = "choose-seva-radio";
      radio.setAttribute("aria-hidden", "true");

      card.append(image, heading, description, radio);

      card.addEventListener("click", () => {
        selectedSeva = seva;
        renderSevaCards();
      });

      grid.appendChild(card);
    });
  }

  /* =====================================
     SELECT DONATION AMOUNT
  ===================================== */

  function updateAmountSelection() {
    amountButtons.forEach((button) => {
      const selected =
        button.dataset.amount === selectedAmount;

      button.classList.toggle("selected", selected);

      button.setAttribute(
        "aria-pressed",
        String(selected)
      );
    });
  }

  amountButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedAmount = button.dataset.amount;

      if (selectedAmount !== "custom") {
        customInput.value = selectedAmount;
      } else {
        customInput.value = "";
        customInput.focus();
      }

      updateAmountSelection();
    });
  });

  customInput.addEventListener("input", () => {
    selectedAmount = "custom";
    updateAmountSelection();
  });

  /* =====================================
     DONATION ACTION
  ===================================== */

  donateButton.addEventListener("click", () => {

    const amount = Number(customInput.value);

    if (
      !Number.isSafeInteger(amount) ||
      amount < 1
    ) {
      alert("Please enter a valid donation amount.");
      customInput.focus();
      return;
    }

    const donationDetails = {
      sevaId: selectedSeva.id,
      sevaName: selectedSeva.name,
      amount: amount,
      currency: "INR"
    };

    // Connect to your website payment workflow.
    document.dispatchEvent(
      new CustomEvent("bnk:donation-selected", {
        detail: donationDetails
      })
    );

  });

  renderSevaCards();
  updateAmountSelection();
  loadChooseDonationPricing();

})();
