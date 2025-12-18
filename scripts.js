// =========================
// Mobile menu functionality
// =========================
(() => {
  const btn = document.getElementById("menuBtn");
  const overlay = document.getElementById("mobileMenu");
  const closeBtn = document.getElementById("menuClose");

  if (!btn || !overlay || !closeBtn) return;

  const openMenu = () => {
    overlay.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  };

  const closeMenu = () => {
    overlay.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    btn.focus();
  };

  btn.addEventListener("click", () => {
    overlay.hidden ? openMenu() : closeMenu();
  });

  closeBtn.addEventListener("click", closeMenu);

  document.addEventListener("keydown", (e) => {
    if (!overlay.hidden && e.key === "Escape") closeMenu();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target.closest("a")) closeMenu();
  });
})();


// =======================================
// Walls page: Leaflet map + pins
// =======================================
(() => {
  const mapEl = document.getElementById("map");
  if (!mapEl || typeof L === "undefined") return;

  if (mapEl.dataset.leafletInited === "true") return;
  mapEl.dataset.leafletInited = "true";

  const map = L.map(mapEl, { zoomControl: false })
    .setView([56.155, 10.205], 14);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 20,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
      '&copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map);

  const pinIcon = L.icon({
    iconUrl: "assets/pin.svg",
    iconSize: [40, 40],
    iconAnchor: [20, 36]
  });

  const spots = [
    {
      name: "Mejlgade",
      lat: 56.159889,
      lng: 10.211833,
      url: "mejlgade.html"
    },
    {
      name: "Godsbanen",
      lat: 56.1535,
      lng: 10.194056,
      url: "godsbanen.html"
    },
    {
      name: "Sydhavnen",
      lat: 56.148944,
      lng: 10.210639,
      url: "sydhavnen.html"
    }
  ];

  const bounds = L.latLngBounds([]);

  spots.forEach(s => {
    const marker = L.marker([s.lat, s.lng], { icon: pinIcon }).addTo(map);
    marker.on("click", () => (window.location.href = s.url));
    bounds.extend(marker.getLatLng());
  });

  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
  }

  window.__HW_invalidateMap = () =>
    requestAnimationFrame(() => map.invalidateSize());
})();


