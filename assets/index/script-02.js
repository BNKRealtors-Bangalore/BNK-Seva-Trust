const menuToggle = document.querySelector(".menu-toggle");
      const mainNav = document.querySelector(".main-nav");
      const revealItems = document.querySelectorAll(".reveal");

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        revealItems.forEach((item) => item.classList.add("is-visible"));
      } else if ("IntersectionObserver" in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.01, rootMargin: "0px" });

        revealItems.forEach((item) => revealObserver.observe(item));
      } else {
        revealItems.forEach((item) => item.classList.add("is-visible"));
      }

      menuToggle.addEventListener("click", () => {
        const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
        menuToggle.setAttribute("aria-expanded", String(!isOpen));
        mainNav.classList.toggle("is-open", !isOpen);
      });

      mainNav.addEventListener("click", (event) => {
        if (event.target.closest("a")) {
          menuToggle.setAttribute("aria-expanded", "false");
          mainNav.classList.remove("is-open");
        }
      });

      const fundSection = document.querySelector(".temple-fund-section");
      const fundStage = document.querySelector(".temple-fund-stage");
      const fundItems = document.querySelectorAll(".tracker-item");
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const openFundTracker = () => {
        fundStage.classList.add("is-open");
        fundItems.forEach((item) => item.classList.add("is-revealed"));
      };

      if (reducedMotion) {
        openFundTracker();
      } else if ("IntersectionObserver" in window) {
        const fundOpenObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              openFundTracker();
              observer.unobserve(entry.target);
            }
          });
        }, { threshold: 0.28, rootMargin: "0px 0px -12% 0px" });

        fundOpenObserver.observe(fundSection);
      } else {
        openFundTracker();
      }

      const fundTrackerSection = document.querySelector("#temple-fund");
      if (fundTrackerSection) {
        const raised = fundTrackerSection.querySelector("[data-fund-raised]");
        const remaining = fundTrackerSection.querySelector("[data-fund-remaining]");
        const percent = fundTrackerSection.querySelector("[data-fund-percent]");
        const progress = fundTrackerSection.querySelector(".tracker-progress");

        const formatFundAmount = (amount) => {
          const value = Number(amount) || 0;
          if (value >= 10000000) {
            const crore = value / 10000000;
            const formatted = new Intl.NumberFormat("en-IN", {
              maximumFractionDigits: crore >= 10 ? 1 : 2
            }).format(crore);
            return `₹ ${formatted} Cr`;
          }
          return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0
          }).format(value);
        };

        const refreshTempleFund = async () => {
          try {
            const response = await fetch("/api/temple-fund", { cache: "no-store" });
            if (!response.ok) return;
            const summary = await response.json();
            const progressValue = Math.min(100, Math.max(0, Number(summary.progress) || 0));
            const roundedProgress = Math.round(progressValue);

            if (raised) raised.textContent = formatFundAmount(summary.raisedAmount);
            if (remaining) remaining.textContent = `${formatFundAmount(summary.remainingAmount)} Remaining`;
            if (percent) percent.textContent = `${roundedProgress}% FUNDED`;
            if (progress) {
              progress.style.setProperty("--fund-progress", `${progressValue}%`);
              progress.setAttribute("aria-valuenow", String(roundedProgress));
              progress.setAttribute("aria-valuetext", `${roundedProgress} percent funded`);
            }
          } catch {
            // Keep the zero-state visible if the donation summary cannot load.
          }
        };

        window.bnkRefreshTempleFund = refreshTempleFund;
        document.addEventListener("bnk:donation-confirmed", refreshTempleFund);
        refreshTempleFund();
      }
