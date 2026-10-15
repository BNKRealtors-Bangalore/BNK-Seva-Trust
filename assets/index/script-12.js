(() => {
  const section = document.getElementById("seva-impact");
  if (!section) return;

  const stage = document.getElementById("impactStage");
  const portrait = document.getElementById("impactPortrait");
  const svg = document.getElementById("impactConnections");
  const left = document.getElementById("impactLeft");
  const right = document.getElementById("impactRight");

  // Replace these illustrative figures with verified Trust data.
  const impactData = [
    {
      id: "meals",
      label: "Meals Served",
      value: 10,
      side: "left",
      icon: "meal"
    },

    {
      id: "medical",
      label: "Medical Beneficiaries",
      value: 20,
      side: "left",
      icon: "medical"
    },
    {
      id: "trees",
      label: "Trees Planted",
      value: 40,
      side: "left",
      icon: "tree"
    },
    {
      id: "volunteers",
      label: "Volunteers",
      value: 85,
      side: "left",
      icon: "people"
    },
    {
      id: "students",
      label: "Students Supported",
      value: 32,
      side: "right",
      icon: "student"
    },
    {
      id: "families",
      label: "Families Supported",
      value: 19,
      side: "right",
      icon: "people"
    },
    {
      id: "activities",
      label: "Seva Activities",
      value: 42,
      side: "right",
      icon: "heart"
    },
    {
      id: "communities",
      label: "Communities Reached",
      value: 64,
      side: "right",
      icon: "location"
    }
  ];

  // SVG line icons.
  const icons = {
    meal: `
      <path d="M7 27h34c0 11-7 17-17 17S7 38 7 27Z"/>
      <path d="M12 44h24M15 20c-5-5 4-7 0-13M25 20c-5-5 4-7 0-13M35 20c-5-5 4-7 0-13"/>
    `,
    medical: `
      <path d="M18 5h12v13h13v12H30v13H18V30H5V18h13Z"/>
    `,
    tree: `
      <path d="M24 45V24M24 30C8 30 6 21 6 9c13 0 18 8 18 21ZM24 25C24 10 31 5 43 5c0 15-6 20-19 20Z"/>
    `,
    people: `
      <circle cx="24" cy="13" r="6"/>
      <circle cx="9" cy="20" r="5"/>
      <circle cx="39" cy="20" r="5"/>
      <path d="M13 43v-7c0-7 5-12 11-12s11 5 11 12v7M2 43v-7c0-5 3-8 8-8M46 43v-7c0-5-3-8-8-8"/>
    `,
    student: `
      <path d="M3 17 24 8l21 9-21 9L3 17ZM11 23v11c8 7 18 7 26 0V23M45 17v17"/>
    `,
    heart: `
      <path d="M24 25 12 14C3 6 0 21 10 29l14 10 14-10c10-8 7-23-2-15L24 25Z"/>
      <path d="M4 42h13l9-6h11c5 0 5-7 0-7"/>
    `,
    location: `
      <path d="M24 45S9 29 9 19a15 15 0 0 1 30 0c0 10-15 26-15 26Z"/>
      <circle cx="24" cy="19" r="5"/>
    `
  };

  const format = value =>
    Number(value).toLocaleString("en-IN");

  const ns = "http://www.w3.org/2000/svg";
  const connectionGroups = new Map();

  // Create each metric.
  function createStat(item, index) {
    const stat = document.createElement("article");
    stat.className = "impact-stat";
    stat.dataset.impactId = item.id;

    const icon = document.createElement("div");
    icon.className = "impact-stat-icon";
    icon.setAttribute("aria-hidden", "true");

    icon.innerHTML = `
      <svg viewBox="0 0 48 48">
        ${icons[item.icon]}
      </svg>
    `;

    const content = document.createElement("div");
    content.className = "impact-stat-text";

    const number = document.createElement("span");
    number.className = "impact-stat-number";
    number.textContent = "0";
    number.dataset.target = item.value;

    const label = document.createElement("span");
    label.className = "impact-stat-label";
    label.textContent = item.label;

    content.append(number, label);
    stat.append(icon, content);

    const delay = 300 + index * 110;
    stat.style.setProperty("--impact-delay", `${delay}ms`);

    stat.addEventListener("mouseenter", () => {
      connectionGroups.get(item.id)?.classList.add(
        "is-active"
      );
    });

    stat.addEventListener("mouseleave", () => {
      connectionGroups.get(item.id)?.classList.remove(
        "is-active"
      );
    });

    return stat;
  }

  impactData.forEach((item, i) => {
    const stat = createStat(item, i);

    if (item.side === "left") {
      left.appendChild(stat);
    } else {
      right.appendChild(stat);
    }
  });

  // Create SVG elements for each connection.
  function svgElement(tag, attributes = {}) {
    const el = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([key, value]) => {
      el.setAttribute(key, String(value));
    });
    return el;
  }

  impactData.forEach(item => {
    const group = svgElement("g", {
      class: "impact-connection"
    });

    const glow = svgElement("path", {
      class: "impact-path-glow"
    });

    const base = svgElement("path", {
      class: "impact-path"
    });

    const flow = svgElement("path", {
      class: "impact-path-flow"
    });

    const startDot = svgElement("circle", {
      class: "impact-connection-dot",
      r: 6
    });

    const endDot = svgElement("circle", {
      class: "impact-connection-dot",
      r: 5
    });

    group.append(glow, base, flow, startDot, endDot);
    svg.appendChild(group);

    connectionGroups.set(item.id, group);
  });

  // Dynamically position all eight curves.
  function positionLines() {
    if (window.innerWidth <= 700) return;

    const stageRect = stage.getBoundingClientRect();
    const circleRect = portrait.getBoundingClientRect();

    const cx =
      circleRect.left - stageRect.left +
      circleRect.width / 2;

    const cy =
      circleRect.top - stageRect.top +
      circleRect.height / 2;

    const radius = circleRect.width / 2;

    svg.setAttribute(
      "viewBox",
      `0 0 ${stageRect.width} ${stageRect.height}`
    );

    impactData.forEach(item => {
      const stat = stage.querySelector(
        `[data-impact-id="${item.id}"]`
      );

      if (!stat) return;

      const icon = stat.querySelector(".impact-stat-icon");
      const rect = icon.getBoundingClientRect();

      const iconCenterX =
        rect.left - stageRect.left + rect.width / 2;

      const iconCenterY =
        rect.top - stageRect.top + rect.height / 2;

      // Unit vector from image centre toward the icon.
      const dx = iconCenterX - cx;
      const dy = iconCenterY - cy;
      const length = Math.hypot(dx, dy) || 1;

      const ux = dx / length;
      const uy = dy / length;

      // Start at outer edge of circular portrait.
      const x1 = cx + ux * (radius + 3);
      const y1 = cy + uy * (radius + 3);

      // Keep guide lines equal in length and stop before
      // the stat cards so lines never collide with text.
      const statGap = rect.width / 2 + 24;
      const availableLength = Math.max(
        0,
        length - radius - statGap
      );
      const guideLength = Math.min(130, availableLength);

      const x2 = x1 + ux * guideLength;
      const y2 = y1 + uy * guideLength;

      // Curved cubic Bézier with gentle horizontal flow.
      const d = `M ${x1} ${y1} L ${x2} ${y2}`;

      const group = connectionGroups.get(item.id);
      if (!group) return;

      group.querySelectorAll("path").forEach(path => {
        path.setAttribute("d", d);
      });

      const dots = group.querySelectorAll("circle");

      dots[0].setAttribute("cx", x1);
      dots[0].setAttribute("cy", y1);

      dots[1].setAttribute("cx", x2);
      dots[1].setAttribute("cy", y2);
    });
  }

  // Smooth number counting.
  function animateNumber(element, target, duration = 1800) {
    const start = performance.now();

    function update(time) {
      const progress = Math.min(
        (time - start) / duration,
        1
      );

      const eased = 1 - Math.pow(1 - progress, 3);

      element.textContent = format(
        Math.round(target * eased)
      );

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const revealItems = [
    ...section.querySelectorAll(".impact-reveal")
  ];

  revealItems.forEach((item, index) => {
    item.style.setProperty(
      "--impact-delay",
      `${index * 150}ms`
    );
  });

  const allStatElements =
    section.querySelectorAll(".impact-stat");

  let started = false;

  function startImpactAnimation() {
    if (started) return;
    started = true;

    section.classList.add("impact-in-view");

    revealItems.forEach(item => {
      item.classList.add("visible");
    });

    allStatElements.forEach(stat => {
      stat.classList.add("visible");

      const number = stat.querySelector(
        ".impact-stat-number"
      );

      const target = Number(number.dataset.target);

      if (reducedMotion) {
        number.textContent = format(target);
      } else {
        // Begin counting after the stat starts revealing.
        const delay = parseInt(
          stat.style.getPropertyValue("--impact-delay"),
          10
        ) || 0;

        window.setTimeout(() => {
          animateNumber(number, target);
        }, delay);
      }
    });
  }

  // Layout measurements after images and fonts settle.
  let layoutFrame;

  function scheduleLayout() {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(positionLines);
  }

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(scheduleLayout);
    resizeObserver.observe(stage);
    resizeObserver.observe(portrait);
  }

  window.addEventListener("resize", scheduleLayout);
  portrait.querySelector("img")
    ?.addEventListener("load", scheduleLayout);

  document.fonts?.ready.then(scheduleLayout);
  scheduleLayout();

  if (
    reducedMotion ||
    !("IntersectionObserver" in window)
  ) {
    startImpactAnimation();
    return;
  }

  section.classList.add("impact-animated");

  const observer = new IntersectionObserver(
    entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        startImpactAnimation();
        observer.disconnect();
      }
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -40px 0px"
    }
  );

  observer.observe(section);
})();