// =======================================
// Walls page: draggable bottom sheet (MOBILE)
// =======================================
(() => {
  const sheet = document.getElementById("sheet");
  const handle = document.getElementById("sheetHandle");
  const inner = document.getElementById("sheetInner");
  if (!sheet || !handle || !inner) return;

  const mql = window.matchMedia("(min-width: 1024px)");

  const invalidateMap =
    typeof window.__HW_invalidateMap === "function"
      ? window.__HW_invalidateMap
      : () => {};

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  // Mobile snaps
  let snaps = { collapsed: 0, expanded: 0 };

  const computeSnaps = () => {
    const topbarH = 72;
    const availableH = window.innerHeight - topbarH;
    const peek = 250; // visible part when collapsed
    snaps.collapsed = Math.max(availableH - peek, 0);
    snaps.expanded = 0;
  };

  const getY = () => {
    const v = getComputedStyle(sheet).getPropertyValue("--sheetY").trim();
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : snaps.collapsed;
  };

  const setY = (y, animate = false) => {
    sheet.style.transition = animate ? "transform 220ms ease" : "none";
    sheet.style.setProperty("--sheetY", `${y}px`);

    // lock scroll until fully expanded
    if (y > snaps.expanded + 0.5) {
      inner.scrollTop = 0;
      inner.style.overflow = "hidden";
    } else {
      inner.style.overflow = "auto";
    }

    // map UI fades with sheet
    const t = clamp(y / (snaps.collapsed || 1), 0, 1);
    document.documentElement.style.setProperty("--uiOpacity", String(t));

    invalidateMap();
  };

  const snapTo = (name) => setY(snaps[name], true);

  // Desktop reset helper
  const resetForDesktop = () => {
    sheet.style.transition = "none";
    sheet.style.removeProperty("--sheetY");
    inner.style.overflow = "auto";
    document.documentElement.style.setProperty("--uiOpacity", "1");
  };

  // If we are desktop at load: reset and stop
  if (mql.matches) {
    resetForDesktop();
    return;
  }

  // Initial mobile state
  computeSnaps();
  setY(snaps.collapsed, false);

  // Keep snaps updated
  const onResize = () => {
    if (mql.matches) {
      resetForDesktop();
      return;
    }
    const wasExpanded = getY() <= snaps.expanded + 0.5;
    computeSnaps();
    setY(wasExpanded ? snaps.expanded : snaps.collapsed, false);
  };

  window.addEventListener("resize", onResize);

  // If breakpoint crosses to desktop, reset
  const onMediaChange = (e) => {
    if (e.matches) resetForDesktop();
    else onResize();
  };
  if (mql.addEventListener) mql.addEventListener("change", onMediaChange);
  else mql.addListener(onMediaChange);

  // -----------------------
  // 1) DRAG handle
  // -----------------------
  let dragging = false;
  let startPointerY = 0;
  let startSheetY = 0;
  let lastPointerY = 0;
  let lastT = 0;
  let velocity = 0;

  const onDown = (e) => {
    if (mql.matches) return;          // desktop: ignore
    if (inner.scrollTop > 0) return;  // don't fight content scroll

    dragging = true;
    sheet.style.transition = "none";

    startPointerY = e.clientY;
    startSheetY = getY();

    lastPointerY = e.clientY;
    lastT = performance.now();
    velocity = 0;

    handle.setPointerCapture(e.pointerId);
  };

  const onMove = (e) => {
    if (!dragging) return;

    const dy = e.clientY - startPointerY;
    const next = clamp(startSheetY + dy, snaps.expanded, snaps.collapsed);
    setY(next, false);

    const now = performance.now();
    const dt = Math.max(1, now - lastT);
    velocity = (e.clientY - lastPointerY) / dt;

    lastPointerY = e.clientY;
    lastT = now;
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;

    const y = getY();

    // flick
    if (velocity < -0.6) return snapTo("expanded");
    if (velocity > 0.6) return snapTo("collapsed");

    // nearest
    const midpoint = snaps.collapsed * 0.5;
    snapTo(y < midpoint ? "expanded" : "collapsed");
  };

  handle.addEventListener("pointerdown", onDown);
  handle.addEventListener("pointermove", onMove);
  handle.addEventListener("pointerup", onUp);
  handle.addEventListener("pointercancel", onUp);

  // ------------------------------------
  // 2) Wheel/trackpad expands sheet first
  // ------------------------------------
  inner.addEventListener(
    "wheel",
    (e) => {
      if (mql.matches) return;

      const y = getY();

      // scroll down = expand sheet first
      if (y > snaps.expanded + 0.5 && e.deltaY > 0) {
        e.preventDefault();
        setY(clamp(y - e.deltaY, snaps.expanded, snaps.collapsed), false);
        return;
      }

      // if expanded and at top of content, scroll up collapses
      if (y <= snaps.expanded + 0.5 && inner.scrollTop === 0 && e.deltaY < 0) {
        e.preventDefault();
        setY(clamp(y - e.deltaY, snaps.expanded, snaps.collapsed), false);
      }
    },
    { passive: false }
  );

  // -----------------------------
  // 3) Touch “normal scroll” feel
  // -----------------------------
  let tStartY = 0;
  let tStartSheetY = 0;
  let touchActive = false;

  inner.addEventListener(
    "touchstart",
    (e) => {
      if (mql.matches) return;
      if (e.touches.length !== 1) return;
      touchActive = true;
      tStartY = e.touches[0].clientY;
      tStartSheetY = getY();
    },
    { passive: true }
  );

  inner.addEventListener(
    "touchmove",
    (e) => {
      if (!touchActive || mql.matches) return;
      if (e.touches.length !== 1) return;

      const y = getY();
      const fingerY = e.touches[0].clientY;
      const dy = fingerY - tStartY;

      // swipe up expands sheet
      if (y > snaps.expanded + 0.5 && dy < 0) {
        e.preventDefault();
        setY(clamp(tStartSheetY + dy, snaps.expanded, snaps.collapsed), false);
        return;
      }

      // expanded + at top + swipe down collapses
      if (y <= snaps.expanded + 0.5 && inner.scrollTop === 0 && dy > 0) {
        e.preventDefault();
        setY(clamp(tStartSheetY + dy, snaps.expanded, snaps.collapsed), false);
      }
    },
    { passive: false }
  );

  inner.addEventListener("touchend", () => {
    if (!touchActive || mql.matches) return;
    touchActive = false;

    const y = getY();
    const midpoint = snaps.collapsed * 0.5;
    snapTo(y < midpoint ? "expanded" : "collapsed");
  });

  // Start collapsed
  snapTo("collapsed");
})();


