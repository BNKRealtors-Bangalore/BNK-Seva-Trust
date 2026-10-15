(() => {
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  const imageOrDefault = (value, fallback) => value ? String(value).trim() : fallback;

  function applyJourney(content) {
    const stages = content?.milestones || [];
    document.querySelectorAll("#temple-journey .jp-stage").forEach((stage, index) => {
      const item = stages[index];
      if (!item) return;
      stage.dataset.status = item.status || "Upcoming";
      let badge = stage.querySelector(".jp-status");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "jp-status";
        stage.querySelector(".jp-stage-heading")?.append(badge);
      }
      badge.textContent = item.status || "Upcoming";
    });
  }

  function applyUpdates(content) {
    const updates = (content?.records?.updates || content?.records?.initiatives || [])
      .filter(item => item.status === "Published" || item.status === "Active" || item.status === "Completed")
      .slice(0, 8);
    if (!updates.length) return;
    document.querySelectorAll("#temple-updates .temple-update-card").forEach((card, index) => {
      const item = updates[index];
      if (!item) return;
      const heading = card.querySelector("h3");
      const text = card.querySelector("p");
      const img = card.querySelector("img");
      if (heading) heading.innerHTML = escapeHTML(item.name || "Temple Update");
      if (text && item.description) text.textContent = item.description;
      if (img) {
        img.src = imageOrDefault(item.image, img.getAttribute("src"));
        img.alt = item.name || img.alt || "Temple update";
      }
    });
  }

  async function loadPublicSiteContent() {
    try {
      const response = await fetch("/api/site-content", { cache: "no-store" });
      if (!response.ok) return;
      const content = await response.json();
      applyJourney(content);
      applyUpdates(content);
      document.dispatchEvent(new CustomEvent("bnk:site-content", { detail: content }));
      window.BNK_SITE_CONTENT = content;
    } catch {
      // Keep static content if the server is unavailable.
    }
  }

  loadPublicSiteContent();
})();
