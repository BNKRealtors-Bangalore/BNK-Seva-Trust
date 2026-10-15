(() => {
  const section = document.getElementById("upcoming-seva");
  const viewAll = section?.querySelector(".upcoming-view-all");
  const inlineList = document.getElementById("upcomingAllEvents");
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
  const defaultEvents = [
    { campaignName: "Free Medical Camp", location: "Newtown, Kolkata", date: "2026-10-15", image: "images/optimized/medical-camp-event-1095.webp", status: "Active" },
    { campaignName: "Food Distribution Drive", location: "Siliguri", date: "2026-10-22", image: "images/optimized/food-distribution-event-822.webp", status: "Active" },
    { campaignName: "Educational Support Programme", location: "Bengaluru", date: "2026-11-02", image: "images/optimized/education-event-822.webp", status: "Active" }
  ];
  let allEvents = defaultEvents;
  function formatEventDate(value) {
    const date = value ? new Date(value + "T12:00:00") : null;
    return date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "";
  }
  function dateParts(value) {
    const date = value ? new Date(value + "T12:00:00") : null;
    if (!date || Number.isNaN(date.getTime())) return { day: "--", month: "TBA" };
    return {
      day: date.toLocaleDateString("en-IN", { day: "2-digit" }),
      month: date.toLocaleDateString("en-IN", { month: "short" }).toUpperCase()
    };
  }
  function normaliseEvents(events) {
    const usable = (events || [])
      .filter(event => event.status === "Active" || event.status === "Planned")
      .map(event => ({ ...event, campaignName: event.campaignName || event.name || "" }));
    return usable.length ? usable : [];
  }
  function renderTopEvents() {
    const featured = allEvents[0];
    const sideCards = [...section.querySelectorAll(".upcoming-side-event")];
    const featuredCard = section.querySelector(".upcoming-featured");
    const topEvents = allEvents.slice(0, 3);
    if (featured && featuredCard) {
      const parts = dateParts(featured.date);
      featuredCard.hidden = false;
      featuredCard.querySelector("img").src = featured.image || "images/optimized/medical-camp-event-1095.webp";
      featuredCard.querySelector("img").alt = featured.campaignName || "Seva event";
      featuredCard.querySelector(".upcoming-day").textContent = parts.day;
      featuredCard.querySelector(".upcoming-month").textContent = parts.month;
      featuredCard.querySelector("h3").textContent = featured.campaignName || "Seva Event";
      const location = featuredCard.querySelector(".upcoming-location");
      location.lastChild.textContent = ` ${featured.location || ""}`;
    } else if (featuredCard) {
      featuredCard.hidden = true;
    }
    sideCards.forEach((card, index) => {
      const event = topEvents[index + 1];
      if (!event) { card.hidden = true; return; }
      const parts = dateParts(event.date);
      card.hidden = false;
      card.querySelector("img").src = event.image || "images/optimized/food-distribution-event-822.webp";
      card.querySelector("img").alt = event.campaignName || "Seva event";
      card.querySelector(".upcoming-day").textContent = parts.day;
      card.querySelector(".upcoming-month").textContent = parts.month;
      card.querySelector("h3").textContent = event.campaignName || "Seva Event";
      const location = card.querySelector(".upcoming-location");
      location.lastChild.textContent = ` ${event.location || ""}`;
    });
  }
  function renderInlineEvents() {
    const remainingEvents = allEvents.slice(3);
    if (!remainingEvents.length) {
      inlineList.innerHTML = '<p class="upcoming-all-empty">No additional seva events are published right now.</p>';
      return;
    }
    inlineList.innerHTML = remainingEvents.map(event => `
      <article class="upcoming-all-card">
        <img src="${escapeHTML(event.image || "images/optimized/medical-camp-event-1095.webp")}" alt="${escapeHTML(event.campaignName || event.name || "Seva event")}" loading="lazy" decoding="async">
        <div class="upcoming-all-body">
          <span class="upcoming-all-date">${escapeHTML(formatEventDate(event.date))}</span>
          <h3>${escapeHTML(event.campaignName || event.name || "Seva Event")}</h3>
          <p>${escapeHTML(event.location || "")}</p>
          <a href="#join-seva" class="upcoming-event-button">JOIN <span aria-hidden="true">→</span></a>
        </div>
      </article>
    `).join("");
  }
  function setEvents(events) {
    const normalised = normaliseEvents(events);
    allEvents = normalised.length ? normalised : [];
    renderTopEvents();
    renderInlineEvents();
  }
  async function loadAdminEvents() {
    try {
      const response = await fetch("/api/site-content", { cache: "no-store" });
      if (!response.ok) return;
      const content = await response.json();
      setEvents(content.records?.initiatives || []);
    } catch {
      // Keep default events.
    }
  }
  viewAll?.addEventListener("click", event => {
    event.preventDefault();
    const open = inlineList.hidden;
    inlineList.hidden = !open;
    viewAll.innerHTML = open
      ? 'HIDE EVENTS <span aria-hidden="true">→</span>'
      : 'VIEW ALL EVENTS <span aria-hidden="true">→</span>';
    if (open) inlineList.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.addEventListener("bnk:site-content", event => {
    setEvents(event.detail?.records?.initiatives || []);
  });
  setEvents(defaultEvents);
  loadAdminEvents();

  function volunteerAreaForEvent(eventName) {
    const text = String(eventName || "").toLowerCase();
    if (text.includes("medical") || text.includes("health")) return "Medical Volunteer";
    if (text.includes("food") || text.includes("meal") || text.includes("anna")) return "Food Seva Volunteer";
    if (text.includes("education") || text.includes("student") || text.includes("school")) return "Education Volunteer";
    if (text.includes("temple")) return "Temple Project Volunteer";
    return "Event Volunteer";
  }

  function goToVolunteerForm(eventName) {
    const volunteerSection = document.getElementById("join-seva");
    const formCard = volunteerSection?.querySelector(".bnk-volunteer-form-card");
    const areaSelect = document.getElementById("volArea");
    const nameInput = document.getElementById("volName");
    const area = volunteerAreaForEvent(eventName);

    if (areaSelect) {
      areaSelect.value = area;
      areaSelect.dispatchEvent(new Event("change", { bubbles: true }));
    }

    formCard?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    window.setTimeout(() => {
      nameInput?.focus({ preventScroll: true });
    }, 420);
  }

  section.addEventListener("click", event => {
    const link = event.target.closest(".upcoming-event-button");
    if (!link) return;

    event.preventDefault();

    const card = link.closest(
      ".upcoming-featured, .upcoming-side-event, .upcoming-all-card"
    );

    const eventName =
      card?.querySelector("h3")?.textContent?.trim()
      || "Seva Event";

    goToVolunteerForm(eventName);
  });
})();
