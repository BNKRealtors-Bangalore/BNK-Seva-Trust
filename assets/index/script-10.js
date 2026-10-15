(() => {
  const disabledSelectors = [
    ".transparency-section .transparency-link",
    ".transparency-section .transparency-main-button",
    "#temple-updates .temple-update-arrow",
    "#temple-updates .temple-updates-all",
    "#temple-updates .temple-update-play"
  ];

  function disableTemporaryLinks() {
    document.querySelectorAll(disabledSelectors.join(","))
      .forEach(element => {
        if (element.hasAttribute("href")) {
          element.dataset.disabledHref = element.getAttribute("href");
          element.removeAttribute("href");
        }

        element.classList.add("is-disabled-link");
        element.setAttribute("aria-disabled", "true");
        element.setAttribute("tabindex", "-1");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", disableTemporaryLinks, { once: true });
  } else {
    disableTemporaryLinks();
  }
})();
