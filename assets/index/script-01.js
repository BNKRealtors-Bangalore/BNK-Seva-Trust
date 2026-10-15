document.documentElement.classList.add("has-reveal");

      (() => {
        if ("scrollRestoration" in history) history.scrollRestoration = "manual";

        const navigationEntry = performance.getEntriesByType("navigation")[0];
        const isReload = navigationEntry?.type === "reload";

        // Ordinary visits and browser refreshes begin at the hero. Do not
        // override direct ?product=... store links.
        const startAtHero = (!location.hash || isReload) &&
          !new URLSearchParams(location.search).has("product");
        if (!startAtHero) return;

        if (isReload && location.hash) {
          history.replaceState(null, "", location.pathname + location.search);
        }

        let interacted = false;
        ["touchstart", "pointerdown", "wheel", "keydown"].forEach(type =>
          window.addEventListener(type, () => { interacted = true; },
            { once: true, passive: true })
        );

        const resetScroll = () => {
          if (interacted || new URLSearchParams(location.search).has("product")) return;
          const oldBehavior = document.documentElement.style.scrollBehavior;
          document.documentElement.style.scrollBehavior = "auto";
          window.scrollTo(0, 0);
          document.documentElement.style.scrollBehavior = oldBehavior;
        };

        resetScroll();
        document.addEventListener("DOMContentLoaded", resetScroll, { once: true });
        window.addEventListener("pageshow", () => {
          resetScroll();
          requestAnimationFrame(resetScroll);
        });
        window.addEventListener("load", () => {
          resetScroll();
          requestAnimationFrame(() => requestAnimationFrame(resetScroll));
          setTimeout(resetScroll, 250);
        }, { once: true });
      })();