// =======================================
// Spot pages: gallery (reusable)
// Works on any page that has: [data-gallery] + .gallery__img + [data-prev]/[data-next]
// Optional thumbnails: buttons with [data-thumb]
// =======================================
(() => {
  const root = document.querySelector("[data-gallery]");
  if (!root) return;

  const slides = Array.from(root.querySelectorAll(".gallery__img"));
  const prevBtn = root.querySelector("[data-prev]");
  const nextBtn = root.querySelector("[data-next]");
  if (!slides.length || !prevBtn || !nextBtn) return;

  const thumbs = Array.from(root.querySelectorAll("[data-thumb]"));

  let i = slides.findIndex(s => s.classList.contains("is-active"));
  if (i < 0) i = 0;

  const setActive = (index) => {
    slides.forEach((s, idx) => s.classList.toggle("is-active", idx === index));
    thumbs.forEach((t, idx) => t.classList.toggle("is-active", idx === index));
    i = index;
  };

  const show = (nextIndex) => {
    const idx = (nextIndex + slides.length) % slides.length;
    setActive(idx);
  };

  // init
  setActive(i);

  prevBtn.addEventListener("click", () => show(i - 1));
  nextBtn.addEventListener("click", () => show(i + 1));

  thumbs.forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.thumb, 10);
      if (Number.isFinite(idx)) setActive(Math.max(0, Math.min(idx, slides.length - 1)));
    });
  });

  // swipe
  let startX = 0;
  root.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
  }, { passive: true });

  root.addEventListener("touchend", (e) => {
    const endX = e.changedTouches[0].clientX;
    const dx = endX - startX;
    if (Math.abs(dx) < 40) return;
    dx > 0 ? show(i - 1) : show(i + 1);
  });
})();


// =======================================
// Spot pages: mini Leaflet map
// =======================================
(() => {
  const el = document.getElementById("spotMap");
  if (!el || typeof L === "undefined") return;

  if (el.dataset.leafletInited === "true") return;
  el.dataset.leafletInited = "true";

  const lat = parseFloat(el.dataset.lat);
  const lng = parseFloat(el.dataset.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

  const map = L.map(el, {
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    keyboard: false
  }).setView([lat, lng], 16);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 20,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
      '&copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map);

  const pinIcon = L.icon({
    iconUrl: "assets/pin.svg",
    iconSize: [44, 44],
    iconAnchor: [22, 40]
  });

  L.marker([lat, lng], { icon: pinIcon }).addTo(map);
})();

// =======================================
// "Feeling adventurous?" button
// =======================================
(() => {
  const btn = document.querySelector(".adventure-btn");
  if (!btn) return;

  const pages = ["mejlgade.html", "godsbanen.html", "sydhavnen.html"];
  btn.addEventListener("click", () => {
    window.location.href = pages[Math.floor(Math.random() * pages.length)];
  });
})();
