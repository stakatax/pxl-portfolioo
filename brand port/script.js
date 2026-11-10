"use strict";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const mediaMotion = matchMedia("(prefers-reduced-motion: reduce)");
let motionOff = mediaMotion.matches;
let soundOn = false;
let audioContext;
let toastTimer;
let lastDialogTrigger;

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove("visible"), 3000);
}

function tone(frequency = 660, duration = 0.08) {
  if (!soundOn) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    gain.gain.setValueAtTime(0.025, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + duration,
    );
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    soundOn = false;
    updateSound();
  }
}

function updateSound() {
  const button = $("#sound-toggle");
  button.setAttribute("aria-pressed", String(soundOn));
  button.setAttribute(
    "aria-label",
    soundOn ? "Disable sound effects" : "Enable sound effects",
  );
  button.innerHTML = soundOn
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-5v16l-5-5H3zM16 8q5 4 0 8m3-11q8 7 0 14"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-5v16l-5-5H3zM17 9l5 6m0-6-5 6"/></svg>';
}
$("#sound-toggle").addEventListener("click", () => {
  soundOn = !soundOn;
  updateSound();
  pxlMusic(soundOn);
  if (soundOn) tone();
  toast(soundOn ? "Sound effects on" : "Sound effects off");
});

function updateMotion() {
  document.body.classList.toggle("reduce-motion", motionOff);
  $("#motion-toggle").textContent = motionOff ? "Motion: off" : "Motion: on";
  $("#motion-toggle").setAttribute("aria-pressed", String(motionOff));
  if (motionOff) {
    sectionParallax.forEach(({ layers }) => {
      layers.forEach(({ element }) => {
        element.style.removeProperty("--parallax-x");
        element.style.removeProperty("--parallax-y");
      });
    });
    $$(".animation-stage").forEach((stage) =>
      stage.classList.remove("playing"),
    );
    $("#animation-toggle").setAttribute("aria-pressed", "false");
    $("#animation-toggle").innerHTML = "Play loop <span>▷</span>";
  }
  updateScroll();
}
$("#motion-toggle").addEventListener("click", () => {
  motionOff = !motionOff;
  updateMotion();
});
mediaMotion.addEventListener("change", (event) => {
  motionOff = event.matches;
  updateMotion();
});

const menuButton = $(".menu-button");
function closeMenu() {
  menuButton.setAttribute("aria-expanded", "false");
  $("#mobile-nav").hidden = true;
  menuButton.lastElementChild.textContent = "+";
}
menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!open));
  $("#mobile-nav").hidden = open;
  menuButton.lastElementChild.textContent = open ? "+" : "−";
});
$$("#mobile-nav a").forEach((link) =>
  link.addEventListener("click", closeMenu),
);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !$("#mobile-nav").hidden) {
    closeMenu();
    menuButton.focus();
  }
});
matchMedia("(min-width:761px)").addEventListener("change", (event) => {
  if (event.matches) closeMenu();
});

// Each section has its own camera: scenery moves at different speeds while
// paragraphs and controls stay in their normal reading and tab order.
function registerParallax(element, x, y) {
  element.setAttribute("data-parallax", "");
  return { element, x, y };
}

const sectionParallax = $$("main > section:not(.hero), main > footer").map(
  (section) => {
    section.classList.add("parallax-section");
    const scenery = document.createElement("div");
    scenery.className = "section-scenery";
    scenery.setAttribute("aria-hidden", "true");
    scenery.innerHTML =
      '<div class="scenery-grid"></div>' +
      '<span class="scenery-pixels scenery-pixels-back"></span>' +
      '<span class="scenery-pixels scenery-pixels-front"></span>';
    section.prepend(scenery);

    const layers = [
      registerParallax($(".scenery-grid", scenery), 0, -88),
      registerParallax($(".scenery-pixels-back", scenery), 34, -130),
      registerParallax($(".scenery-pixels-front", scenery), -48, 170),
    ];

    // Independent CSS translate preserves the artwork's existing rotations,
    // hover effects, and uncropped proportions.
    $$(".collectible-one", section).forEach((element) =>
      layers.push(registerParallax(element, -12, -64)),
    );
    $$(".collectible-two", section).forEach((element) =>
      layers.push(registerParallax(element, 12, 82)),
    );
    $$(".logo-showcase .actual-logo", section).forEach((element, index) =>
      layers.push(registerParallax(element, 0, index ? 28 : -28)),
    );
    $$(".campaign-row > .asset-button", section).forEach((element, index) =>
      layers.push(registerParallax(element, 0, index ? 52 : -52)),
    );
    $$(".manifesto-grid", section).forEach((element) =>
      layers.push(registerParallax(element, -24, -74)),
    );
    $$(".actual-footer-logo", section).forEach((element) =>
      layers.push(registerParallax(element, 0, -54)),
    );

    return { section, layers };
  },
);

const activeParallaxSections = new Set(sectionParallax);
const parallaxLayers = $$("[data-depth]");
const heroElement = $(".hero");
const scrollProgress = $(".scroll-progress");
let scrollTicking = false;
function updateScroll() {
  const scrollY = window.scrollY;
  const viewportHeight = window.innerHeight;
  const heroHeight = heroElement.offsetHeight;
  const distance = document.documentElement.scrollHeight - innerHeight;
  const travelScale = window.innerWidth <= 760 ? 0.5 : 1;

  // Read visible section geometry before writing any styles to avoid repeated
  // layout work. Offscreen sections do not animate or retain GPU hints.
  const sectionFrames = motionOff
    ? []
    : [...activeParallaxSections].map(({ section, layers }) => {
        const rect = section.getBoundingClientRect();
        const progress = Math.max(
          -1,
          Math.min(
            1,
            (viewportHeight / 2 - rect.top - rect.height / 2) /
              ((viewportHeight + rect.height) / 2),
          ),
        );
        return { layers, progress };
      });

  scrollProgress.style.width = `${distance > 0 ? (scrollY / distance) * 100 : 0}%`;
  if (scrollY < heroHeight + 100 || motionOff) {
    parallaxLayers.forEach((layer) => {
      const depth = Number(layer.dataset.depth);
      layer.style.transform = motionOff
        ? ""
        : `translate3d(0,${Math.min(scrollY, heroHeight) * depth}px,0)`;
    });
  }
  // Pixel-snapped: layers move in whole "pixel" steps like 8-bit scrolling.
  const pixelStep = window.innerWidth <= 760 ? 2 : 4;
  const stepped = (value) => Math.round(value / pixelStep) * pixelStep;
  sectionFrames.forEach(({ layers, progress }) => {
    layers.forEach(({ element, x, y }) => {
      element.style.setProperty(
        "--parallax-x",
        `${stepped(progress * x * travelScale)}px`,
      );
      element.style.setProperty(
        "--parallax-y",
        `${stepped(progress * y * travelScale)}px`,
      );
    });
  });
  scrollTicking = false;
}
function scheduleScrollUpdate() {
  if (!scrollTicking) {
    scrollTicking = true;
    requestAnimationFrame(updateScroll);
  }
}
window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
window.addEventListener("resize", scheduleScrollUpdate, { passive: true });
const parallaxVisibilityObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const region = sectionParallax.find(
        ({ section }) => section === entry.target,
      );
      entry.target.classList.toggle("parallax-in-view", entry.isIntersecting);
      if (entry.isIntersecting) activeParallaxSections.add(region);
      else activeParallaxSections.delete(region);
    });
    scheduleScrollUpdate();
  },
  { rootMargin: "180px 0px", threshold: 0 },
);
sectionParallax.forEach(({ section }) =>
  parallaxVisibilityObserver.observe(section),
);
updateMotion();

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      $$(".desktop-nav a").forEach((link) =>
        link.classList.toggle("active", link.hash === `#${entry.target.id}`),
      );
    });
  },
  { rootMargin: "-15% 0px -55% 0px", threshold: 0 },
);
$$("main>section[id]").forEach((section) => sectionObserver.observe(section));

let collected = 0;
$$("[data-coin]").forEach((coin) =>
  coin.addEventListener("click", () => {
    if (coin.classList.contains("collected")) return;
    coin.classList.add("collected");
    coin.disabled = true;
    collected++;
    $("#pixel-score").innerHTML = `PIXELS FOUND <b>0${collected} / 03</b>`;
    addPixels(1);
    tone(500 + collected * 180);
    toast(
      collected === 3
        ? "3 / 3. All pixels found. That’s a W!"
        : `Pixel found! ${collected} / 3`,
    );
  }),
);
$("#hero-bot").addEventListener("click", () => {
  const bot = $("#hero-bot");
  if (motionOff) {
    toast("Small pixels. Big jumps. Big possibilities.");
    return;
  }
  bot.classList.remove("jump");
  void bot.offsetWidth;
  bot.classList.add("jump");
  tone(440, 0.13);
});
$("#hero-bot").addEventListener("animationend", () =>
  $("#hero-bot").classList.remove("jump"),
);

function activateTab(tab, focus = false) {
  const list = tab.closest('[role="tablist"]');
  $$('[role="tab"]', list).forEach((other) => {
    const selected = other === tab;
    other.setAttribute("aria-selected", String(selected));
    other.tabIndex = selected ? 0 : -1;
    document.getElementById(other.getAttribute("aria-controls")).hidden =
      !selected;
  });
  if (focus) tab.focus();
  if (tab.id !== "games-tab" && list.classList.contains("product-tabs"))
    pauseGame();
  if (tab.id !== "animation-tab" && list.classList.contains("product-tabs"))
    pauseAnimation();
  scheduleScrollUpdate();
}
$$('[role="tablist"]').forEach((list) => {
  const tabs = $$('[role="tab"]', list);
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      activateTab(tab);
      tone(400, 0.04);
    });
    tab.addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      if (event.key === "ArrowLeft")
        next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = tabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        activateTab(tabs[next], true);
      }
    });
  });
});

$$("[data-color]").forEach((button) =>
  button.addEventListener("click", async () => {
    const value = button.dataset.color;
    try {
      await navigator.clipboard.writeText(value);
      toast(`${value} copied. Make something XL.`);
    } catch {
      toast(`Color: ${value}`);
    }
  }),
);
$("#type-input").addEventListener("input", (event) => {
  $$(".live-type").forEach(
    (text) => (text.textContent = event.target.value || "Pix L’s into W’s"),
  );
});

function pauseAnimation() {
  $(".animation-stage").classList.remove("playing");
  $("#animation-toggle").setAttribute("aria-pressed", "false");
  $("#animation-toggle").innerHTML = "Play loop <span>▷</span>";
}
$("#animation-toggle").addEventListener("click", () => {
  if (motionOff) {
    toast("Turn Motion on to preview the animation.");
    return;
  }
  const playing = $(".animation-stage").classList.toggle("playing");
  $("#animation-toggle").setAttribute("aria-pressed", String(playing));
  $("#animation-toggle").innerHTML = playing
    ? "Pause loop <span>Ⅱ</span>"
    : "Play loop <span>▷</span>";
});
const animationObserver = new IntersectionObserver(
  (entries) => {
    if (!entries[0].isIntersecting) pauseAnimation();
  },
  { threshold: 0.1 },
);
animationObserver.observe($(".animation-stage"));

// ===== PXL Studio: pixel art editor =====
const grid = $("#pixel-grid");
const cells = [];
const art = Array(256).fill(""); // "" = transparent
const COLOR_NAMES = {
  "#FFB65D": "peach",
  "#E08A2E": "amber",
  "#BE3621": "red",
  "#8F2B29": "brick",
  "#001768": "navy",
  "#FFF0D6": "cream",
  "": "blank",
};
let paint = "#FFB65D";
let tool = "pencil";
let mirror = false;
let drawing = false;
let strokeSaved = false;
const artHistory = [];
const artFuture = [];

for (let row = 0; row < 16; row++) {
  const rowElement = document.createElement("div");
  rowElement.setAttribute("role", "row");
  for (let column = 0; column < 16; column++) {
    const cell = document.createElement("button");
    cell.className = "pixel-cell";
    cell.setAttribute("role", "gridcell");
    cell.dataset.index = String(row * 16 + column);
    cell.tabIndex = row === 0 && column === 0 ? 0 : -1;
    cells.push(cell);
    rowElement.append(cell);
  }
  grid.append(rowElement);
}

const preview = $("#art-preview");
const previewContext = preview.getContext("2d");
function render() {
  let placed = 0;
  previewContext.clearRect(0, 0, 16, 16);
  art.forEach((color, index) => {
    const cell = cells[index];
    cell.dataset.color = color;
    cell.style.setProperty("--cell", color || "transparent");
    cell.classList.toggle("blank", !color);
    cell.setAttribute(
      "aria-label",
      `Row ${Math.floor(index / 16) + 1}, column ${(index % 16) + 1}: ${COLOR_NAMES[color] || color}`,
    );
    if (color) {
      placed++;
      previewContext.fillStyle = color;
      previewContext.fillRect(index % 16, Math.floor(index / 16), 1, 1);
    }
  });
  $("#st-count").textContent = `PIXELS: ${String(placed).padStart(3, "0")}`;
}
function snapshot() {
  artHistory.push(art.slice());
  if (artHistory.length > 60) artHistory.shift();
  artFuture.length = 0;
}
function restore(from, to) {
  if (!from.length) return;
  to.push(art.slice());
  art.splice(0, 256, ...from.pop());
  render();
  tone(520, 0.03);
}

function setPixel(index, color) {
  if (art[index] === color) return;
  art[index] = color;
  if (color) countPaint();
}
function floodFill(start, color) {
  const target = art[start];
  if (target === color) return;
  const stack = [start];
  while (stack.length) {
    const index = stack.pop();
    if (art[index] !== target) continue;
    setPixel(index, color);
    const x = index % 16;
    if (x > 0) stack.push(index - 1);
    if (x < 15) stack.push(index + 1);
    if (index >= 16) stack.push(index - 16);
    if (index < 240) stack.push(index + 16);
  }
}
function useTool(cell) {
  if (!cell?.classList.contains("pixel-cell")) return;
  const index = Number(cell.dataset.index);
  const color = tool === "eraser" ? "" : paint;
  if (!strokeSaved) {
    snapshot();
    strokeSaved = true;
  }
  const targets = [index];
  if (mirror) targets.push(Math.floor(index / 16) * 16 + (15 - (index % 16)));
  targets.forEach((i) => (tool === "fill" ? floodFill(i, color) : setPixel(i, color)));
  render();
}
// Kept for other modules that expect it.
function paintCell(cell) {
  useTool(cell);
}

grid.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  drawing = true;
  strokeSaved = false;
  useTool(event.target);
  if (tool === "fill") {
    drawing = false;
    tone(330, 0.08);
  }
  event.preventDefault();
});
grid.addEventListener("pointermove", (event) => {
  if (drawing) useTool(document.elementFromPoint(event.clientX, event.clientY));
});
const endStroke = () => {
  drawing = false;
  strokeSaved = false;
};
window.addEventListener("pointerup", endStroke);
window.addEventListener("pointercancel", endStroke);

grid.addEventListener("keydown", (event) => {
  const cell = event.target.closest(".pixel-cell");
  if (!cell) return;
  const index = Number(cell.dataset.index);
  let next = index;
  if (event.key === "ArrowRight") next = Math.min(255, index + 1);
  else if (event.key === "ArrowLeft") next = Math.max(0, index - 1);
  else if (event.key === "ArrowDown") next = Math.min(255, index + 16);
  else if (event.key === "ArrowUp") next = Math.max(0, index - 16);
  else if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    strokeSaved = false;
    useTool(cell);
    strokeSaved = false;
    return;
  } else return;
  event.preventDefault();
  cell.tabIndex = -1;
  cells[next].tabIndex = 0;
  cells[next].focus();
});

// ---- Tools, colors, mirror ----
function setTool(name) {
  tool = name;
  $$(".tool[data-tool]").forEach((button) => {
    const on = button.dataset.tool === name;
    button.classList.toggle("on", on);
    button.setAttribute("aria-pressed", String(on));
  });
  $("#st-tool").textContent = `TOOL: ${name.toUpperCase()}`;
  grid.dataset.tool = name;
  tone(700, 0.03);
}
function setMirror(on) {
  mirror = on;
  const button = $("#mirror-tool");
  button.classList.toggle("on", on);
  button.setAttribute("aria-pressed", String(on));
  grid.classList.toggle("mirrored", on);
  $("#st-mirror").textContent = `MIRROR: ${on ? "ON" : "OFF"}`;
  tone(on ? 880 : 440, 0.04);
}
$$(".tool[data-tool]").forEach((button) =>
  button.addEventListener("click", () => setTool(button.dataset.tool)),
);
$("#mirror-tool").addEventListener("click", () => setMirror(!mirror));
$$(".sw").forEach((swatch) =>
  swatch.addEventListener("click", () => {
    paint = swatch.dataset.color;
    $$(".sw").forEach((other) => {
      other.classList.toggle("on", other === swatch);
      other.setAttribute("aria-pressed", String(other === swatch));
    });
    $("#st-color").textContent = `COLOR: ${COLOR_NAMES[paint].toUpperCase()}`;
    if (tool === "eraser") setTool("pencil");
    tone(600, 0.03);
  }),
);
$("#undo-art").addEventListener("click", () => restore(artHistory, artFuture));
$("#redo-art").addEventListener("click", () => restore(artFuture, artHistory));
$("#clear-art").addEventListener("click", () => {
  snapshot();
  art.fill("");
  render();
  toast("A fresh canvas. Your next idea starts here.");
});
document.addEventListener("keydown", (event) => {
  const inStudio = event.target.closest?.(".studio") && !event.target.matches("input");
  if (!inStudio) return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === "z") {
    event.preventDefault();
    restore(event.shiftKey ? artFuture : artHistory, event.shiftKey ? artHistory : artFuture);
  } else if ((event.ctrlKey || event.metaKey) && key === "y") {
    event.preventDefault();
    restore(artFuture, artHistory);
  } else if (!event.ctrlKey && !event.metaKey && !event.altKey) {
    if (key === "b") setTool("pencil");
    else if (key === "e") setTool("eraser");
    else if (key === "g") setTool("fill");
    else if (key === "m") setMirror(!mirror);
  }
});

// ---- Starter templates ----
const TEMPLATES = {
  bot: [
    "................", ".......RR.......", ".......XX.......", "...XXXXXXXXXX...",
    "..XXXXXXXXXXXX..", "..XXNNXXXXNNXX..", "..XXNNXXXXNNXX..", "..XXXXXXXXXXXX..",
    "..XRXXXXXXXXRX..", "..XXXXRRRRXXXX..", "...XXXXXXXXXX...", ".....NNNNNN.....",
    "....NXXXXXXN....", "....NXXXXXXN....", ".....NN..NN.....", "................",
  ],
  heart: [
    "................", "................", "...RRR....RRR...", "..RRRRR..RRRRR..",
    ".RRCCRRRRRRRRRR.", ".RRCRRRRRRRRRRR.", ".RRRRRRRRRRRRRR.", ".RRRRRRRRRRRRRR.",
    "..RRRRRRRRRRRR..", "...RRRRRRRRRR...", "....RRRRRRRR....", ".....RRRRRR.....",
    "......RRRR......", ".......RR.......", "................", "................",
  ],
  p: [
    "................", "..XXXXXXXXXXX...", "..XXXXXXXXXXXR..", "..XXNNNNNNNXXR..",
    "..XXNNNNNNNXXR..", "..XXNNNNNNNXXR..", "..XXXXXXXXXXXR..", "..XXXXXXXXXXXR..",
    "..XX.RRRRRRRRR..", "..XXR...........", "..XX.X.X.X......", "..XXR.X..X......",
    "..XX.X.X.XXX....", "..XXR...........", "...RR...........", "................",
  ],
  w: [
    "................", "................", ".XX..........XX.", ".XX..........XX.",
    ".XX..........XX.", ".XX....XX....XX.", ".XX...XXXX...XX.", ".XX..XXRRXX..XX.",
    ".XX.XXRRRRXX.XX.", ".XXXXRR..RRXXXX.", ".XXXRR....RRXXX.", ".XXRR......RRXX.",
    ".XRR........RRX.", "................", "................", "................",
  ],
};
const T_COLORS = { X: "#FFB65D", R: "#BE3621", N: "#001768", C: "#FFF0D6" };
function loadTemplate(name) {
  snapshot();
  TEMPLATES[name].join("").split("").forEach((ch, index) => (art[index] = T_COLORS[ch] || ""));
  render();
  chime([
    [523, 0, 0.05],
    [784, 80, 0.08],
  ]);
}
$$("[data-template]").forEach((button) =>
  button.addEventListener("click", () => loadTemplate(button.dataset.template)),
);

// ---- Quests ----
const QUESTS = [
  "Draw your spirit animal.",
  "Draw a power-up you’d want in real life.",
  "Turn an L into a W.",
  "Draw your favorite snack, 8-bit style.",
  "Design a new PXL collectible.",
  "Draw the PXL Bot’s best friend.",
  "Draw your dream game controller.",
  "Make a tiny boss monster.",
  "Draw the view from your window.",
  "Draw yourself as a pixel hero.",
];
let questIndex = 0;
$("#quest-new").addEventListener("click", () => {
  questIndex = (questIndex + 1 + Math.floor(Math.random() * (QUESTS.length - 1))) % QUESTS.length;
  $("#quest-text").textContent = QUESTS[questIndex];
  tone(660, 0.04);
  setTimeout(() => tone(990, 0.06), 70);
});

// ---- Save: transparent PNG named by the player ----
$("#save-art").addEventListener("click", () => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  art.forEach((color, index) => {
    if (!color) return;
    context.fillStyle = color;
    context.fillRect((index % 16) * 32, Math.floor(index / 16) * 32, 32, 32);
  });
  const name = ($("#art-name").value.trim() || "untitled_pixel").replace(/[^\w-]+/g, "_");
  const link = document.createElement("a");
  link.download = `${name}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  toast(`Saved ${name}.png. Your sticker is ready.`);
});

// Start with the PXL Bot so there is always something to remix.
TEMPLATES.bot.join("").split("").forEach((ch, index) => (art[index] = T_COLORS[ch] || ""));
render();

const dialog = $("#detail-dialog");
const assets = {
  "logo-details": [
    "LOGO DEVELOPMENT / ORIGINAL DRAFTS",
    "assets/logo-board.png",
    "PXL logo development board",
  ],
  "primary-details": [
    "PXL / PRIMARY LOGO",
    "assets/logo-primary.png",
    "PXL primary logo",
  ],
  "secondary-details": [
    "PXL / SECONDARY LOGO",
    "assets/logo-secondary.png",
    "PXL secondary logo",
  ],
  "post-details": [
    "CT#2 / FIRST EVER BRAND POST",
    "assets/brand-post.png",
    "Original PXL first brand post, Pix L’s into W’s",
  ],
  "event-details": [
    "CT#3 / PROMOTIONAL EVENT POSTER",
    "assets/event-poster.png",
    "PXL World event poster, November 5, 2026 at SM City Cabanatuan Event Center",
  ],
};
$$("[data-open]").forEach((button) =>
  button.addEventListener("click", () => {
    lastDialogTrigger = button;
    const key = button.dataset.open;
    const content = $("#dialog-content");
    content.replaceChildren();
    if (assets[key]) {
      const [title, src, alt] = assets[key];
      $("#dialog-title").textContent = title;
      const image = document.createElement("img");
      image.src = src;
      image.alt = alt;
      image.className = "full-artwork";
      content.append(image);
    } else {
      $("#dialog-title").textContent = "PXL / ART & COLLECTIBLES";
      const art = $(".product-art").cloneNode(true);
      content.append(art);
      const heading = document.createElement("h3");
      heading.textContent = "Little objects. XL imagination.";
      content.append(heading);
      const paragraph = document.createElement("p");
      paragraph.textContent =
        "Meet The Explorer and The Daydreamer, the first faces of PXL Objects Series 001. Each one starts as a hand-placed pixel sprite and becomes something you can hold, print, or stick anywhere you want a little W.";
      content.append(paragraph);
    }
    dialog.showModal();
    document.body.classList.add("modal-open");
    $("#close-dialog").focus();
    pauseGame();
  }),
);
function closeDialog() {
  dialog.close();
}
$("#close-dialog").addEventListener("click", closeDialog);
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      closeDialog();
  }
});
dialog.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
  lastDialogTrigger?.focus();
});

// A small original arcade demo. No libraries, network calls, or saved personal data.
const gameCanvas = $("#game");
const ctx = gameCanvas.getContext("2d");
const game = {
  running: false,
  paused: false,
  x: 295,
  score: 0,
  remaining: 30,
  items: [],
  spawn: 0,
  last: 0,
  left: false,
  right: false,
  raf: 0,
};
function drawGame() {
  ctx.fillStyle = "#00134f";
  ctx.fillRect(0, 0, 640, 380);
  ctx.fillStyle = "#17327b";
  for (let x = 0; x < 640; x += 40)
    for (let y = 0; y < 360; y += 40) ctx.fillRect(x, y, 2, 2);
  ctx.fillStyle = "#ffb65d";
  ctx.fillRect(0, 350, 640, 4);
  ctx.fillRect(game.x, 320, 52, 16);
  ctx.fillRect(game.x + 7, 312, 38, 8);
  ctx.fillStyle = "#be3621";
  ctx.fillRect(game.x + 8, 336, 36, 7);
  game.items.forEach((item) => {
    ctx.fillStyle = item.bad ? "#be3621" : "#ffb65d";
    ctx.fillRect(item.x, item.y, 18, 18);
    if (item.bad) {
      ctx.fillStyle = "#fff0d6";
      ctx.fillRect(item.x + 7, item.y + 3, 4, 7);
      ctx.fillRect(item.x + 7, item.y + 13, 4, 3);
    }
  });
  ctx.fillStyle = "#ffb65d";
  ctx.font = "16px monospace";
  ctx.fillText(`${Math.ceil(game.remaining)}s`, 580, 25);
}
function endGame() {
  game.running = false;
  cancelAnimationFrame(game.raf);
  $("#game-overlay").hidden = false;
  $("#game-overlay h3").textContent = "THAT’S A W!";
  $("#game-overlay p").textContent =
    `You caught ${game.score} points. Try for your next high score.`;
  $("#game-start").innerHTML = "Play again <span>→</span>";
  $("#game-pause").disabled = true;
  $("#game-status").textContent = `Game complete. Final score ${game.score}.`;
  tone(880, 0.2);
}
function gameFrame(time) {
  if (!game.running || game.paused) return;
  const dt = Math.min((time - (game.last || time)) / 1000, 0.05);
  game.last = time;
  game.remaining -= dt;
  game.spawn += dt;
  if (game.left) game.x = Math.max(0, game.x - 330 * dt);
  if (game.right) game.x = Math.min(588, game.x + 330 * dt);
  if (game.spawn > 0.55) {
    game.spawn = 0;
    game.items.push({
      x: Math.random() * 610,
      y: -20,
      bad: Math.random() < 0.25,
      speed: 110 + Math.random() * 70,
    });
  }
  game.items = game.items.filter((item) => {
    item.y += item.speed * dt;
    if (
      item.y + 18 >= 312 &&
      item.y <= 340 &&
      item.x + 18 >= game.x &&
      item.x <= game.x + 52
    ) {
      game.score = Math.max(0, game.score + (item.bad ? -10 : 10));
      tone(item.bad ? 180 : 760, 0.05);
      $("#game-score").textContent =
        `SCORE ${String(game.score).padStart(3, "0")}`;
      return false;
    }
    return item.y < 355;
  });
  drawGame();
  if (game.remaining <= 0) {
    endGame();
    return;
  }
  game.raf = requestAnimationFrame(gameFrame);
}
function pauseGame() {
  if (!game.running || game.paused) return;
  game.paused = true;
  game.left = false;
  game.right = false;
  cancelAnimationFrame(game.raf);
  $("#game-pause").textContent = "Resume";
  $("#game-pause").setAttribute("aria-label", "Resume game");
  $("#game-status").textContent = "Game paused.";
}
function resumeGame() {
  if (!game.running || !game.paused) return;
  game.paused = false;
  game.last = 0;
  $("#game-pause").textContent = "Pause";
  $("#game-pause").setAttribute("aria-label", "Pause game");
  $("#game-status").textContent = "Game resumed.";
  game.raf = requestAnimationFrame(gameFrame);
}
$("#game-start").addEventListener("click", () => {
  achieve("arcade");
  cancelAnimationFrame(game.raf);
  Object.assign(game, {
    running: true,
    paused: false,
    x: 295,
    score: 0,
    remaining: 30,
    items: [],
    spawn: 0,
    last: 0,
    left: false,
    right: false,
  });
  $("#game-overlay").hidden = true;
  $("#game-score").textContent = "SCORE 000";
  $("#game-pause").disabled = false;
  $("#game-pause").textContent = "Pause";
  $("#game-pause").setAttribute("aria-label", "Pause game");
  gameCanvas.tabIndex = 0;
  gameCanvas.focus();
  $("#game-status").textContent =
    "Game started. Use left and right arrow keys or the on-screen buttons.";
  game.raf = requestAnimationFrame(gameFrame);
});
$("#game-pause").addEventListener("click", () =>
  game.paused ? resumeGame() : pauseGame(),
);
$(".arcade").addEventListener("keydown", (event) => {
  if (!game.running || game.paused) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    game[event.key === "ArrowLeft" ? "left" : "right"] = true;
  }
});
window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowLeft") game.left = false;
  if (event.key === "ArrowRight") game.right = false;
});
["left", "right"].forEach((direction) => {
  const button = $(`#game-${direction}`);
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (!game.running || game.paused) return;
    game[direction] = true;
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener("pointerup", () => {
    game[direction] = false;
  });
  button.addEventListener("pointercancel", () => {
    game[direction] = false;
  });
  button.addEventListener("lostpointercapture", () => {
    game[direction] = false;
  });
  button.addEventListener("click", (event) => {
    if (event.detail === 0 && game.running && !game.paused)
      game.x = Math.max(
        0,
        Math.min(588, game.x + (direction === "left" ? -35 : 35)),
      );
  });
});
const gameObserver = new IntersectionObserver(
  (entries) => {
    if (!entries[0].isIntersecting) pauseGame();
  },
  { threshold: 0.15 },
);
gameObserver.observe($(".arcade"));
window.addEventListener("blur", () => {
  pauseGame();
  drawing = false;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pauseGame();
    pauseAnimation();
  }
});
drawGame();

// ===== Team: spirit-animal encounter =====
// Clicking a player card flashes the screen, wipes to black, and opens a small
// catch-only encounter with that founder's spirit animal, ending in a PXL Dex entry.
const spirits = {
  lan: {
    no: "001",
    name: "LAN",
    full: "LAN ANGELES",
    role: "MAIN ARTIST",
    trainer: "assets/team/lan-angeles-sprite.png",
    animal: "HEDGEHOG",
    img: "assets/team/hedgehog.png",
    kind: "The Tiny Sharpshooter",
    types: ["ART", "SPIKY"],
    intro: "A wild HEDGEHOG rolled out of the grass!",
    entry:
      "Small but never soft. It carries thousands of fine spines, each one placed just right, and curls into a perfect ball when it needs to focus.",
    why: "Lan draws the same way: thousands of tiny pixels, each one placed just right. Lan’s art is where PXL’s little squares turn into big personality.",
  },
  jonrey: {
    no: "002",
    name: "JONREY",
    full: "ALJON REY APAN",
    role: "CAPTION WRITER",
    trainer: "assets/team/jonrey-apan-sprite.png",
    animal: "PLATYPUS",
    img: "assets/team/platypus.png",
    kind: "The Original",
    types: ["WORDS", "ONE-OF-A-KIND"],
    intro: "A wild PLATYPUS waddled into view!",
    entry:
      "One of nature’s most original designs. It mixes parts nobody thought belonged together, and somehow every piece works.",
    why: "Jonrey writes the same way: mixing gamer slang, old-school nostalgia, and a little wordplay into captions like “Pix L’s into W’s” that could only come from PXL.",
  },
  alric: {
    no: "003",
    name: "ALRIC",
    full: "ALRIC MACALINAO",
    role: "ART DIRECTOR",
    trainer: "assets/team/alric-macalinao-sprite.png",
    animal: "SNAKE",
    img: "assets/team/snake.png",
    kind: "The Sharp Eye",
    types: ["ART", "FOCUS"],
    intro: "A wild SNAKE slithered out!",
    entry:
      "It moves quietly, senses every vibration around it, and strikes at exactly the right moment.",
    why: "Alric watches everything before making a move, then lands the right visual at the right moment. Every piece of PXL art gets that same patient, precise focus.",
  },
  jan: {
    no: "004",
    name: "JAN",
    full: "JAN FORTUN SAPIN",
    role: "WEB DEVELOPER",
    trainer: "assets/team/jan-sapin-sprite.png",
    animal: "CHAMELEON",
    img: "assets/team/chameleon.png",
    kind: "The Shape-Shifter",
    types: ["CODE", "ADAPT"],
    intro: "A wild CHAMELEON blinked into view!",
    entry:
      "It shifts its colors to fit any surroundings and can watch two directions at once, each eye moving on its own.",
    why: "Jan keeps one eye on design and the other on code, adapting PXL to fit every screen, from phones to big desktops.",
  },
};

const battle = $("#battle");
const battleScreen = $("#battle-screen");
const battleMsg = $("#battle-msg");
const battleMenu = $("#battle-menu");
const battleFoe = $("#battle-foe");
const battleCube = $("#pxl-cube");
const battleDex = $("#battle-dex");
let battleRun = 0;
let battleTrigger;
let advanceResolve = null;
let menuResolve = null;
let typing = false;
let skipTyping = false;
battleScreen.tabIndex = -1;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function guard(run) {
  if (run !== battleRun) throw new Error("battle-abort");
}
function play(element, frames, options) {
  return element
    .animate(frames, {
      fill: "both",
      ...options,
      duration: motionOff ? 1 : options.duration,
      delay: motionOff ? 0 : options.delay || 0,
    })
    .finished.catch(() => {});
}
function chime(notes) {
  notes.forEach(([frequency, at, length = 0.09]) =>
    setTimeout(() => tone(frequency, length), at),
  );
}

async function say(text, run, waitForInput = true) {
  battleMsg.textContent = "";
  typing = true;
  skipTyping = false;
  for (let i = 0; i < text.length; i++) {
    guard(run);
    if (skipTyping || motionOff) break;
    battleMsg.textContent += text[i];
    if (i % 3 === 0) tone(880, 0.015);
    await sleep(24);
  }
  battleMsg.textContent = text;
  typing = false;
  guard(run);
  if (!waitForInput) return;
  $("#battle-advance").classList.add("show");
  await new Promise((resolve) => (advanceResolve = resolve));
  advanceResolve = null;
  $("#battle-advance").classList.remove("show");
  tone(520, 0.04);
  guard(run);
}
function advanceBattle() {
  if (typing) skipTyping = true;
  else advanceResolve?.();
}

function chooseAction(spirit, run) {
  guard(run);
  battleMsg.textContent = `What will ${spirit.name} do?`;
  battleMenu.hidden = false;
  $("#battle-catch").focus();
  return new Promise((resolve) => (menuResolve = resolve));
}

function resetBattle() {
  $$("*", battle).forEach((element) =>
    element.getAnimations().forEach((animation) => animation.cancel()),
  );
  battle.classList.remove("in-battle");
  battleFoe.style.filter = "";
  battleMenu.hidden = true;
  battleDex.hidden = true;
  battleScreen.classList.remove("show-dex");
  $("#dex-wipe").replaceChildren();
  battleMsg.textContent = "";
  $("#battle-advance").classList.remove("show");
  advanceResolve = null;
  menuResolve = null;
  typing = false;
}

async function startEncounter(key, trigger) {
  const spirit = spirits[key];
  if (!spirit) return;
  const run = ++battleRun;
  battleTrigger = trigger;
  resetBattle();

  $("#foe-name").textContent = spirit.animal;
  $("#ally-name").textContent = spirit.name;
  $("#ally-role").textContent = spirit.role;
  $("#battle-trainer").src = spirit.trainer;
  $("#battle-trainer").alt = `${spirit.full} pixel sprite`;
  battleFoe.src = spirit.img;
  battleFoe.alt = `${spirit.animal}, spirit animal of ${spirit.full}`;

  pauseGame();
  pauseAnimation();
  battle.showModal();
  document.body.classList.add("modal-open");
  battleScreen.focus();

  try {
    if (!motionOff) {
      // 1. Encounter flash.
      chime([
        [196, 0],
        [247, 120],
        [196, 240],
        [247, 360],
      ]);
      await play(
        $(".battle-flash"),
        [
          { opacity: 0 },
          { opacity: 0.95 },
          { opacity: 0 },
          { opacity: 0.95 },
          { opacity: 0 },
          { opacity: 0.95 },
          { opacity: 0 },
        ],
        { duration: 620, easing: "linear" },
      );
      guard(run);
      // 2. Bars slide in from alternating sides until the screen is black.
      await Promise.all(
        $$(".battle-wipe i").map((bar, index) =>
          play(
            bar,
            [
              {
                transform:
                  index % 2 ? "translateX(101%)" : "translateX(-101%)",
              },
              { transform: "translateX(0)" },
            ],
            { duration: 380, delay: index * 45, easing: "steps(8, end)" },
          ),
        ),
      );
      guard(run);
      await sleep(140);
      guard(run);
    }

    // 3. Cut to the field: each platform glides in from its own edge of the
    // screen (measured in px so it always starts fully off-screen), the HP
    // boxes are already in place, and the spirit animal arrives as a
    // silhouette before lighting up.
    battleFoe.style.filter = "brightness(0)";
    const foeSide = $(".foe-side");
    const allySide = $(".ally-side");
    const foeFrom = innerWidth - foeSide.getBoundingClientRect().left + 24;
    const allyFrom = -(allySide.getBoundingClientRect().right + 24);
    const glide = { duration: 950, easing: "cubic-bezier(.22,.8,.3,1)" };
    const slideIn = Promise.all([
      play(
        foeSide,
        [
          { transform: `translateX(${foeFrom}px)` },
          { transform: "translateX(0)" },
        ],
        glide,
      ),
      play(
        allySide,
        [
          { transform: `translateX(${allyFrom}px)` },
          { transform: "translateX(0)" },
        ],
        glide,
      ),
    ]);
    $$(".battle-wipe i").forEach((bar) =>
      bar.getAnimations().forEach((animation) => animation.cancel()),
    );
    battle.classList.add("in-battle");
    await slideIn;
    guard(run);

    battleFoe.style.filter = "";
    chime([
      [523, 0, 0.12],
      [392, 110, 0.12],
      [659, 230, 0.18],
    ]);
    await play(
      battleFoe,
      [
        { filter: "brightness(0)" },
        { filter: "brightness(2.2)", offset: 0.55 },
        { filter: "brightness(1)" },
      ],
      { duration: 520 },
    );
    guard(run);

    await say(spirit.intro, run);
    await say(`Go for the W, ${spirit.name}!`, run);

    // 4. Catch-only menu. RUN never works.
    for (;;) {
      const choice = await chooseAction(spirit, run);
      guard(run);
      battleMenu.hidden = true;
      battleScreen.focus();
      if (choice === "catch") break;
      await say(`${spirit.name} tried to run away...`, run);
      tone(150, 0.2);
      await say(
        `You can’t run! This ${spirit.animal} has already chosen ${spirit.name}.`,
        run,
      );
    }

    await catchSpirit(spirit, run);
  } catch (error) {
    if (error.message !== "battle-abort") throw error;
  }
}

async function catchSpirit(spirit, run) {
  await say(`${spirit.name} threw a PXL CUBE!`, run, false);
  const field = $(".battle-stage").getBoundingClientRect();
  const trainer = $("#battle-trainer").getBoundingClientRect();
  const foe = battleFoe.getBoundingClientRect();
  const platform = $(".foe-side .battle-platform").getBoundingClientRect();
  const size = battleCube.getBoundingClientRect().width;
  const startX = trainer.right - field.left - size;
  const startY = trainer.top - field.top + trainer.height * 0.25;
  const hitX = foe.left - field.left + foe.width / 2 - size / 2;
  const hitY = foe.top - field.top + foe.height * 0.35;
  const restY =
    platform.top - field.top + platform.height * 0.35 - size / 2;
  const at = (x, y, extra = "") => `translate(${x}px, ${y}px) ${extra}`;

  // Arc throw.
  chime([
    [440, 0, 0.05],
    [587, 120, 0.05],
    [740, 240, 0.05],
  ]);
  await play(
    battleCube,
    [
      { opacity: 1, transform: at(startX, startY, "rotate(0deg)") },
      {
        opacity: 1,
        transform: at(
          (startX + hitX) / 2,
          Math.min(startY, hitY) - field.height * 0.28,
          "rotate(360deg)",
        ),
      },
      { opacity: 1, transform: at(hitX, hitY, "rotate(720deg)") },
    ],
    { duration: 700, easing: "linear" },
  );
  guard(run);

  // Spirit is drawn into the cube.
  tone(990, 0.12);
  await play(
    battleFoe,
    [
      { filter: "brightness(1)", transform: "scale(1)", opacity: 1 },
      { filter: "brightness(3)", transform: "scale(1)", opacity: 1, offset: 0.3 },
      { filter: "brightness(3)", transform: "scale(0)", opacity: 0 },
    ],
    { duration: 420, easing: "ease-in" },
  );
  guard(run);

  // Cube drops onto the platform with a little bounce.
  await play(
    battleCube,
    [
      { opacity: 1, transform: at(hitX, hitY) },
      { opacity: 1, transform: at(hitX, restY), offset: 0.6 },
      { opacity: 1, transform: at(hitX, restY - size * 0.6), offset: 0.8 },
      { opacity: 1, transform: at(hitX, restY) },
    ],
    { duration: 420, easing: "ease-in" },
  );
  guard(run);

  // Three wobbles.
  for (let i = 0; i < 3; i++) {
    await sleep(motionOff ? 0 : 420);
    guard(run);
    tone(330, 0.06);
    await play(
      battleCube,
      [
        { opacity: 1, transform: at(hitX, restY, "rotate(0deg)") },
        { opacity: 1, transform: at(hitX, restY, "rotate(-24deg)") },
        { opacity: 1, transform: at(hitX, restY, "rotate(20deg)") },
        { opacity: 1, transform: at(hitX, restY, "rotate(0deg)") },
      ],
      { duration: 420, easing: "steps(4, end)" },
    );
    guard(run);
  }
  await sleep(motionOff ? 0 : 380);
  guard(run);

  // Click! Sparkles burst out of the cube.
  const stars = $("#catch-stars");
  stars.style.transform = `translate(${hitX + size / 2}px, ${restY}px)`;
  const directions = [
    [-1.6, -1.2],
    [0, -1.9],
    [1.6, -1.2],
  ];
  chime([
    [523, 0],
    [659, 110],
    [784, 220],
    [1047, 330, 0.25],
  ]);
  await Promise.all(
    $$("i", stars).map((star, index) =>
      play(
        star,
        [
          { opacity: 1, transform: "translate(-50%, -50%) scale(.6)" },
          {
            opacity: 0,
            transform: `translate(calc(-50% + ${directions[index][0] * size}px), calc(-50% + ${directions[index][1] * size}px)) scale(1.2)`,
          },
        ],
        { duration: 650, easing: "ease-out" },
      ),
    ),
  );
  guard(run);

  await say(`Caught! ${spirit.animal} joined ${spirit.name}’s team!`, run);
  await say(`${spirit.animal}’s data was added to the PXL DEX.`, run);
  await revealDex(spirit, run);
}

function fillDex(spirit) {
  $("#dex-no").textContent = `No. ${spirit.no}`;
  $("#dex-art-no").textContent = spirit.no;
  $("#dex-name").textContent = spirit.animal;
  $("#dex-kind").textContent = spirit.kind;
  $("#dex-owner").textContent = spirit.full;
  $("#dex-img").src = spirit.img;
  $("#dex-img").alt = spirit.animal;
  $("#dex-types").replaceChildren(
    ...spirit.types.map((type) => {
      const tag = document.createElement("span");
      tag.textContent = type;
      return tag;
    }),
  );
  $("#dex-entry").textContent = spirit.entry;
  $("#dex-why").textContent = spirit.why;
}

// Catch -> dex: the cube charges up, a ripple of pixel tiles spreads from it
// until the screen is covered, then the tiles clear from the center outward
// to reveal the full-screen dex while its pieces arrive one by one.
async function revealDex(spirit, run) {
  guard(run);
  fillDex(spirit);
  const wipe = $("#dex-wipe");
  const cube = battleCube.getBoundingClientRect();
  const originX = cube.left + cube.width / 2;
  const originY = cube.top + cube.height / 2;
  const distance = (tile, x, y) =>
    Math.hypot(tile.dataset.x - x, tile.dataset.y - y);
  let tiles = [];

  if (!motionOff) {
    chime([
      [392, 0, 0.08],
      [523, 140, 0.08],
      [659, 280, 0.08],
      [784, 420, 0.12],
    ]);
    await play(
      battleCube,
      [
        { filter: "brightness(1) drop-shadow(0 0 0 #fff)" },
        { filter: "brightness(1.8) drop-shadow(0 0 6px #fff)", offset: 0.5 },
        { filter: "brightness(3) drop-shadow(0 0 18px #ffb65d)" },
      ],
      { duration: 560, easing: "ease-in" },
    );
    guard(run);

    const size = innerWidth < 700 ? 34 : 54;
    const cols = Math.ceil(innerWidth / size);
    const rows = Math.ceil(innerHeight / size);
    wipe.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    wipe.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    tiles = Array.from({ length: cols * rows }, (_, index) => {
      const tile = document.createElement("i");
      tile.dataset.x = (index % cols) * size + size / 2;
      tile.dataset.y = Math.floor(index / cols) * size + size / 2;
      return tile;
    });
    wipe.replaceChildren(...tiles);
    const maxOut = Math.max(...tiles.map((t) => distance(t, originX, originY)));

    // Ripple out from the cube until the screen is covered.
    await Promise.all(
      tiles.map((tile) =>
        play(
          tile,
          [
            { transform: "scale(0)", backgroundColor: "#ffb65d" },
            {
              transform: "scale(1.06)",
              backgroundColor: "#be3621",
              offset: 0.55,
            },
            { transform: "scale(1.06)", backgroundColor: "#001768" },
          ],
          {
            duration: 380,
            delay: (distance(tile, originX, originY) / maxOut) * 560,
            easing: "cubic-bezier(.3,.7,.4,1)",
          },
        ),
      ),
    );
    guard(run);
    await sleep(120);
    guard(run);
  }

  // Swap the battle for the dex while the screen is covered.
  battleScreen.classList.add("show-dex");
  battleDex.hidden = false;
  achieve("spirit");
  battle.scrollTop = 0;

  const ease = "cubic-bezier(.2,.8,.2,1)";
  $$(".dex-in", battleDex).forEach((piece, index) => {
    if (piece.classList.contains("dex-art")) return;
    play(
      piece,
      [
        { opacity: 0, transform: "translateY(28px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 560, delay: 320 + index * 85, easing: ease },
    );
  });
  play(
    $(".dex-art", battleDex),
    [
      { opacity: 0, transform: "scale(.55) rotate(-6deg)" },
      { opacity: 1, transform: "scale(1.05) rotate(1deg)", offset: 0.7 },
      { opacity: 1, transform: "scale(1) rotate(0deg)" },
    ],
    { duration: 700, delay: 240, easing: ease },
  );
  play(
    $(".dex-scan", battleDex),
    [
      { opacity: 1, transform: "translateY(-100%)" },
      { opacity: 1, transform: "translateY(720%)", offset: 0.92 },
      { opacity: 0, transform: "translateY(720%)" },
    ],
    { duration: 1000, delay: 520, easing: "linear" },
  );
  play(
    $("#dex-img"),
    [
      { filter: "brightness(0)" },
      { filter: "brightness(0)", offset: 0.55 },
      { filter: "brightness(2.6)", offset: 0.72 },
      { filter: "brightness(1)" },
    ],
    { duration: 1500, delay: 300, easing: "linear" },
  );
  setTimeout(
    () => {
      if (run === battleRun)
        chime([
          [523, 0, 0.1],
          [784, 120, 0.1],
          [1047, 240, 0.3],
        ]);
    },
    motionOff ? 0 : 1250,
  );

  if (tiles.length) {
    // Clear from the center outward.
    const cx = innerWidth / 2;
    const cy = innerHeight / 2;
    const maxIn = Math.max(...tiles.map((t) => distance(t, cx, cy)));
    await Promise.all(
      tiles.map((tile) =>
        play(
          tile,
          [
            { transform: "scale(1.06)", backgroundColor: "#001768" },
            { transform: "scale(0)", backgroundColor: "#ffb65d" },
          ],
          {
            duration: 420,
            delay: (distance(tile, cx, cy) / maxIn) * 560,
            easing: "cubic-bezier(.6,0,.8,.4)",
          },
        ),
      ),
    );
    wipe.replaceChildren();
  }
  guard(run);
  $("#dex-close").focus({ preventScroll: true });
}

function closeBattle() {
  battleRun++;
  if (battle.open) battle.close();
}

$$("[data-battle]").forEach((button) =>
  button.addEventListener("click", () =>
    startEncounter(button.dataset.battle, button),
  ),
);
$("#battle-catch").addEventListener("click", () => menuResolve?.("catch"));
$("#battle-run").addEventListener("click", () => menuResolve?.("run"));
$("#battle-exit").addEventListener("click", closeBattle);
$("#dex-close").addEventListener("click", closeBattle);
battleScreen.addEventListener("click", (event) => {
  if (event.target.closest("button, .dex")) return;
  advanceBattle();
});
battle.addEventListener("keydown", (event) => {
  if (
    (event.key === "Enter" || event.key === " ") &&
    !event.target.closest("button")
  ) {
    event.preventDefault();
    advanceBattle();
  }
  if (
    !battleMenu.hidden &&
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
  ) {
    event.preventDefault();
    const options = [$("#battle-catch"), $("#battle-run")];
    const index = options.indexOf(document.activeElement);
    options[(index + 1) % options.length].focus();
    tone(700, 0.03);
  }
});
battle.addEventListener("close", () => {
  battleRun++;
  resetBattle();
  document.body.classList.remove("modal-open");
  battleTrigger?.focus();
});
// Missing art (e.g. snake.png not added yet) should never break the encounter.
[battleFoe, $("#dex-img")].forEach((image) =>
  image.addEventListener("error", () => {
    if (image.getAttribute("src")) image.style.visibility = "hidden";
  }),
);
[battleFoe, $("#dex-img")].forEach((image) =>
  image.addEventListener("load", () => (image.style.visibility = "")),
);

// ===== PXL game layer (pass 1) =====
// The site plays like a level: boot screen -> title screen -> World 1-1 where
// the robot runs, hits ? blocks and unlocks our Mission / Vision / Values.
// Scrolling stays native (Lenis only smooths it); only sprites and decoration
// move with scroll, text never does. Motion off reverts everything.
const PIXEL_TOTAL = 9;
let pixelCount = 0;
function addPixels(amount = 1) {
  pixelCount = Math.min(PIXEL_TOTAL, pixelCount + amount);
  const hud = $("#hud-coins");
  if (!hud) return;
  hud.querySelector("b").textContent = String(pixelCount).padStart(2, "0");
  hud.classList.remove("bump");
  void hud.offsetWidth;
  hud.classList.add("bump");
  if (pixelCount === PIXEL_TOTAL) {
    toast("All pixels collected. That’s a W!");
    achieve("perfect");
  }
}

const pxlGame = (() => {
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  const root = document.documentElement;
  let lenis = null;
  let ctx = null;
  $("#hud-total").textContent = String(PIXEL_TOTAL).padStart(2, "0");
  $$("dialog").forEach((dialogElement) =>
    dialogElement.setAttribute("data-lenis-prevent", ""),
  );
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  // ---- Smooth scroll (Lenis) kept in sync with ScrollTrigger ----
  const lenisRaf = (time) => lenis?.raf(time * 1000);
  function startLenis() {
    if (lenis || motionOff || !hasGsap || !window.Lenis) return;
    lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(lenisRaf);
    gsap.ticker.lagSmoothing(0);
    if (document.body.classList.contains("modal-open") || root.classList.contains("booting"))
      lenis.stop();
  }
  function stopLenis() {
    if (!lenis) return;
    gsap.ticker.remove(lenisRaf);
    lenis.destroy();
    lenis = null;
  }
  // Pause smooth scroll while any dialog is open.
  new MutationObserver(() => {
    if (!lenis) return;
    if (document.body.classList.contains("modal-open")) lenis.stop();
    else if (!root.classList.contains("booting")) lenis.start();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  // In-page links glide with Lenis instead of jumping.
  document.addEventListener("click", (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || !lenis) return;
    const hash = link.getAttribute("href");
    const target = hash.length > 1 && document.querySelector(hash);
    if (!target) return;
    event.preventDefault();
    lenis.scrollTo(target, { offset: hash === "#home" ? 0 : -84, duration: 1.4 });
  });

  // ---- Title letters (screen readers get the h1's aria-label) ----
  const title = $("#hero-heading");
  title.setAttribute("aria-label", title.textContent.replace(/\s+/g, " ").trim());
  (function split(node) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const fragment = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            fragment.append(document.createTextNode(" "));
            return;
          }
          const word = document.createElement("span");
          word.className = "hero-word";
          word.setAttribute("aria-hidden", "true");
          [...part].forEach((char) => {
            const letter = document.createElement("span");
            letter.className = "hero-letter";
            letter.textContent = char;
            word.append(letter);
          });
          fragment.append(word);
        });
        child.replaceWith(fragment);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== "BR") {
        split(child);
      }
    });
  })(title);

  function introHero() {
    if (!hasGsap || motionOff) return;
    const timeline = gsap.timeline();
    timeline
      .from(".hero-letter", {
        yPercent: -140,
        opacity: 0,
        duration: 0.42,
        ease: "steps(4)",
        stagger: 0.03,
      })
      .from(
        ".hero-copy .eyebrow, .hero-description, .hero-copy .button",
        { y: 18, opacity: 0, duration: 0.5, ease: "power3.out", stagger: 0.08 },
        "-=0.3",
      )
      .from(
        "#hero-bot img",
        { y: -innerHeight, duration: 0.9, ease: "bounce.out" },
        "-=0.6",
      )
      .from(".hero-bottom", { opacity: 0, duration: 0.4 }, "-=0.3");
    setTimeout(() => tone(330, 0.06), 900);
  }

  // ---- Boot screen: INSERT COIN -> loading -> PRESS START ----
  function runBoot() {
    const boot = $("#boot");
    let seen = false;
    try {
      seen = sessionStorage.getItem("pxl-booted") === "1";
    } catch {}
    if (seen || motionOff || !hasGsap) {
      boot.remove();
      introHero();
      return;
    }
    boot.hidden = false;
    boot.setAttribute("aria-live", "off");
    root.classList.add("booting");
    lenis?.stop();
    const cells = $$(".boot-bar i", boot);
    const images = [...document.images].filter((image) => image.loading !== "lazy");
    const started = performance.now();
    let done = false;
    let exited = false;

    function tick() {
      if (done) return;
      const loaded = images.length
        ? images.filter((image) => image.complete).length / images.length
        : 1;
      const timed = Math.min(1, (performance.now() - started) / 1600);
      const forced = performance.now() - started > 4500;
      const pct = forced ? 100 : Math.floor(Math.min(loaded, timed) * 100);
      $("#boot-pct").textContent = `${String(pct).padStart(3, "0")}%`;
      cells.forEach((cell, index) => cell.classList.toggle("on", index < Math.floor(pct / 10)));
      if (pct >= 100) ready();
      else requestAnimationFrame(tick);
    }
    function ready() {
      done = true;
      $("#boot-label").textContent = "WORLD 1-1 READY";
      boot.setAttribute("aria-live", "polite");
      const start = $("#boot-start");
      start.hidden = false;
      start.focus({ preventScroll: true });
      chime([
        [523, 0, 0.08],
        [659, 100, 0.08],
        [784, 200, 0.14],
      ]);
      setTimeout(exit, 1500);
      ["click", "keydown", "wheel", "touchstart"].forEach((type) =>
        boot.addEventListener(type, exit, { once: true, passive: true }),
      );
      addEventListener("keydown", exit, { once: true });
    }
    function exit() {
      if (exited || !done) return;
      exited = true;
      try {
        sessionStorage.setItem("pxl-booted", "1");
      } catch {}
      tone(880, 0.08);
      gsap
        .timeline({
          onComplete() {
            boot.remove();
            root.classList.remove("booting");
            lenis?.start();
            ScrollTrigger.refresh();
          },
        })
        .to(".boot-inner", { scale: 1.15, opacity: 0, duration: 0.3, ease: "power2.in" })
        .to(
          ".boot-cols i",
          {
            yPercent: -101,
            duration: 0.5,
            ease: "steps(6)",
            stagger: { each: 0.035, from: "center" },
          },
          "-=0.05",
        )
        .add(introHero, "-=0.35");
    }
    requestAnimationFrame(tick);
  }

  // ---- Dialogue box types its line when it scrolls into view ----
  $$("[data-dialogue] .dialogue-text").forEach((line) => {
    const text = line.textContent.replace(/\s+/g, " ").trim();
    line.textContent = "";
    const sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = text;
    const visual = document.createElement("span");
    visual.setAttribute("aria-hidden", "true");
    [...text].forEach((char) => {
      const ch = document.createElement("span");
      ch.className = "ch";
      ch.textContent = char;
      visual.append(ch);
    });
    line.append(sr, visual);
    let typed = false;
    new IntersectionObserver(
      (entries, observer) => {
        if (!entries[0].isIntersecting || typed) return;
        typed = true;
        observer.disconnect();
        const chars = $$(".ch", visual);
        if (motionOff) {
          chars.forEach((ch) => ch.classList.add("on"));
          line.closest(".dialogue").classList.add("done");
          return;
        }
        chars.forEach((ch, index) =>
          setTimeout(() => {
            ch.classList.add("on");
            if (index % 3 === 0) tone(880, 0.012);
            if (index === chars.length - 1)
              line.closest(".dialogue").classList.add("done");
          }, 200 + index * 32),
        );
      },
      { threshold: 0.6 },
    ).observe(line);
  });

  // ---- World 1-1: the robot runs, jumps into ? blocks, unlocks power-ups ----
  const stage = $(".run-stage");
  const runner = $(".runner");
  const boxes = $$(".item-box");
  const coins = $$(".run-coin");
  const cards = $$(".power-card");
  const unlocked = boxes.map(() => false);

  function unlock(index) {
    if (unlocked[index]) return;
    unlocked[index] = true;
    const box = boxes[index];
    const card = cards[index];
    box.classList.add("used");
    card.classList.add("unlocked");
    addPixels(1);
    if (unlocked.every(Boolean)) achieve("powered");
    chime([
      [988, 0, 0.05],
      [1319, 70, 0.12],
    ]);
    if (!hasGsap || motionOff) return;
    gsap.fromTo(box, { y: 0 }, { y: -16, duration: 0.1, yoyo: true, repeat: 1, ease: "steps(2)" });
    gsap.fromTo(
      coins[index],
      { y: 0, opacity: 1, scale: 1 },
      { y: -90, opacity: 0, scale: 1.4, duration: 0.7, ease: "power2.out" },
    );
    gsap.to(card.querySelector(".power-lock"), {
      scale: 0,
      rotate: 90,
      opacity: 0,
      duration: 0.35,
      ease: "back.in(2)",
    });
    gsap.from(card.querySelectorAll(".tiny-label, h4, p, li"), {
      y: 18,
      opacity: 0,
      duration: 0.5,
      ease: "power3.out",
      stagger: 0.05,
      delay: 0.15,
    });
  }

  function buildRun() {
    const run = { p: 0 };
    let width = 0;
    let runnerWidth = 0;
    let jump = 0;
    let boxCenters = [];
    let lastX = 0;
    let facing = 1;
    let idleTimer;
    function measure() {
      width = stage.clientWidth;
      runnerWidth = runner.offsetWidth;
      boxCenters = boxes.map((box) => box.offsetLeft + box.offsetWidth / 2);
      const ground = $(".run-ground", stage).offsetHeight;
      const boxBottom = stage.clientHeight - (boxes[0].offsetTop + boxes[0].offsetHeight);
      jump = Math.max(40, boxBottom - ground - runner.offsetHeight + 6);
    }
    function render() {
      const x = run.p * (width - runnerWidth);
      const center = x + runnerWidth / 2;
      const reach = Math.max(70, width * 0.07);
      let y = 0;
      boxCenters.forEach((boxX) => {
        const distance = Math.abs(center - boxX);
        if (distance < reach) y = Math.min(y, -(1 - (distance / reach) ** 2) * jump);
      });
      if (Math.abs(x - lastX) > 0.4) {
        facing = x > lastX ? 1 : -1;
        runner.classList.add("running");
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => runner.classList.remove("running"), 140);
      }
      lastX = x;
      gsap.set(runner, { x, y, scaleX: facing });
      boxCenters.forEach((boxX, index) => {
        if (center >= boxX - 4) unlock(index);
      });
      const cleared = run.p > 0.97;
      if (cleared && !stage.classList.contains("cleared"))
        chime([
          [523, 0, 0.08],
          [659, 110, 0.08],
          [784, 220, 0.08],
          [1047, 330, 0.25],
        ]);
      stage.classList.toggle("cleared", cleared);
    }
    measure();
    gsap.to(run, {
      p: 1,
      ease: "none",
      onUpdate: render,
      scrollTrigger: {
        trigger: ".run-stage",
        start: "top 80%",
        end: "bottom 30%",
        scrub: 0.8,
        onRefresh: () => {
          measure();
          render();
        },
      },
    });
    gsap.to(".run-cloud-a", {
      xPercent: -60,
      ease: "none",
      scrollTrigger: { trigger: ".run-track", start: "top bottom", end: "bottom top", scrub: 1 },
    });
    gsap.to(".run-cloud-b", {
      xPercent: 40,
      ease: "none",
      scrollTrigger: { trigger: ".run-track", start: "top bottom", end: "bottom top", scrub: 1 },
    });
  }

  // ---- Player select: cards at gentle depths, spirit animals deepest ----
  function buildTeamDepth() {
    const travel = innerWidth <= 760 ? 0.5 : 1;
    $$(".player-card").forEach((card, index) =>
      gsap.fromTo(
        card,
        { "--ty": `${(index % 2 ? 60 : 24) * travel}px` },
        {
          "--ty": `${(index % 2 ? -40 : -12) * travel}px`,
          ease: "none",
          scrollTrigger: { trigger: ".team-grid", start: "top bottom", end: "bottom top", scrub: 0.8 },
        },
      ),
    );
    gsap.fromTo(
      ".player-animal",
      { "--ay": `${40 * travel}px` },
      {
        "--ay": `${-50 * travel}px`,
        ease: "none",
        scrollTrigger: { trigger: ".team-grid", start: "top bottom", end: "bottom top", scrub: 1 },
      },
    );
  }

  // ---- World map: highlight the world you are in ----
  const mapLinks = $$(".world-map a");
  const worldObserver = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        mapLinks.forEach((link) => {
          const active = link.dataset.world === entry.target.id;
          link.classList.toggle("active", active);
          if (active) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      }),
    { rootMargin: "-45% 0px -50% 0px" },
  );
  mapLinks.forEach((link) => {
    const target = document.getElementById(link.dataset.world);
    if (target) worldObserver.observe(target);
  });

  // ---- On / off with the Motion toggle ----
  function enable() {
    if (!hasGsap || motionOff || ctx) return;
    root.classList.add("game-on");
    startLenis();
    ctx = gsap.context(() => {
      buildRun();
      buildTeamDepth();
    });
    ScrollTrigger.refresh();
  }
  function disable() {
    root.classList.remove("game-on");
    stopLenis();
    ctx?.revert();
    ctx = null;
    boxes.forEach((_, index) => {
      boxes[index].classList.add("used");
      cards[index].classList.add("unlocked");
    });
  }
  function sync() {
    if (motionOff) disable();
    else enable();
  }
  $("#motion-toggle").addEventListener("click", sync);
  mediaMotion.addEventListener("change", sync);
  addEventListener("load", () => hasGsap && ScrollTrigger.refresh());

  sync();
  runBoot();
  return {
    sync,
    scrollTo(target, offset = -84) {
      if (lenis) lenis.scrollTo(target, { offset, duration: 0.9 });
      else
        scrollTo({
          top: target.getBoundingClientRect().top + scrollY + offset,
          behavior: motionOff ? "auto" : "smooth",
        });
    },
  };
})();

// ===== PXL game layer (pass 2): worlds 1-2 to 1-5 + bonus stage =====
// Signature move: images resolve from giant pixels into the real artwork,
// like a sprite loading in. Everything else is one-shot (plays once when a
// world comes into view) or scrubbed decoration; text never moves on scroll.
const pxlWorlds = (() => {
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  const root = document.documentElement;
  const gameOn = () => root.classList.contains("game-on");
  let ctx = null;

  // ---- "NOW ENTERING" world banner (once per world) ----
  const worldNames = {
    story: "WORLD 1-1 · THE ORIGIN",
    players: "WORLD 1-2 · THE PLAYERS",
    universe: "WORLD 1-3 · THE UNIVERSE",
    shop: "ITEM SHOP",
    rivals: "BOSS RUSH",
    bonus: "BONUS STAGE",
    identity: "WORLD 1-4 · THE IDENTITY",
    campaigns: "WORLD 1-5 · THE FEED",
    team: "PLAYER SELECT",
    end: "THE END",
  };
  const banner = $("#world-banner");
  const seenWorlds = new Set();
  let bannerTimeline;
  function showBanner(id) {
    if (!hasGsap || !gameOn() || root.classList.contains("booting")) return;
    if (seenWorlds.has(id)) return;
    seenWorlds.add(id);
    if (seenWorlds.size === Object.keys(worldNames).length) achieve("traveler");
    $("#world-banner-name").textContent = worldNames[id];
    bannerTimeline?.kill();
    tone(660, 0.05);
    setTimeout(() => tone(990, 0.07), 90);
    bannerTimeline = gsap
      .timeline()
      .fromTo(
        banner,
        { yPercent: -180, opacity: 1 },
        { yPercent: 0, duration: 0.42, ease: "steps(5)" },
      )
      .to(banner, { yPercent: -180, duration: 0.3, ease: "power2.in", delay: 1.5 })
      .set(banner, { opacity: 0 });
  }
  const bannerObserver = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => entry.isIntersecting && showBanner(entry.target.id)),
    { rootMargin: "-40% 0px -55% 0px" },
  );
  Object.keys(worldNames).forEach((id) => {
    const target = document.getElementById(id);
    if (target) bannerObserver.observe(target);
  });

  // ---- Pixel resolve: big pixels -> sharp artwork ----
  function pixelReveal(img, onDone) {
    if (img.dataset.revealing) return;
    img.dataset.revealing = "1";
    const start = () => {
      const parent = img.parentElement;
      if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
      const width = img.offsetWidth;
      const height = img.offsetHeight;
      if (!width || !height || !img.naturalWidth) {
        img.classList.add("revealed");
        onDone?.();
        return;
      }
      const dpr = Math.min(2, devicePixelRatio || 1);
      const canvas = document.createElement("canvas");
      canvas.className = "pxl-canvas";
      canvas.setAttribute("aria-hidden", "true");
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      Object.assign(canvas.style, {
        left: `${img.offsetLeft}px`,
        top: `${img.offsetTop}px`,
        width: `${width}px`,
        height: `${height}px`,
      });
      parent.append(canvas);
      // Match object-fit: contain.
      const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const drawX = (width - drawW) / 2;
      const drawY = (height - drawH) / 2;
      const context = canvas.getContext("2d");
      const small = document.createElement("canvas");
      const smallContext = small.getContext("2d");
      const steps = [64, 40, 26, 16, 10, 6, 3];
      let index = 0;
      const frame = () => {
        const size = steps[index];
        const smallW = Math.max(1, Math.round(drawW / size));
        const smallH = Math.max(1, Math.round(drawH / size));
        small.width = smallW;
        small.height = smallH;
        smallContext.drawImage(img, 0, 0, smallW, smallH);
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(
          small,
          0,
          0,
          smallW,
          smallH,
          drawX * dpr,
          drawY * dpr,
          drawW * dpr,
          drawH * dpr,
        );
        tone(300 + index * 90, 0.03);
        index += 1;
        if (index < steps.length) setTimeout(frame, 90);
        else
          setTimeout(() => {
            img.classList.add("revealed");
            canvas.remove();
            onDone?.();
          }, 90);
      };
      frame();
    };
    if (img.complete && img.naturalWidth) start();
    else {
      img.addEventListener("load", start, { once: true });
      img.addEventListener(
        "error",
        () => {
          img.classList.add("revealed");
        },
        { once: true },
      );
    }
  }
  function showAchievement(img) {
    const badge = img.closest(".asset-button")?.querySelector(".achievement");
    if (!badge) return;
    badge.classList.add("show");
    chime([
      [784, 0, 0.07],
      [1047, 90, 0.07],
      [1319, 180, 0.16],
    ]);
    if (hasGsap)
      gsap.fromTo(
        badge,
        { y: -24, opacity: 0, scale: 0.8 },
        { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)", clearProps: "transform" },
      );
  }
  const revealObserver = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting || !gameOn()) return;
        revealObserver.unobserve(entry.target);
        pixelReveal(entry.target, () => showAchievement(entry.target));
      }),
    { threshold: 0.35 },
  );
  const revealImages = $$("img[data-pxl-reveal]");

  // ---- Bonus coins (work with or without motion) ----
  $$(".bonus-coin").forEach((coin) =>
    coin.addEventListener("click", () => {
      if (coin.classList.contains("collected")) return;
      coin.classList.add("collected");
      coin.disabled = true;
      addPixels(1);
      chime([
        [988, 0, 0.05],
        [1319, 70, 0.1],
      ]);
      const left = $$(".bonus-coin:not(.collected)").length;
      toast(left ? `Bonus pixel! ${left} left in this stage.` : "Bonus stage cleared!");
      if (!left) achieve("bonus");
      if (hasGsap && !motionOff)
        gsap.to(coin, { y: -60, scale: 1.8, opacity: 0, duration: 0.5, ease: "power2.out" });
    }),
  );

  // ---- Universe: stepped pixel wipe whenever a product panel opens ----
  const panelObserver = new MutationObserver((mutations) =>
    mutations.forEach((mutation) => {
      const panel = mutation.target;
      if (panel.hidden || !gameOn() || !hasGsap) return;
      gsap.fromTo(
        panel,
        { clipPath: "inset(0 100% 0 0)" },
        { clipPath: "inset(0 0% 0 0)", duration: 0.5, ease: "steps(8)", clearProps: "clipPath" },
      );
      tone(520, 0.05);
    }),
  );
  $$(".product-panel").forEach((panel) =>
    panelObserver.observe(panel, { attributes: true, attributeFilter: ["hidden"] }),
  );

  // ---- Scroll-driven pieces, rebuilt whenever motion turns on ----
  function build() {
    // 1-2: class cards are dealt like a hand of cards; stat bars fill up.
    gsap.from(".class-card", {
      y: 160,
      rotate: (index) => [-12, 7, -5][index] || 0,
      opacity: 0,
      duration: 0.75,
      ease: "back.out(1.5)",
      stagger: 0.14,
      clearProps: "transform,opacity",
      scrollTrigger: { trigger: ".audience-list", start: "top 82%", once: true },
    });
    gsap.from(".class-stats dd", {
      "--fill": 0,
      duration: 0.6,
      ease: "steps(5)",
      stagger: 0.08,
      delay: 0.5,
      scrollTrigger: { trigger: ".audience-list", start: "top 82%", once: true },
    });

    // Bonus: giant marquee rolls with the scroll; the robot rides on top.
    gsap.to(".bonus-track", {
      xPercent: -50,
      ease: "none",
      scrollTrigger: { trigger: "#bonus", start: "top bottom", end: "bottom top", scrub: 0.6 },
    });
    gsap.fromTo(
      ".bonus-rider",
      { x: () => innerWidth * 0.06 },
      {
        x: () => innerWidth * 0.62,
        ease: "none",
        scrollTrigger: { trigger: "#bonus", start: "top bottom", end: "bottom top", scrub: 0.8 },
      },
    );

    // 1-4: logo steps light up in order; swatches drop in like collectibles.
    gsap.from(".logo-process li", {
      opacity: 0.12,
      y: 26,
      duration: 0.5,
      ease: "steps(4)",
      stagger: 0.28,
      clearProps: "transform,opacity",
      scrollTrigger: { trigger: ".logo-process", start: "top 80%", once: true },
    });
    gsap.from(".swatch", {
      yPercent: -130,
      opacity: 0,
      duration: 0.8,
      ease: "bounce.out",
      stagger: 0.14,
      clearProps: "transform,opacity",
      scrollTrigger: { trigger: ".palette", start: "top 82%", once: true },
    });
  }

  function enable() {
    if (!hasGsap || motionOff || ctx) return;
    revealImages
      .filter((img) => !img.classList.contains("revealed"))
      .forEach((img) => revealObserver.observe(img));
    ctx = gsap.context(build);
    ScrollTrigger.refresh();
  }
  function disable() {
    ctx?.revert();
    ctx = null;
    revealImages.forEach((img) => {
      revealObserver.unobserve(img);
      img.classList.add("revealed");
    });
    $$(".pxl-canvas").forEach((canvas) => canvas.remove());
    $$(".achievement").forEach((badge) => badge.classList.add("show"));
  }
  function sync() {
    if (motionOff || !hasGsap) disable();
    else enable();
  }
  $("#motion-toggle").addEventListener("click", sync);
  mediaMotion.addEventListener("change", sync);
  sync();
  return { sync };
})();

// ===== PXL game layer (pass 3): the ending + polish =====
const pxlEnding = (() => {
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  const ending = $(".ending");
  const sky = $(".ending-sky");
  const context = sky.getContext("2d");

  // ---- Final tally ----
  function updateTally() {
    $("#tally-count").textContent =
      `${String(pixelCount).padStart(2, "0")}/${String(PIXEL_TOTAL).padStart(2, "0")}`;
    const left = PIXEL_TOTAL - pixelCount;
    $("#tally-rank").textContent =
      left === 0
        ? "PERFECT RUN! Every pixel found."
        : left <= 3
          ? `Great run. ${left} pixel${left > 1 ? "s" : ""} still hiding.`
          : `${left} pixels still hiding: try the title screen, the ? blocks and the bonus stage.`;
    ending.classList.toggle("perfect", left === 0);
  }
  const hud = $("#hud-coins b");
  new MutationObserver(updateTally).observe(hud, { childList: true, characterData: true, subtree: true });
  updateTally();

  // ---- Live pixel sunset (drawn at 1 canvas px per cell, scaled up crisp) ----
  const hex = (value) => [1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16));
  const palette = [
    "#00104b",
    "#001768",
    "#3d1a5e",
    "#7a2346",
    "#be3621",
    "#e0702f",
    "#ffb65d",
    "#ffd9a3",
    "#fff0d6",
  ].map(hex);
  let cols = 0;
  let rows = 0;
  let image = null;
  let visible = false;
  let lastDraw = 0;
  function resize() {
    const cell = innerWidth <= 760 ? 9 : 13;
    cols = Math.max(1, Math.ceil(sky.offsetWidth / cell));
    rows = Math.max(1, Math.ceil(sky.offsetHeight / cell));
    sky.width = cols;
    sky.height = rows;
    image = context.createImageData(cols, rows);
    draw(performance.now());
  }
  function draw(now) {
    if (!image) return;
    const time = now / 1000;
    const data = image.data;
    const horizon = Math.round(rows * 0.7);
    const sunX = cols * (innerWidth <= 760 ? 0.68 : 0.8);
    const sunR = Math.min(rows * 0.26, cols * 0.2);
    const last = palette.length - 1;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let index;
        if (y < horizon) {
          const t = y / horizon;
          const drift =
            Math.sin((x + time * (4 + (y % 5))) * 0.33 + y * 0.9) * 0.55 +
            Math.sin(x * 0.12 - time * 0.8 + y * 2.3) * 0.45;
          index = t * (last - 1) + drift * (0.4 + t * 0.9);
          // The sun: a peach disc with retro stripes cut into its lower half.
          const dx = x - sunX;
          const dy = y - horizon;
          if (dx * dx + dy * dy < sunR * sunR) {
            const fromHorizon = horizon - y;
            const striped = fromHorizon < sunR * 0.55 && fromHorizon % 3 === 0;
            index = striped ? index : y > horizon - sunR * 0.5 ? 7 : 8 - (fromHorizon / sunR) * 1.5;
          }
        } else {
          // Ground / sea with the sun's reflection breaking into pixels.
          const depth = (y - horizon) / (rows - horizon);
          const shimmer = Math.sin(x * 0.5 + time * 3 + y * 1.7) > 0.55 - depth * 0.6;
          const inBeam = Math.abs(x - sunX) < sunR * (1 - depth * 0.6);
          index = inBeam && shimmer && (y - horizon) % 2 === 0 ? 6 - depth * 3 : depth < 0.08 ? 3 : depth < 0.3 ? 1 : 0;
        }
        const color = palette[Math.max(0, Math.min(last, Math.round(index)))];
        const offset = (y * cols + x) * 4;
        data[offset] = color[0];
        data[offset + 1] = color[1];
        data[offset + 2] = color[2];
        data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
  }
  function loop(now) {
    if (!visible || motionOff) return;
    if (now - lastDraw > 83) {
      lastDraw = now;
      draw(now);
    }
    requestAnimationFrame(loop);
  }
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) {
      if (!image) resize();
      updateTally();
      requestAnimationFrame(loop);
    }
  }).observe(ending);
  addEventListener("resize", () => image && resize());

  // ---- Credits roll in once ----
  let creditsPlayed = false;
  new IntersectionObserver(
    (entries, observer) => {
      if (!entries[0].isIntersecting || creditsPlayed) return;
      creditsPlayed = true;
      observer.disconnect();
      if (!hasGsap || motionOff) return;
      chime([
        [392, 0, 0.1],
        [523, 160, 0.1],
        [659, 320, 0.1],
        [784, 480, 0.12],
        [1047, 640, 0.3],
      ]);
      gsap
        .timeline()
        .from(".ending-kicker, .ending-title", { y: 30, opacity: 0, duration: 0.5, ease: "steps(5)", stagger: 0.12 })
        .from(".credits li", { y: 24, opacity: 0, duration: 0.45, ease: "power3.out", stagger: 0.16 }, "-=0.1")
        .from(".tally, .continue", { y: 20, opacity: 0, duration: 0.45, ease: "back.out(2)", stagger: 0.12, clearProps: "transform,opacity" });
    },
    { threshold: 0.35 },
  ).observe(ending);

  // ---- Easter egg: up up down down left right left right B A ----
  const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let position = 0;
  addEventListener("keydown", (event) => {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    position = key === code[position] ? position + 1 : key === code[0] ? 1 : 0;
    if (position < code.length) return;
    position = 0;
    toast("CHEAT CODE ACCEPTED: XL MODE!");
    achieve("cheat");
    chime([
      [523, 0, 0.06],
      [659, 70, 0.06],
      [784, 140, 0.06],
      [1047, 210, 0.06],
      [1319, 280, 0.2],
    ]);
    if (!hasGsap || motionOff) return;
    const colors = ["#ffb65d", "#be3621", "#fff0d6", "#001768"];
    for (let i = 0; i < 90; i++) {
      const bit = document.createElement("i");
      bit.className = "confetti-pixel";
      bit.style.background = colors[i % colors.length];
      bit.style.left = `${Math.random() * 100}vw`;
      document.body.append(bit);
      gsap.fromTo(
        bit,
        { y: -40, rotate: 0 },
        {
          y: innerHeight + 60,
          x: (Math.random() - 0.5) * 240,
          rotate: Math.random() * 720 - 360,
          duration: 1.6 + Math.random() * 1.4,
          ease: "power1.in",
          delay: Math.random() * 0.5,
          onComplete: () => bit.remove(),
        },
      );
    }
    const bot = $("#hero-bot img");
    if (bot) gsap.fromTo(bot, { y: 0 }, { y: -80, duration: 0.3, yoyo: true, repeat: 3, ease: "power2.out" });
  });

  return { updateTally };
})();

// ===== PXL game layer (pass 4): achievements, chiptune, living title =====
const ACHIEVEMENTS = [
  ["start", "PRESS START", "Started the adventure."],
  ["powered", "POWERED UP", "Unlocked our mission, vision and values."],
  ["bonus", "BONUS HUNTER", "Cleared the bonus stage."],
  ["traveler", "WORLD TRAVELER", "Visited every world."],
  ["artist", "PIXEL ARTIST", "Painted 10 pixels on the canvas."],
  ["arcade", "ARCADE RAT", "Played a round of Pixel Catch."],
  ["spirit", "SPIRIT CATCHER", "Caught a founder’s spirit animal."],
  ["perfect", "PIXEL PERFECT", "Collected all 9 pixels."],
  ["cheat", "SECRET CODE", "Found the cheat code."],
  ["wstreak", "W STREAK", "Turned 3 L’s into W’s."],
  ["stages", "WORLD 1-3 CLEAR", "Visited all three stages."],
  ["lab", "BRAND TESTER", "Tried the logo on every background."],
  ["shopper", "WINDOW SHOPPER", "Inspected 5 items in the shop."],
  ["clear", "GAME CLEAR", "Reached the end."],
];
const earned = new Set();
const achievementQueue = [];
let achievementShowing = false;
let paintedCells = 0;

function achieve(id) {
  if (earned.has(id)) return;
  const entry = ACHIEVEMENTS.find(([key]) => key === id);
  if (!entry) return;
  earned.add(id);
  renderTrophies();
  achievementQueue.push(entry);
  showNextAchievement();
}
function countPaint() {
  paintedCells += 1;
  if (paintedCells >= 10) achieve("artist");
}
function showNextAchievement() {
  if (achievementShowing || !achievementQueue.length) return;
  achievementShowing = true;
  const [, name, detail] = achievementQueue.shift();
  const pop = $("#achievement-pop");
  $("#achievement-pop-name").textContent = name;
  $("#achievement-pop-detail").textContent = detail;
  $("#achievement-pop-count").textContent = `${earned.size}/${ACHIEVEMENTS.length}`;
  pop.hidden = false;
  pop.classList.remove("out");
  void pop.offsetWidth;
  pop.classList.add("in");
  chime([
    [659, 0, 0.06],
    [880, 90, 0.06],
    [1175, 180, 0.16],
  ]);
  setTimeout(() => {
    pop.classList.remove("in");
    pop.classList.add("out");
    setTimeout(() => {
      pop.hidden = true;
      achievementShowing = false;
      showNextAchievement();
    }, 320);
  }, 2600);
}
function renderTrophies() {
  const list = $("#trophy-list");
  if (!list) return;
  $("#trophy-count").textContent = `${earned.size}/${ACHIEVEMENTS.length}`;
  list.replaceChildren(
    ...ACHIEVEMENTS.map(([key, name, detail]) => {
      const item = document.createElement("li");
      const got = earned.has(key);
      item.className = got ? "got" : "";
      item.title = got ? detail : "Locked";
      item.innerHTML = `<i aria-hidden="true">${got ? "&#9733;" : "?"}</i><span>${got ? name : "???"}</span>`;
      item.setAttribute("aria-label", got ? `${name}: ${detail}` : "Locked achievement");
      return item;
    }),
  );
}
renderTrophies();

// First real scroll counts as pressing start; reaching the ending clears the game.
addEventListener(
  "scroll",
  function startWatcher() {
    if (scrollY > 120 && !document.documentElement.classList.contains("booting")) {
      achieve("start");
      removeEventListener("scroll", startWatcher);
    }
  },
  { passive: true },
);
new IntersectionObserver(
  (entries, observer) => {
    if (!entries[0].isIntersecting) return;
    achieve("clear");
    observer.disconnect();
  },
  { threshold: 0.5 },
).observe($(".ending"));

// ---- Original chiptune loop (plays only while sound is on) ----
// 4 bars in C major: C - Am - F - G. Square-wave lead + triangle bass.
const music = {
  context: null,
  gain: null,
  timer: null,
  step: 0,
  nextTime: 0,
  lead: [
    72, 76, 79, 76, 74, 72, 67, 69,
    72, 74, 76, 79, 81, 79, 76, 74,
    77, 76, 74, 72, 74, 76, 72, 69,
    71, 74, 79, 74, 72, 71, 67, 0,
  ],
  bass: [48, 55, 48, 55, 45, 52, 45, 52, 41, 48, 41, 48, 43, 50, 43, 47],
};
const midi = (note) => 440 * 2 ** ((note - 69) / 12);
function musicNote(type, note, time, length, volume) {
  const osc = music.context.createOscillator();
  const gain = music.context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(midi(note), time);
  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
  osc.connect(gain).connect(music.gain);
  osc.start(time);
  osc.stop(time + length + 0.02);
}
function musicTick() {
  const eighth = 60 / 140 / 2;
  while (music.nextTime < music.context.currentTime + 0.25) {
    const step = music.step % music.lead.length;
    const note = music.lead[step];
    if (note) musicNote("square", note, music.nextTime, eighth * 0.9, 0.05);
    if (step % 2 === 0)
      musicNote("triangle", music.bass[(step / 2) % music.bass.length], music.nextTime, eighth * 1.8, 0.12);
    music.nextTime += eighth;
    music.step += 1;
  }
}
function pxlMusic(on) {
  if (!on) {
    clearInterval(music.timer);
    music.timer = null;
    music.gain?.gain.setTargetAtTime(0, music.context.currentTime, 0.05);
    return;
  }
  try {
    music.context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (music.context.state === "suspended") music.context.resume();
    music.gain ||= music.context.createGain();
    music.gain.connect(music.context.destination);
    music.gain.gain.setValueAtTime(0.35, music.context.currentTime);
    music.nextTime = music.context.currentTime + 0.1;
    clearInterval(music.timer);
    music.timer = setInterval(musicTick, 60);
  } catch {}
}
document.addEventListener("visibilitychange", () => {
  if (!music.context) return;
  if (document.hidden) music.context.suspend();
  else if (music.timer) music.context.resume();
});

// ---- Living title screen: layers lean toward the mouse; cursor sheds pixels ----
const pxlLiving = (() => {
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const hero = $(".hero");
  let frame = 0;
  hero.addEventListener("pointermove", (event) => {
    if (motionOff || !finePointer.matches || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const rect = hero.getBoundingClientRect();
      const step = (value) => Math.round(value * 8) / 8;
      hero.style.setProperty("--mx", step(((event.clientX - rect.left) / rect.width) * 2 - 1));
      hero.style.setProperty("--my", step(((event.clientY - rect.top) / rect.height) * 2 - 1));
    });
  });
  hero.addEventListener("pointerleave", () => {
    hero.style.setProperty("--mx", 0);
    hero.style.setProperty("--my", 0);
  });

  const colors = ["#ffb65d", "#be3621", "#fff0d6"];
  let last = 0;
  let live = 0;
  function spark(event) {
    if (motionOff || !finePointer.matches) return;
    const now = performance.now();
    if (now - last < 45 || live > 26) return;
    last = now;
    live += 1;
    const bit = document.createElement("i");
    bit.className = "cursor-spark";
    bit.style.left = `${event.clientX}px`;
    bit.style.top = `${event.clientY}px`;
    bit.style.background = colors[Math.floor(Math.random() * colors.length)];
    bit.style.setProperty("--dx", `${(Math.random() - 0.5) * 30}px`);
    document.body.append(bit);
    bit.addEventListener("animationend", () => {
      bit.remove();
      live -= 1;
    });
  }
  hero.addEventListener("pointermove", spark);
  $(".ending").addEventListener("pointermove", spark);

  // ---- Player select: blip + ready pose on hover/focus ----
  $$(".player-stage").forEach((stage) => {
    const select = () => {
      tone(880, 0.035);
      setTimeout(() => tone(1175, 0.05), 50);
    };
    stage.addEventListener("pointerenter", select);
    stage.addEventListener("focus", select);
  });
  return {};
})();

// ===== Bonus stage: the robot literally turns L's into W's =====
// Every "L" the riding robot passes over flips into a "W". Flip 3 for W STREAK.
const pxlFlips = (() => {
  const band = $(".bonus-band");
  const rider = $(".bonus-rider");
  let flips = 0;
  let inView = false;
  function check() {
    if (!inView || motionOff || !document.documentElement.classList.contains("game-on")) return;
    const box = rider.getBoundingClientRect();
    const center = box.left + box.width / 2;
    $$(".flip-l:not(.flipped)", band).forEach((letter) => {
      const rect = letter.getBoundingClientRect();
      if (rect.left > center || rect.right < center) return;
      letter.textContent = "W";
      letter.classList.add("flipped");
      flips += 1;
      $("#lw-count").textContent = String(flips).padStart(2, "0");
      band.classList.remove("lw-bump");
      void band.offsetWidth;
      band.classList.add("lw-bump");
      tone(660 + Math.min(flips, 8) * 70, 0.06);
      if (flips === 3) achieve("wstreak");
    });
  }
  new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
  }).observe(band);
  if (window.gsap) gsap.ticker.add(check);
  else addEventListener("scroll", check, { passive: true });
  return {};
})();

// ===== Player Select: "touch me to know me" profiles =====
// EDIT ME: replace the placeholder text below with each member's real details.
// Anything still starting with "TBA" shows as an empty game slot on the page.
const PROFILES = {
  lan: {
    course: "BSIT 4D",
    game: "Genshin Impact",
    made: ["First brand post", "First promotional poster"],
    quote: "Everything will always work out in the end.",
    contact: "lanargied.angeles2004@gmail.com",
  },
  jonrey: {
    course: "BSIT 4D",
    game: "Valorant",
    made: ["Ideas and design suggestions", "Social media captions"],
    quote: "Ako ang Bagyo",
    contact: "aljonreyapan.neust@gmail.com",
  },
  alric: {
    course: "BSIT 4D",
    game: "Genshin Impact",
    made: ["The brand", "Tagline and logo", "Poster design idea"],
    quote: "Everything is a gamble, kaya all in.",
    contact: "alricseanmacalinao.neust@gmail.com",
  },
  jan: {
    course: "BSIT 4D",
    game: "Mobile Legends: Bang Bang",
    made: ["This entire website"],
    quote: "Be a piece of peace.",
    contact: "sapinjanfortun1@gmail.com",
  },
};

const pxlProfiles = (() => {
  const hasGsap = Boolean(window.gsap);
  const order = ["lan", "jonrey", "alric", "jan"];
  const section = $("#team");
  const panel = $("#profile");
  panel.setAttribute("data-lenis-prevent", "");
  // Floating pixel bits for the character-select background.
  const bits = document.createElement("div");
  bits.className = "profile-bits";
  bits.setAttribute("aria-hidden", "true");
  const bitColors = ["#ffb65d", "#be3621", "#fff0d6"];
  for (let i = 0; i < 18; i++) {
    const bit = document.createElement("i");
    bit.style.left = `${(i * 37) % 100}%`;
    bit.style.setProperty("--s", `${[6, 8, 10, 12][i % 4]}px`);
    bit.style.setProperty("--c", bitColors[i % bitColors.length]);
    bit.style.setProperty("--t", `${7 + (i % 5) * 1.6}s`);
    bit.style.setProperty("--d", `${-((i * 1.3) % 9)}s`);
    bit.style.setProperty("--x", `${((i % 3) - 1) * 40}px`);
    bits.append(bit);
  }
  panel.prepend(bits);
  let current = null;
  let trigger = null;
  let busy = false;
  let typeTimer;
  const isTba = (value) => /^TBA/.test(value);
  const tbaLabel = (value) => value.replace(/^TBA:\s*/, "");

  function setStat(element, value) {
    element.classList.toggle("tba", isTba(value));
    element.textContent = isTba(value) ? "???" : value;
    element.title = isTba(value) ? `Coming soon: ${tbaLabel(value)}` : "";
  }
  function typeQuote(text, tba) {
    const target = $("#profile-quote");
    clearTimeout(typeTimer);
    target.classList.toggle("tba", tba);
    if (tba || motionOff) {
      target.textContent = tba ? "…  (quote coming soon)" : text;
      return;
    }
    target.textContent = "";
    let index = 0;
    const step = () => {
      target.textContent = text.slice(0, ++index);
      if (index % 3 === 0) tone(880, 0.01);
      if (index < text.length) typeTimer = setTimeout(step, 26);
    };
    typeTimer = setTimeout(step, 450);
  }
  function fill(key) {
    const profile = PROFILES[key];
    const spirit = spirits[key];
    const position = order.indexOf(key);
    const card = $(`[data-battle="${key}"]`).closest(".player-card");
    const photo = $(".player-photo", card);
    const tag = `P${position + 1}`;
    $("#profile-watermark").textContent = tag;
    $("#profile-tag").textContent = tag;
    $("#profile-count").textContent = `PLAYER ${position + 1} / ${order.length}`;
    $("#profile-prev-label").textContent = `P${((position + order.length - 1) % order.length) + 1}`;
    $("#profile-next-label").textContent = `P${((position + 1) % order.length) + 1}`;
    $("#profile-card-role").textContent = spirit.role;
    $("#profile-card-name").textContent = spirit.full;
    $("#profile-types").replaceChildren(
      ...spirit.types.map((type) => {
        const chip = document.createElement("span");
        chip.textContent = type;
        return chip;
      }),
    );
    $("#profile-photo").src = photo.src;
    $("#profile-photo").alt = photo.alt;
    $("#profile-sprite").src = spirit.trainer;
    $("#profile-animal").src = spirit.img;
    $("#profile-portrait").src = spirit.trainer;
    $("#profile-encounter-icon").src = spirit.img;
    $("#profile-role").textContent = spirit.role;
    $("#profile-spirit").textContent = spirit.animal;
    $("#profile-name").textContent = spirit.full;
    setStat($("#profile-course"), profile.course);
    setStat($("#profile-game"), profile.game);
    // Inventory: always at least 3 slots; unknown items show as empty slots.
    const items = [...profile.made];
    if (items.every(isTba)) while (items.length < 3) items.push("TBA: more coming soon");
    $("#profile-made").replaceChildren(
      ...items.map((item, index) => {
        const slot = document.createElement("li");
        const tba = isTba(item);
        slot.className = tba ? "empty" : "";
        slot.innerHTML = `<span class="slot-no">${String(index + 1).padStart(2, "0")}</span><span class="slot-text"></span>`;
        slot.querySelector(".slot-text").textContent = tba ? "EMPTY SLOT" : item;
        if (tba) slot.title = `Coming soon: ${tbaLabel(item)}`;
        return slot;
      }),
    );
    $("#profile-quote-name").textContent = `${spirit.name} SAYS`;
    typeQuote(profile.quote, isTba(profile.quote));
    setStat($("#profile-contact"), profile.contact);
    $("#profile-encounter").setAttribute("aria-label", `Encounter ${spirit.full}’s spirit animal`);
  }

  function cardInset(card) {
    const s = section.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return `inset(${c.top - s.top}px ${s.right - c.right}px ${s.bottom - c.bottom}px ${c.left - s.left}px)`;
  }
  function fitSection() {
    section.style.minHeight = "";
    // Measure real content (scrollHeight would include the oversized ray layer).
    const grid = $(".profile-grid", panel);
    const bottomPad = parseFloat(getComputedStyle(panel).paddingBottom) || 0;
    const contentHeight = grid.offsetTop + grid.offsetHeight + bottomPad;
    if (contentHeight > section.offsetHeight) section.style.minHeight = `${contentHeight}px`;
    // Spotlight rays and glow burst from behind the trading card.
    const card = $(".profile-card", panel);
    panel.style.setProperty("--cx", `${card.offsetLeft + grid.offsetLeft + card.offsetWidth / 2}px`);
    panel.style.setProperty("--cy", `${grid.offsetTop + card.offsetTop + card.offsetHeight / 2}px`);
  }

  function open(key, button) {
    if (busy || current) return;
    current = key;
    trigger = button;
    fill(key);
    const card = button.closest(".player-card");
    const others = $$(".player-card").filter((other) => other !== card);
    pxlGame.scrollTo(section, -84);
    panel.hidden = false;
    section.classList.add("profile-open");
    fitSection();
    chime([
      [523, 0, 0.05],
      [784, 80, 0.05],
      [1047, 160, 0.12],
    ]);
    if (!hasGsap || motionOff) {
      panel.focus({ preventScroll: true });
      return;
    }
    busy = true;
    gsap
      .timeline({
        onComplete() {
          busy = false;
          panel.focus({ preventScroll: true });
        },
      })
      .to(others, { scale: 0.86, opacity: 0, duration: 0.35, ease: "power2.in", stagger: 0.04 }, 0)
      .fromTo(
        panel,
        { clipPath: cardInset(card) },
        { clipPath: "inset(0px 0px 0px 0px)", duration: 0.75, ease: "expo.inOut" },
        0.1,
      )
      .from(".profile-watermark", { xPercent: 30, opacity: 0, duration: 0.8, ease: "power3.out" }, 0.55)
      .from(".profile-bar", { y: -20, opacity: 0, duration: 0.4, ease: "power3.out" }, 0.6)
      .from(
        ".profile-card",
        { y: 60, rotate: -6, opacity: 0, duration: 0.7, ease: "back.out(1.6)", clearProps: "transform,opacity" },
        0.6,
      )
      .from(
        $$(".profile-body .profile-in", panel),
        { y: 26, opacity: 0, duration: 0.5, ease: "power3.out", stagger: 0.07, clearProps: "transform,opacity" },
        0.7,
      )
      .from(".profile-inventory li", { scale: 0.6, opacity: 0, duration: 0.35, ease: "back.out(2)", stagger: 0.06, clearProps: "transform,opacity" }, 1)
      .from("#profile-animal", { y: -40, opacity: 0, duration: 0.6, ease: "bounce.out" }, 0.9);
  }

  function switchTo(direction) {
    if (busy || !current) return;
    const next = order[(order.indexOf(current) + direction + order.length) % order.length];
    tone(direction > 0 ? 880 : 660, 0.05);
    if (!hasGsap || motionOff) {
      current = next;
      fill(next);
      fitSection();
      return;
    }
    busy = true;
    const parts = [".profile-card", ...$$(".profile-body .profile-in", panel)];
    gsap
      .timeline({ onComplete: () => (busy = false) })
      .to(parts, { x: -40 * direction, opacity: 0, duration: 0.2, ease: "power2.in", stagger: 0.02 })
      .add(() => {
        current = next;
        fill(next);
        fitSection();
      })
      .fromTo(
        parts,
        { x: 40 * direction, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.35, ease: "power3.out", stagger: 0.03, clearProps: "transform,opacity" },
      )
      .from(".profile-watermark", { xPercent: 20 * direction, opacity: 0, duration: 0.4 }, "<");
  }

  function close(then) {
    if (busy || !current) return;
    clearTimeout(typeTimer);
    const card = $(`[data-battle="${current}"]`).closest(".player-card");
    const others = $$(".player-card").filter((other) => other !== card);
    const finish = () => {
      panel.hidden = true;
      section.classList.remove("profile-open");
      section.style.minHeight = "";
      if (hasGsap) gsap.set([panel, ...$$(".player-card")], { clearProps: "clipPath,scale,opacity" });
      const closedKey = current;
      current = null;
      busy = false;
      if (then) then();
      else ($(`.know-me[data-profile="${closedKey}"]`) || trigger)?.focus({ preventScroll: true });
    };
    tone(440, 0.05);
    if (!hasGsap || motionOff) return finish();
    busy = true;
    gsap
      .timeline({ onComplete: finish })
      .to($$(".profile-in, .profile-bar, .profile-watermark", panel), { opacity: 0, duration: 0.2 }, 0)
      .to(panel, { clipPath: cardInset(card), duration: 0.6, ease: "expo.inOut" }, 0.1)
      .to(others, { scale: 1, opacity: 1, duration: 0.35, ease: "power2.out", stagger: 0.04 }, 0.45)
      .set($$(".profile-in, .profile-bar, .profile-watermark", panel), { opacity: 1 });
  }

  $$(".know-me").forEach((button) =>
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      open(button.dataset.profile, button);
    }),
  );
  $("#profile-close").addEventListener("click", () => close());
  $("#profile-prev").addEventListener("click", () => switchTo(-1));
  $("#profile-next").addEventListener("click", () => switchTo(1));
  $("#profile-encounter").addEventListener("click", () => {
    const key = current;
    const encounterButton = $(`[data-battle="${key}"]`);
    close(() => startEncounter(key, encounterButton));
  });
  document.addEventListener("keydown", (event) => {
    if (!current || document.querySelector("dialog[open]")) return;
    if (event.key === "Escape") close();
    if (event.key === "ArrowRight" && panel.contains(document.activeElement)) switchTo(1);
    if (event.key === "ArrowLeft" && panel.contains(document.activeElement)) switchTo(-1);
  });
  return { open, close };
})();

// ===== Page breakers: pixel-terrain seams between every world =====
// The section above crumbles into the next as a stepped pixel skyline, with a
// level-transition chip on the seam. Colors are read from the two sections.
const pxlBreakers = (() => {
  const labels = {
    universe: "WORLD 1-3 · THE UNIVERSE",
    shop: "ITEM SHOP",
    rivals: "BOSS RUSH",
    bonus: "BONUS STAGE",
    identity: "WORLD 1-4 · THE IDENTITY",
    playground: "SIDE QUEST · MAKE YOUR MARK",
    campaigns: "WORLD 1-5 · THE FEED",
    team: "PLAYER SELECT",
    end: "THE END",
  };
  const playground = $(".playground");
  if (playground && !playground.id) playground.dataset.world = "playground";
  const keyOf = (element) => element.id || element.dataset.world;
  const solid = (element) => {
    let color = getComputedStyle(element).backgroundColor;
    if (!color || color === "rgba(0, 0, 0, 0)" || color === "transparent")
      color = getComputedStyle(document.body).backgroundColor;
    return color;
  };

  function terrain(top, seed) {
    const cols = 160;
    const rows = 5;
    const cell = 16;
    let state = seed * 9301 + 49297;
    const rand = () => ((state = (state * 9301 + 49297) % 233280) / 233280);
    const cells = [];
    let height = 2;
    for (let x = 0; x < cols; x++) {
      const roll = rand();
      if (roll < 0.22) height = Math.max(1, height - 1);
      else if (roll > 0.78) height = Math.min(3, height + 1);
      for (let y = 0; y < rows; y++) {
        let fill = null;
        if (y < height) fill = top;
        else if (rand() < 0.42 - (y - height) * 0.16) fill = rand() < 0.06 ? "#ffb65d" : top;
        cells.push(fill);
      }
    }
    // Merge horizontal runs per row to keep the SVG light.
    let rects = "";
    for (let y = 0; y < rows; y++) {
      let x = 0;
      while (x < cols) {
        const fill = cells[x * rows + y];
        if (!fill) {
          x++;
          continue;
        }
        let run = 1;
        while (x + run < cols && cells[(x + run) * rows + y] === fill) run++;
        rects += `<rect x="${x * cell}" y="${y * cell}" width="${run * cell}" height="${cell}" fill="${fill}"/>`;
        x += run;
      }
    }
    return `<svg viewBox="0 0 ${cols * cell} ${rows * cell}" preserveAspectRatio="xMidYMin slice" shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects}</svg>`;
  }

  const sections = [...$("main").children].filter((element) =>
    element.matches("section, footer"),
  );
  const breakers = [];
  sections.forEach((section, index) => {
    const key = keyOf(section);
    const previous = sections[index - 1];
    if (!previous || !labels[key] || previous.classList.contains("hero")) return;
    const breaker = document.createElement("div");
    breaker.className = "pxl-break";
    breaker.setAttribute("aria-hidden", "true");
    breaker.style.setProperty("--below", solid(section));
    breaker.innerHTML =
      terrain(solid(previous), index + 3) +
      `<span class="break-chip"><b>&#9660;</b> NEXT <i>&middot;</i> ${labels[key]}</span>`;
    section.before(breaker);
    breakers.push(breaker);
  });

  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }),
    { threshold: 0.6 },
  );
  breakers.forEach((breaker) => observer.observe(breaker));
  return {};
})();

// ===== World 1-3: overworld level select =====
// The robot stands on the selected stage node and hops along the path when the
// stage changes (click or arrow keys). Each visited stage earns a CLEAR badge;
// visiting all three unlocks the WORLD 1-3 CLEAR achievement.
const pxlStages = (() => {
  const map = $(".product-tabs");
  const tabs = $$(".stage-node", map);
  const bot = $(".map-bot", map);
  const visited = new Set();
  let lastX = null;
  const selected = () => tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0];

  function target(tab) {
    return {
      x: tab.offsetLeft + tab.offsetWidth / 2 - bot.offsetWidth / 2,
      y: tab.offsetTop - bot.offsetHeight + 8,
    };
  }
  function place(tab, animate) {
    const { x, y } = target(tab);
    const facing = lastX === null || x >= lastX ? 1 : -1;
    lastX = x;
    if (!window.gsap) {
      bot.style.transform = `translate(${x}px, ${y}px)`;
      return;
    }
    if (!animate || motionOff) {
      gsap.set(bot, { x, y, scaleX: facing });
      return;
    }
    gsap.killTweensOf(bot);
    tone(520, 0.04);
    setTimeout(() => tone(780, 0.06), 160);
    gsap
      .timeline()
      .set(bot, { scaleX: facing })
      .to(bot, { x, duration: 0.55, ease: "power1.inOut" }, 0)
      .to(bot, { y: y - 70, duration: 0.27, ease: "power2.out" }, 0)
      .to(bot, { y, duration: 0.28, ease: "bounce.out" }, 0.27);
  }
  function visit(tab) {
    if (visited.has(tab.id)) return;
    visited.add(tab.id);
    tab.classList.add("visited");
    if (visited.size === tabs.length) achieve("stages");
  }

  new MutationObserver(() => {
    const tab = selected();
    place(tab, true);
    visit(tab);
  }).observe(map, { subtree: true, attributes: true, attributeFilter: ["aria-selected"] });

  new IntersectionObserver(
    (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      visit(selected());
      observer.disconnect();
    },
    { threshold: 0.4 },
  ).observe(map);

  const settle = () => place(selected(), false);
  addEventListener("resize", settle);
  addEventListener("load", settle);
  requestAnimationFrame(settle);
  return {};
})();

// ===== World 1-4: Brand Lab =====
const pxlLab = (() => {
  // ---- Logo background switcher ----
  const logoMain = $(".logo-main");
  const chips = $$(".bg-chip");
  chips.forEach((chip) => {
    chip.style.setProperty("--chip", chip.dataset.bg);
    chip.addEventListener("click", () => {
      chips.forEach((other) => other.setAttribute("aria-pressed", String(other === chip)));
      logoMain.style.setProperty("--logo-bg", chip.dataset.bg);
      logoMain.classList.toggle("on-light", chip.dataset.bg === "#fff0d6");
      tone(600 + chips.indexOf(chip) * 120, 0.05);
      chip.dataset.tried = "1";
      if (chips.every((c) => c.dataset.tried)) achieve("lab");
    });
  });

  // ---- Combo Lab: every brand pairing with its real WCAG contrast ratio ----
  const brand = [
    ["NAVY", "#001768"],
    ["PEACH", "#ffb65d"],
    ["RED", "#be3621"],
    ["CREAM", "#fff0d6"],
  ];
  const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const combos = [];
  brand.forEach(([bgName, bg]) =>
    brand.forEach(([fgName, fg]) => {
      if (bg === fg) return;
      combos.push({ bgName, bg, fgName, fg, r: ratio(bg, fg) });
    }),
  );
  combos.sort((a, b) => b.r - a.r);
  $("#combo-grid").replaceChildren(
    ...combos.map(({ bgName, bg, fgName, fg, r }) => {
      const grade = r >= 7 ? "AAA" : r >= 4.5 ? "AA" : r >= 3 ? "BIG" : "DECOR";
      const li = document.createElement("li");
      li.className = `combo grade-${grade.toLowerCase()}`;
      li.style.setProperty("--bg", bg);
      li.style.setProperty("--fg", fg);
      li.innerHTML = `<span class="combo-sample">Pix L’s<br>into W’s</span>
        <span class="combo-meta"><span>${fgName} ON ${bgName}</span><b>${r.toFixed(1)}:1</b><em>${grade}</em></span>`;
      li.setAttribute("aria-label", `${fgName} text on ${bgName}: contrast ${r.toFixed(1)} to 1, ${grade}`);
      return li;
    }),
  );

  // ---- Dev log EXP bar fills as the three steps light up ----
  const exp = $(".exp-bar");
  const steps = $$(".logo-process li");
  new IntersectionObserver(
    (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      exp.classList.add("fill");
      observer.disconnect();
      if (!motionOff)
        steps.forEach((_, index) => setTimeout(() => tone(440 + index * 220, 0.06), 300 + index * 330));
    },
    { threshold: 0.6 },
  ).observe(exp);

  // ---- High score entry: character counter ----
  const input = $("#type-input");
  const count = () =>
    ($("#type-count").textContent = `${String(input.value.length).padStart(2, "0")}/${input.maxLength}`);
  input.addEventListener("input", () => {
    count();
    tone(700 + (input.value.length % 8) * 40, 0.015);
  });
  count();
  return {};
})();

// ===== World 1-5: the feed and the event =====
const pxlFeed = (() => {
  // ---- "Give it a W" (our take on a like) ----
  const wButton = $("#w-btn");
  const wCount = $("#w-count");
  let ws = 0;
  wButton.addEventListener("click", () => {
    const on = wButton.getAttribute("aria-pressed") !== "true";
    wButton.setAttribute("aria-pressed", String(on));
    ws += on ? 1 : -1;
    wCount.textContent = ws ? `${ws} W${ws > 1 ? "s" : ""} · you turned an L into a W` : "Be the first to give it a W";
    if (!on) return tone(330, 0.05);
    chime([
      [784, 0, 0.05],
      [1175, 70, 0.1],
    ]);
    if (motionOff || !window.gsap) return;
    const media = $(".feed-media");
    const burst = document.createElement("span");
    burst.className = "w-burst";
    burst.setAttribute("aria-hidden", "true");
    burst.textContent = "W";
    media.append(burst);
    gsap
      .timeline({ onComplete: () => burst.remove() })
      .fromTo(burst, { scale: 0, opacity: 1 }, { scale: 1.3, duration: 0.25, ease: "back.out(3)" })
      .to(burst, { scale: 1, duration: 0.15 })
      .to(burst, { opacity: 0, y: -30, duration: 0.35, delay: 0.25 });
    for (let i = 0; i < 10; i++) {
      const bit = document.createElement("i");
      bit.className = "w-bit";
      media.append(bit);
      const angle = (i / 10) * Math.PI * 2;
      gsap.fromTo(
        bit,
        { x: 0, y: 0, opacity: 1 },
        {
          x: Math.cos(angle) * 110,
          y: Math.sin(angle) * 110,
          opacity: 0,
          duration: 0.6,
          ease: "power2.out",
          onComplete: () => bit.remove(),
        },
      );
    }
  });
  // Double-click the post like a real feed.
  $(".feed-media").addEventListener("dblclick", (event) => {
    event.preventDefault();
    if (wButton.getAttribute("aria-pressed") !== "true") wButton.click();
  });

  // ---- Copy caption ----
  const caption = () =>
    $("#post-caption").innerText.replace(/^pxl\s*/, "").replace(/\s+/g, " ").trim();
  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption());
      toast("Caption copied. Ready to post!");
    } catch {
      toast("Couldn’t reach the clipboard. Select the caption to copy it.");
    }
    tone(880, 0.05);
  }
  $("#copy-caption").addEventListener("click", copyCaption);
  $("#share-caption").addEventListener("click", copyCaption);

  // ---- Tear-off ticket stub ----
  const ticket = $("#ticket");
  $("#ticket-stub").addEventListener("click", () => {
    if (ticket.classList.contains("torn")) {
      ticket.classList.remove("torn");
      tone(440, 0.05);
      return;
    }
    ticket.classList.add("torn");
    chime([
      [330, 0, 0.04],
      [262, 40, 0.04],
      [659, 160, 0.08],
      [988, 240, 0.12],
    ]);
    toast("Stub saved. See you at PXL World!");
  });
  return {};
})();

// ===== Footer: save point, poke-able pixel logo, save file =====
const pxlFooter = (() => {
  // ---- Logo rebuilt from pixels that scatter from the pointer ----
  const canvas = $("#poke-logo");
  const context = canvas.getContext("2d");
  const wrap = canvas.parentElement;
  const source = new Image();
  const N = 44; // sample grid
  let particles = [];
  let cell = 8;
  let pointer = { x: -999, y: -999 };
  let running = false;
  let visible = false;

  function build() {
    const size = Math.min(wrap.clientWidth, 420);
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = size / N;
    const sample = document.createElement("canvas");
    sample.width = N;
    sample.height = N;
    const sampleContext = sample.getContext("2d");
    sampleContext.drawImage(source, 0, 0, N, N);
    let data;
    try {
      data = sampleContext.getImageData(0, 0, N, N).data;
    } catch {
      // file:// pages taint the canvas; fall back to the plain image.
      wrap.classList.add("fallback");
      return false;
    }
    particles = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 4;
        if (data[i + 3] < 120) continue;
        particles.push({
          hx: x * cell,
          hy: y * cell,
          x: x * cell,
          y: y * cell,
          vx: 0,
          vy: 0,
          c: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`,
        });
      }
    wrap.classList.add("live");
    draw();
    return true;
  }
  function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      context.fillStyle = p.c;
      context.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(cell), Math.ceil(cell));
    });
  }
  function step() {
    let moving = false;
    const radius = cell * 7;
    particles.forEach((p) => {
      const dx = p.x + cell / 2 - pointer.x;
      const dy = p.y + cell / 2 - pointer.y;
      const dist = Math.hypot(dx, dy);
      if (dist < radius && dist > 0) {
        const force = (1 - dist / radius) * 6;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }
      p.vx += (p.hx - p.x) * 0.08;
      p.vy += (p.hy - p.y) * 0.08;
      p.vx *= 0.78;
      p.vy *= 0.78;
      p.x += p.vx;
      p.y += p.vy;
      if (Math.abs(p.vx) + Math.abs(p.vy) > 0.05 || Math.abs(p.hx - p.x) + Math.abs(p.hy - p.y) > 0.3)
        moving = true;
    });
    draw();
    if ((moving || pointer.x > -999) && visible && !motionOff) requestAnimationFrame(step);
    else running = false;
  }
  function kick() {
    if (running || motionOff || !particles.length) return;
    running = true;
    requestAnimationFrame(step);
  }
  canvas.addEventListener("pointermove", (event) => {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    kick();
  });
  canvas.addEventListener("pointerleave", () => {
    pointer = { x: -999, y: -999 };
    kick();
  });
  canvas.addEventListener("pointerdown", (event) => {
    // A tap shakes every pixel loose.
    particles.forEach((p) => {
      p.vx += (Math.random() - 0.5) * 30;
      p.vy += (Math.random() - 0.5) * 30;
    });
    tone(220, 0.08);
    setTimeout(() => tone(660, 0.08), 120);
    kick();
  });
  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible && !particles.length && source.complete && source.naturalWidth) build();
  }).observe(wrap);
  source.addEventListener("load", () => visible && build());
  source.src = "assets/logo-primary.png";
  addEventListener("resize", () => particles.length && build());

  // ---- Brand kit copy buttons ----
  $$(".fg-colors button").forEach((button) =>
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.color);
        toast(`Copied ${button.dataset.color}`);
      } catch {
        toast(`Color: ${button.dataset.color}`);
      }
      tone(880, 0.04);
    }),
  );

  // ---- Live save file ----
  const ranks = [
    [0, "ROOKIE"],
    [0.25, "EXPLORER"],
    [0.5, "PRO PLAYER"],
    [0.75, "LEGEND"],
    [1, "PIXEL PERFECT"],
  ];
  function refresh() {
    const pad = (n) => String(n).padStart(2, "0");
    $("#sf-pixels").textContent = `${pad(pixelCount)}/${pad(PIXEL_TOTAL)}`;
    $("#sf-trophies").textContent = `${pad(earned.size)}/${pad(ACHIEVEMENTS.length)}`;
    const progress = (pixelCount / PIXEL_TOTAL + earned.size / ACHIEVEMENTS.length) / 2;
    $("#sf-bar").style.width = `${Math.round(progress * 100)}%`;
    const rank = ranks.filter(([min]) => progress >= min).pop()[1];
    $("#sf-rank").textContent = `RANK: ${rank}`;
  }
  const observer = new MutationObserver(refresh);
  observer.observe($("#hud-coins b"), { childList: true, characterData: true, subtree: true });
  observer.observe($("#trophy-count"), { childList: true, characterData: true, subtree: true });
  refresh();
  return {};
})();

// ===== Ending -> save point: scroll-scrubbed dusk + staggered arrival =====
const pxlDusk = (() => {
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  const ending = $(".ending");
  const footer = $("#end");
  const stars = document.createElement("div");
  stars.className = "dusk-stars";
  stars.setAttribute("aria-hidden", "true");
  $(".save-point").prepend(stars);
  let ctx = null;

  function build() {
    // Night falls as the credits scroll away (scrubbed, eased by scrub: 1).
    gsap
      .timeline({
        scrollTrigger: { trigger: ending, start: "bottom 95%", end: "bottom 15%", scrub: 1 },
      })
      .fromTo(
        ending,
        { "--dusk-b": 1, "--dusk-s": 1, "--dusk-h": "0deg" },
        { "--dusk-b": 0.45, "--dusk-s": 0.7, "--dusk-h": "-18deg", ease: "none" },
        0,
      )
      .fromTo(footer, { "--stars": 0 }, { "--stars": 1, ease: "power1.in" }, 0)
      .fromTo(
        ".ending-inner",
        { y: 0, opacity: 1 },
        { y: -70, opacity: 0.35, ease: "power1.in" },
        0,
      );
    // The save point arrives piece by piece (plays once, then stays put).
    gsap.from(".save-point .sp-tag, .save-point .sp-title, .save-point .sp-text, .save-point .button", {
      y: 40,
      opacity: 0,
      duration: 0.8,
      ease: "power3.out",
      stagger: 0.1,
      clearProps: "transform,opacity",
      scrollTrigger: { trigger: ".save-point", start: "top 80%", once: true },
    });
    gsap.from(".poke-logo", {
      y: 60,
      scale: 0.9,
      opacity: 0,
      duration: 1,
      ease: "expo.out",
      clearProps: "transform,opacity",
      scrollTrigger: { trigger: ".save-point", start: "top 75%", once: true },
    });
    gsap.from(".footer-grid .fg-col", {
      y: 40,
      opacity: 0,
      duration: 0.7,
      ease: "power3.out",
      stagger: 0.08,
      clearProps: "transform,opacity",
      scrollTrigger: { trigger: ".footer-grid", start: "top 85%", once: true },
    });
  }
  function sync() {
    if (!hasGsap) return;
    if (motionOff) {
      ctx?.revert();
      ctx = null;
      return;
    }
    if (ctx) return;
    ctx = gsap.context(build);
    ScrollTrigger.refresh();
  }
  $("#motion-toggle").addEventListener("click", sync);
  mediaMotion.addEventListener("change", sync);
  sync();
  return {};
})();

// ===== Item Shop + Boss Rush =====
const pxlShop = (() => {
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  const items = $$(".shop-item");
  const bubble = $("#sk-bubble");
  const lines = {
    all: "Welcome, player! Everything here is made from our own pixels.",
    art: "Stickers, prints, pins and the Explorer himself. Collect them all!",
    games: "Fresh cartridges! Pixel Catch is a W waiting to happen.",
    animation: "Grab a snack. PXL Shorts are only a few frames long.",
    merch: "Wear the pixels. The tote fits a whole sticker collection.",
  };
  function say(text) {
    bubble.textContent = text;
    if (hasGsap && !motionOff)
      gsap.fromTo(bubble, { scale: 0.85, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2)" });
  }

  // ---- Filters ----
  $$(".shop-filter").forEach((button) =>
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      $$(".shop-filter").forEach((other) => {
        other.classList.toggle("on", other === button);
        other.setAttribute("aria-pressed", String(other === button));
      });
      const shown = items.filter((item) => filter === "all" || item.dataset.cat === filter);
      items.forEach((item) => (item.hidden = !shown.includes(item)));
      say(lines[filter]);
      tone(660, 0.04);
      if (hasGsap && !motionOff)
        gsap.fromTo(
          shown,
          { y: 30, opacity: 0, scale: 0.94 },
          { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.6)", stagger: 0.05, clearProps: "transform,opacity" },
        );
    }),
  );

  // ---- Scroll entrances ----
  let ctx = null;
  function build() {
    gsap.from(".shop-item", {
      y: 70,
      opacity: 0,
      rotate: (i) => (i % 2 ? 3 : -3),
      duration: 0.7,
      ease: "back.out(1.4)",
      stagger: { each: 0.06, grid: "auto", from: "start" },
      clearProps: "transform,opacity",
      scrollTrigger: { trigger: ".shop-grid", start: "top 80%", once: true },
    });
    gsap.from(".shop-keeper", {
      x: -120,
      opacity: 0,
      duration: 0.6,
      ease: "power3.out",
      clearProps: "transform,opacity",
      scrollTrigger: { trigger: ".shop-shelf", start: "top 85%", once: true },
    });
    gsap.from(".boss", {
      y: 90,
      opacity: 0,
      duration: 0.7,
      ease: "power3.out",
      stagger: 0.12,
      clearProps: "transform,opacity",
      scrollTrigger: {
        trigger: ".boss-grid",
        start: "top 78%",
        once: true,
        onEnter: () =>
          chime([
            [196, 0, 0.12],
            [185, 160, 0.12],
            [175, 320, 0.2],
          ]),
      },
    });
    gsap.from(".boss-hp i", {
      width: 0,
      duration: 1.1,
      ease: "steps(14)",
      stagger: 0.12,
      delay: 0.3,
      scrollTrigger: { trigger: ".boss-grid", start: "top 78%", once: true },
    });
    gsap.from(".stat-check tbody tr", {
      x: -30,
      opacity: 0,
      duration: 0.4,
      ease: "power2.out",
      stagger: 0.07,
      clearProps: "transform,opacity",
      scrollTrigger: { trigger: ".stat-check", start: "top 80%", once: true },
    });
  }
  function sync() {
    if (!hasGsap) return;
    if (motionOff) {
      ctx?.revert();
      ctx = null;
      return;
    }
    if (ctx) return;
    ctx = gsap.context(build);
    ScrollTrigger.refresh();
  }
  $("#motion-toggle").addEventListener("click", sync);
  mediaMotion.addEventListener("change", sync);
  sync();
  return {};
})();

// ===== Item Shop inspector: product photos, stats, specs, wishlist =====
const pxlInspect = (() => {
  const box = $("#item-dialog");
  if (!box) return {};
  const hasGsap = Boolean(window.gsap);
  const DATA = {
    stickers: { price: "150", flavor: "Seven tiny heroes on one sheet. Stick one, trade the rest.", stats: [4, 4, 5, 5], specs: [["Size", "A5 sheet, 7 die-cut stickers"], ["Finish", "Glossy vinyl, waterproof"], ["Edition", "Series 001"]], shots: ["On a sketchbook", "On a laptop"], kinds: ["photo", "render"] },
    print: { price: "900", flavor: "Our very first brand post, big enough to fill a wall.", stats: [5, 4, 4, 3], specs: [["Sizes", "A4, A3 and 50 × 50 cm"], ["Paper", "Matte archival print, white mat"], ["Set", "PXL World poster, logo and spirit-animal trio"]], shots: ["Gallery wall at home", "Navy frame detail"], kinds: ["photo", "render"] },
    pin: { price: "250", flavor: "Gold lines, glossy enamel. Every jacket deserves a W.", stats: [5, 5, 5, 3], specs: [["Size", "40 mm"], ["Finish", "Hard enamel, gold plated"], ["Back", "Rubber clutch, gold-plated edges"]], shots: ["Pinned on a canvas tote", "On the desk"], kinds: ["photo", "photo"] },
    figure: { price: "1,500", flavor: "The Explorer in solid vinyl: every pixel became a block.", stats: [5, 4, 5, 4], specs: [["Height", "12 cm with stand"], ["Material", "Glossy vinyl, navy base"], ["Box", "Printed retail box, Series 001"]], shots: ["Retail box", "Out of the box"], kinds: ["photo", "render"] },
    cart: { price: "600", flavor: "Plug it in, press start. Catch the peach pixels, dodge the glitches.", stats: [4, 5, 4, 5], specs: [["Game", "Pixel Catch, PXL-001"], ["Shell", "Navy plastic with grip ridges"], ["Players", "1 player, all ages"]], shots: ["On the desk", "Desk setup"], kinds: ["photo", "photo"] },
    gamebox: { price: "800", flavor: "A box you keep on the shelf long after the high score.", stats: [5, 4, 5, 4], specs: [["Size", "14 × 19.6 × 3.4 cm"], ["Print", "Matte-laminated card"], ["Inside", "Cartridge and a bonus sticker"]], shots: ["Retail box", "Back of the box"], kinds: ["photo", "render"] },
    handheld: { price: "3,500", flavor: "Pixel Catch in your pocket. Peach shell, navy screen, red buttons.", stats: [5, 4, 4, 5], specs: [["Screen", "8-bit colour display"], ["Body", "Peach plastic shell"], ["Controls", "D-pad, A and B, start, select"]], shots: ["Studio shot", "On the desk"], kinds: ["render", "render"] },
    phone: { price: "FREE", flavor: "Short pixel episodes built for the feed, one small frame at a time.", stats: [4, 3, 3, 5], specs: [["Format", "Vertical shorts, 9:16"], ["Length", "30 to 60 seconds"], ["Where", "Our social pages"]], shots: ["In your hand", "On the desk"], kinds: ["photo", "photo"] },
    episodes: { price: "FREE", flavor: "Every episode stars the Explorer and one spirit-animal friend.", stats: [5, 3, 4, 5], specs: [["Season", "1, four episodes"], ["Stars", "The Explorer and the spirit animals"], ["Rating", "All ages"]], shots: ["On the TV", "Living room"], kinds: ["photo", "render"] },
    tee: { price: "450", flavor: "Wear the mark. Big pixels, bigger W energy.", stats: [4, 4, 3, 4], specs: [["Fabric", "100% cotton, white or navy"], ["Print", "Screen-printed primary mark and tagline"], ["Fit", "Crew or V-neck, S to XL"]], shots: ["Crew-neck flat lay", "V-neck flat lay"], kinds: ["photo", "photo"] },
    tote: { price: "350", flavor: "Big enough for a whole sticker collection, and a snack.", stats: [4, 5, 3, 4], specs: [["Fabric", "Cream cotton canvas"], ["Print", "Pix L’s into W’s tagline"], ["Straps", "Red cotton webbing"]], shots: ["Flat lay", "On the wall peg"], kinds: ["photo", "render"] },
    cap: { price: "400", flavor: "One stitched patch. Instant main-character energy.", stats: [5, 4, 4, 4], specs: [["Colours", "White, or peach with a red brim"], ["Patch", "Embroidered secondary logo"], ["Fit", "Adjustable strap"]], shots: ["Worn", "Peach edition"], kinds: ["photo", "render"] },
  };
  const STAT_NAMES = ["STYLE", "DURABILITY", "COLLECTABILITY", "FUN"];
  const items = $$(".shop-item");
  const keys = items.map((item) => item.querySelector(".si-inspect").dataset.item);
  const stage = $("#id-stage"), photo = $("#id-photo"), cap = $("#id-cap"), thumbs = $("#id-thumbs");
  const wish = $("#id-wish");
  let wishlist = new Set();
  try { wishlist = new Set(JSON.parse(localStorage.getItem("pxl-wishlist") || "[]")); } catch { /* storage unavailable */ }
  let index = 0, view = 0, seen = new Set(), opener = null;

  function views(key) {
    const d = DATA[key];
    return [
      { src: `assets/shop/${key}-1.webp`, label: d.shots[0] },
      { src: `assets/shop/${key}-2.webp`, label: d.shots[1] },
    ];
  }
  function show(v, animate = true) {
    view = v;
    const key = keys[index];
    const list = views(key);
    const entry = list[v];
    stage.querySelector(".mock")?.remove();
    if (entry.mock) {
      photo.hidden = true;
      const art = items[index].querySelector(".mock").cloneNode(true);
      stage.prepend(art);
    } else {
      photo.hidden = false;
      photo.src = entry.src;
      photo.alt = `${items[index].querySelector("h4").textContent}, ${entry.label.toLowerCase()}`;
    }
    cap.textContent = `${String(v + 1).padStart(2, "0")} / ${list.length} · ${entry.label.toUpperCase()}`;
    $$(".id-thumb", thumbs).forEach((t, i) => t.setAttribute("aria-selected", String(i === v)));
    if (animate && hasGsap && !motionOff)
      gsap.fromTo(stage.querySelector(entry.mock ? ".mock" : "#id-photo"), { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out", clearProps: "opacity,scale" });
  }
  function fill(i, dir = 0) {
    index = (i + keys.length) % keys.length;
    const item = items[index], key = keys[index], d = DATA[key];
    const rarity = item.querySelector(".rarity");
    const r = rarity.className.match(/r-(\w+)/)?.[1] || "common";
    box.dataset.rarity = r;
    $("#id-no").textContent = String(index + 1).padStart(2, "0");
    $("#id-total").textContent = String(keys.length).padStart(2, "0");
    $("#id-cat").innerHTML = item.querySelector(".si-cat").innerHTML;
    const rb = $("#id-rarity"); rb.className = rarity.className; rb.innerHTML = rarity.innerHTML;
    $("#id-name").textContent = item.querySelector("h4").textContent;
    $("#id-desc").textContent = item.querySelector(".si-info p").textContent;
    $("#id-flavor").textContent = `“${d.flavor}”`;
    $("#id-stats").replaceChildren(...STAT_NAMES.map((name, s) => {
      const row = document.createElement("div");
      row.innerHTML = `<dt>${name}</dt><dd aria-label="${d.stats[s]} out of 5">${"<i></i>".repeat(5)}</dd><b>${d.stats[s]}</b>`;
      return row;
    }));
    $("#id-specs").replaceChildren(...d.specs.flatMap(([k, v]) => {
      const dt = document.createElement("dt"); dt.textContent = k.toUpperCase();
      const dd = document.createElement("dd"); dd.textContent = v;
      return [dt, dd];
    }));
    $("#id-price").textContent = d.price === "FREE" ? "FREE TO WATCH" : `◆ ${d.price}`;
    updateWish();
    thumbs.replaceChildren(...views(key).map((entry, v) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "id-thumb"; b.setAttribute("role", "tab");
      b.setAttribute("aria-label", `View ${entry.label}`);
      { const im = document.createElement("img"); im.src = entry.src.replace(".webp", "-sm.webp"); im.alt = ""; b.append(im); }
      const s = document.createElement("span"); s.textContent = DATA[key].kinds?.[v] === "photo" ? "PHOTO" : "3D RENDER"; b.append(s);
      b.addEventListener("click", () => { show(v); tone(880, 0.03); });
      return b;
    }));
    show(0, false);
    // warm the next photos so paging feels instant
    [index + 1, index - 1].forEach((n) => { const k = keys[(n + keys.length) % keys.length]; new Image().src = `assets/shop/${k}-1.webp`; });
    seen.add(key);
    if (seen.size >= 5) achieve("shopper");
    $$("#id-stats dd").forEach((dd, s) => $$("i", dd).forEach((cell, c) => cell.classList.toggle("on", c < d.stats[s])));
    if (hasGsap && !motionOff) {
      const tl = gsap.timeline();
      tl.fromTo(".id-viewer", { x: dir * 60, opacity: dir ? 0 : 1 }, { x: 0, opacity: 1, duration: 0.4, ease: "power3.out", clearProps: "transform,opacity" })
        .fromTo(".id-card > *", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, stagger: 0.04, ease: "power2.out", clearProps: "transform,opacity" }, 0.05)
        .fromTo("#id-stats dd i.on", { scaleX: 0 }, { scaleX: 1, duration: 0.18, stagger: 0.02, ease: "steps(3)", transformOrigin: "left center", clearProps: "transform" }, 0.15);
    }
  }
  function updateWish() {
    const on = wishlist.has(keys[index]);
    wish.setAttribute("aria-pressed", String(on));
    wish.textContent = on ? "♥ ON YOUR WISHLIST" : "♡ ADD TO WISHLIST";
  }
  function open(i, trigger) {
    opener = trigger;
    fill(i);
    box.showModal();
    document.body.classList.add("modal-open");
    $("#id-close").focus();
    chime([[523, 0, 0.05], [659, 70, 0.05], [784, 140, 0.09]]);
  }
  items.forEach((item, i) => item.querySelector(".si-inspect").addEventListener("click", (e) => open(i, e.currentTarget)));
  $("#id-prev").addEventListener("click", () => { fill(index - 1, -1); tone(520, 0.04); });
  $("#id-next").addEventListener("click", () => { fill(index + 1, 1); tone(620, 0.04); });
  $("#id-close").addEventListener("click", () => box.close());
  box.addEventListener("click", (e) => { if (e.target === box) box.close(); });
  box.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
    opener?.focus();
  });
  box.addEventListener("keydown", (e) => {
    if (e.target.closest("input, textarea")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); fill(index + 1, 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); fill(index - 1, -1); }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); show((view + 1) % 2); }
  });
  wish.addEventListener("click", () => {
    const k = keys[index];
    if (wishlist.has(k)) wishlist.delete(k); else { wishlist.add(k); chime([[784, 0, 0.05], [1047, 80, 0.1]]); }
    try { localStorage.setItem("pxl-wishlist", JSON.stringify([...wishlist])); } catch { /* storage unavailable */ }
    updateWish();
    toast(wishlist.has(k) ? `${$("#id-name").textContent} added to your wishlist.` : "Removed from your wishlist.");
  });
  // swipe between photos (touch)
  let sx = null;
  stage.addEventListener("touchstart", (e) => (sx = e.touches[0].clientX), { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (sx == null) return;
    const dx = e.changedTouches[0].clientX - sx; sx = null;
    if (Math.abs(dx) > 40) show((view + 1) % 2);
  });
  return { open };
})();

// ===== Scrollbar world tag: shows where you are while the thumb moves =====
(() => {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const tag = document.createElement("div");
  tag.className = "scroll-tag";
  tag.setAttribute("aria-hidden", "true");
  tag.innerHTML = "<b>00%</b><span></span>";
  document.body.append(tag);
  const pct = tag.querySelector("b");
  const name = tag.querySelector("span");
  const names = new Map($$(".world-map a[href^='#']").map((a) => [a.getAttribute("href").slice(1), a.textContent.trim()]));
  const stops = [...names.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  let hideTimer;
  let queued = false;
  function update() {
    queued = false;
    const root = document.documentElement;
    const max = root.scrollHeight - innerHeight;
    if (max <= 0) return;
    const p = Math.min(1, Math.max(0, scrollY / max));
    let current = stops[0];
    for (const el of stops) if (el.getBoundingClientRect().top <= innerHeight / 2) current = el;
    pct.textContent = `${String(Math.round(p * 100)).padStart(2, "0")}%`;
    name.textContent = (names.get(current?.id) || "").toUpperCase();
    const thumb = Math.max(64, (innerHeight / root.scrollHeight) * innerHeight);
    tag.style.top = `${p * (innerHeight - thumb) + thumb / 2 - 14}px`;
    tag.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => tag.classList.remove("show"), 900);
  }
  addEventListener(
    "scroll",
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
})();

// ===== PXL Sound Engine v2: a theme per world + sounds for every interaction =====
// Everything is synthesized live with the Web Audio API (no audio files).
// Silent until the visitor turns sound on with the speaker button.
const pxlSound = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return {};
  let ctx, master, sfxBus, musBus, muffle, echoIn, noiseBuf;
  const hz = (n) => 440 * 2 ** ((n - 69) / 12);

  function init() {
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    }
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = 0.9;
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1;
    musBus = ctx.createGain();
    musBus.gain.value = 0;
    muffle = ctx.createBiquadFilter();
    muffle.type = "lowpass";
    muffle.frequency.value = 16000;
    // a small slap-back echo used by the dreamier themes
    echoIn = ctx.createGain();
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.27;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    echoIn.connect(delay).connect(fb).connect(delay);
    delay.connect(wet).connect(musBus);
    musBus.connect(muffle).connect(master);
    sfxBus.connect(master);
    master.connect(comp).connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // ---------- voices ----------
  function blip({ f = 660, f2 = null, type = "square", dur = 0.08, vol = 0.03, at = 0, attack = 0.004, bus, echo = false }) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || sfxBus);
    if (echo) g.connect(echoIn);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  function hiss({ dur = 0.06, vol = 0.04, at = 0, hp = 4000, lp = 12000, sweep = null, bus }) {
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    const h = ctx.createBiquadFilter();
    h.type = "highpass";
    h.frequency.value = hp;
    const l = ctx.createBiquadFilter();
    l.type = "lowpass";
    l.frequency.setValueAtTime(lp, t);
    if (sweep) l.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(h).connect(l).connect(g).connect(bus || sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  // ---------- sound effects ----------
  const SFX = {
    hoverLink: () => blip({ f: 1320, type: "triangle", dur: 0.035, vol: 0.022 }),
    hoverButton: () => { blip({ f: 880, f2: 1180, type: "square", dur: 0.04, vol: 0.012 }); },
    hoverCard: () => { blip({ f: 520, f2: 780, type: "triangle", dur: 0.09, vol: 0.03 }); hiss({ dur: 0.05, vol: 0.008, hp: 6000 }); },
    hoverTile: () => { blip({ f: 1568, type: "square", dur: 0.03, vol: 0.01 }); blip({ f: 2093, type: "square", dur: 0.05, vol: 0.01, at: 0.03 }); },
    clickButton: () => { hiss({ dur: 0.025, vol: 0.05, hp: 2500 }); blip({ f: 660, f2: 990, type: "square", dur: 0.06, vol: 0.026 }); },
    clickLink: () => { blip({ f: 990, type: "square", dur: 0.04, vol: 0.02 }); blip({ f: 1480, type: "square", dur: 0.06, vol: 0.018, at: 0.04 }); },
    clickCard: () => { blip({ f: 392, type: "square", dur: 0.06, vol: 0.03 }); blip({ f: 587, type: "square", dur: 0.06, vol: 0.03, at: 0.05 }); blip({ f: 784, type: "square", dur: 0.12, vol: 0.03, at: 0.1 }); },
    nav: () => { blip({ f: 300, f2: 1600, type: "square", dur: 0.22, vol: 0.022 }); hiss({ dur: 0.22, vol: 0.02, hp: 1500, lp: 3000, sweep: 12000 }); },
    toggle: (on) => on
      ? (blip({ f: 523, type: "square", dur: 0.05, vol: 0.025 }), blip({ f: 784, type: "square", dur: 0.08, vol: 0.025, at: 0.05 }))
      : (blip({ f: 784, type: "square", dur: 0.05, vol: 0.025 }), blip({ f: 392, type: "square", dur: 0.08, vol: 0.025, at: 0.05 })),
    open: () => { hiss({ dur: 0.28, vol: 0.035, hp: 800, lp: 1500, sweep: 9000 }); [523, 659, 784, 1047].forEach((f, i) => blip({ f, type: "triangle", dur: 0.16, vol: 0.03, at: 0.04 + i * 0.05 })); },
    close: () => { hiss({ dur: 0.22, vol: 0.03, hp: 600, lp: 9000, sweep: 900 }); blip({ f: 784, f2: 330, type: "triangle", dur: 0.2, vol: 0.035 }); },
    type: () => { hiss({ dur: 0.018, vol: 0.03, hp: 5000 }); blip({ f: 1800 + Math.random() * 400, type: "square", dur: 0.012, vol: 0.006 }); },
    powerOn: () => [262, 330, 392, 523, 659, 784, 1047].forEach((f, i) => blip({ f, type: "square", dur: 0.09, vol: 0.022, at: i * 0.045 })),
    world: (i) => {
      const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
      const base = 60 + scale[i % scale.length];
      [0, 4, 7, 12].forEach((s, k) => blip({ f: hz(base + s), type: "square", dur: 0.08, vol: 0.016, at: k * 0.06, echo: true }));
    },
  };

  // ---------- music: one original loop per world ----------
  // lead: 32 eighth-notes (0 = rest). bass: 16 quarter-notes. drums: 16 chars per bar (k kick, s snare, h hat, .)
  const SONGS = {
    home: { title: "TITLE SCREEN", bpm: 132, wave: "square", bwave: "triangle", vol: 0.045,
      lead: [72, 76, 79, 84, 79, 76, 72, 76, 74, 77, 81, 86, 81, 77, 74, 77, 72, 76, 79, 84, 86, 84, 81, 79, 77, 76, 74, 71, 72, 0, 67, 0],
      bass: [48, 55, 48, 55, 50, 57, 50, 57, 48, 55, 45, 52, 43, 50, 43, 47], drums: "k.h.s.h.k.h.s.hh" },
    story: { title: "WORLD 1-1 · ADVENTURE", bpm: 120, wave: "square", bwave: "triangle", vol: 0.04,
      lead: [62, 0, 65, 67, 69, 0, 67, 65, 64, 0, 62, 60, 62, 0, 0, 0, 62, 0, 65, 67, 69, 72, 74, 72, 69, 0, 67, 64, 62, 0, 0, 0],
      bass: [38, 45, 38, 45, 36, 43, 36, 43, 41, 48, 41, 48, 43, 50, 45, 45], drums: "k...s...k.k.s..." },
    players: { title: "CHOOSE YOUR CLASS", bpm: 140, wave: "square", bwave: "triangle", vol: 0.04,
      lead: [67, 71, 74, 79, 74, 71, 67, 71, 69, 72, 76, 81, 76, 72, 69, 72, 71, 74, 79, 83, 79, 74, 71, 74, 72, 76, 79, 84, 83, 81, 79, 0],
      bass: [43, 50, 43, 50, 45, 52, 45, 52, 47, 54, 47, 54, 48, 55, 50, 50], drums: "k.hhs.h.k.hhs.hh" },
    universe: { title: "SELECT YOUR WORLD", bpm: 96, wave: "triangle", bwave: "sine", vol: 0.06, echo: true,
      lead: [69, 72, 76, 79, 76, 72, 0, 0, 65, 69, 72, 76, 72, 69, 0, 0, 67, 71, 74, 79, 74, 71, 0, 0, 64, 67, 71, 76, 74, 71, 67, 0],
      bass: [45, 0, 45, 0, 41, 0, 41, 0, 43, 0, 43, 0, 40, 0, 40, 0], drums: "....h.......h..." },
    shop: { title: "ITEM SHOP", bpm: 150, wave: "square", bwave: "triangle", vol: 0.04,
      lead: [77, 0, 81, 0, 84, 81, 77, 0, 79, 0, 82, 0, 86, 82, 79, 0, 77, 0, 81, 0, 84, 86, 88, 84, 81, 0, 79, 0, 77, 0, 0, 0],
      bass: [41, 48, 41, 48, 46, 53, 46, 53, 41, 48, 45, 48, 43, 48, 41, 41], drums: "k.h.s.h.k.h.s.h." },
    rivals: { title: "BOSS RUSH", bpm: 168, wave: "sawtooth", bwave: "square", vol: 0.028,
      lead: [64, 64, 67, 64, 70, 69, 67, 64, 64, 64, 67, 64, 71, 70, 69, 67, 64, 0, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66, 65, 64, 0],
      bass: [40, 40, 40, 40, 43, 43, 46, 45, 40, 40, 40, 40, 47, 46, 45, 43], drums: "k.kks.k.k.kks.ss" },
    bonus: { title: "BONUS STAGE", bpm: 160, wave: "square", bwave: "triangle", vol: 0.038,
      lead: [72, 76, 79, 76, 72, 76, 79, 84, 74, 77, 81, 77, 74, 77, 81, 86, 76, 79, 83, 79, 76, 79, 83, 88, 84, 83, 81, 79, 77, 76, 74, 72],
      bass: [48, 48, 50, 50, 52, 52, 53, 53, 48, 48, 50, 50, 55, 55, 43, 43], drums: "khs.khs.khs.khsh" },
    identity: { title: "BRAND LAB", bpm: 112, wave: "triangle", bwave: "triangle", vol: 0.055, echo: true,
      lead: [72, 0, 74, 76, 0, 79, 0, 76, 74, 0, 72, 0, 69, 0, 0, 0, 71, 0, 72, 74, 0, 77, 0, 74, 72, 0, 71, 0, 67, 0, 0, 0],
      bass: [48, 52, 55, 52, 45, 48, 52, 48, 43, 47, 50, 47, 41, 45, 48, 43], drums: "k...s..hk..hs..." },
    campaigns: { title: "OUT IN THE WORLD", bpm: 126, wave: "square", bwave: "triangle", vol: 0.038,
      lead: [69, 0, 69, 72, 74, 0, 72, 69, 67, 0, 67, 69, 72, 0, 0, 0, 69, 0, 69, 72, 74, 76, 77, 76, 74, 72, 69, 67, 69, 0, 0, 0],
      bass: [45, 52, 45, 52, 41, 48, 41, 48, 43, 50, 43, 50, 45, 52, 45, 44], drums: "k.h.s.hkk.h.s.h." },
    team: { title: "PLAYER SELECT", bpm: 136, wave: "square", bwave: "triangle", vol: 0.04,
      lead: [76, 79, 83, 0, 81, 79, 76, 0, 74, 76, 79, 0, 78, 76, 74, 0, 72, 76, 79, 84, 83, 79, 76, 72, 74, 0, 79, 0, 76, 0, 0, 0],
      bass: [40, 47, 40, 47, 38, 45, 38, 45, 36, 43, 36, 43, 38, 45, 43, 43], drums: "k.h.s.h.k.hhs.h." },
    end: { title: "CREDITS", bpm: 84, wave: "triangle", bwave: "sine", vol: 0.06, echo: true,
      lead: [72, 0, 0, 76, 79, 0, 0, 0, 77, 0, 0, 74, 76, 0, 0, 0, 72, 0, 0, 69, 71, 0, 72, 74, 72, 0, 0, 0, 0, 0, 0, 0],
      bass: [48, 0, 55, 0, 45, 0, 52, 0, 41, 0, 48, 0, 43, 0, 47, 0], drums: "k.......s......." },
  };
  const order = ["home", "story", "players", "universe", "shop", "rivals", "bonus", "identity", "campaigns", "team", "end"];
  let song = SONGS.home, pending = null, step = 0, next = 0, timer = null, playing = false, currentKey = "home";

  function drum(ch, t) {
    const at = t - ctx.currentTime;
    if (ch === "k") blip({ f: 150, f2: 40, type: "sine", dur: 0.14, vol: 0.22, at, bus: musBus });
    if (ch === "s") { hiss({ dur: 0.12, vol: 0.09, hp: 1200, lp: 8000, at, bus: musBus }); blip({ f: 220, f2: 140, type: "triangle", dur: 0.06, vol: 0.05, at, bus: musBus }); }
    if (ch === "h") hiss({ dur: 0.03, vol: 0.035, hp: 7000, at, bus: musBus });
  }
  function tick() {
    const eighth = 60 / song.bpm / 2;
    while (next < ctx.currentTime + 0.2) {
      if (pending && step % 16 === 0) {
        song = pending;
        pending = null;
        step = 0;
      }
      const at = next - ctx.currentTime;
      const s = step % 32;
      const n = song.lead[s];
      if (n) blip({ f: hz(n), type: song.wave, dur: eighth * 0.9, vol: song.vol, at, attack: 0.006, bus: musBus, echo: song.echo });
      if (s % 2 === 0) {
        const b = song.bass[(s / 2) % 16];
        if (b) blip({ f: hz(b), type: song.bwave, dur: eighth * 1.8, vol: 0.11, at, attack: 0.008, bus: musBus });
      }
      const d = song.drums[step % 16];
      if (d && d !== ".") drum(d, next);
      next += eighth;
      step += 1;
    }
  }
  const chip = document.createElement("div");
  chip.className = "now-playing";
  chip.setAttribute("aria-live", "polite");
  document.body.append(chip);
  let chipTimer;
  function announce(s) {
    chip.innerHTML = `<i aria-hidden="true"><b></b><b></b><b></b></i><span>NOW PLAYING</span><strong></strong>`;
    chip.querySelector("strong").textContent = s.title;
    chip.classList.add("show");
    clearTimeout(chipTimer);
    chipTimer = setTimeout(() => chip.classList.remove("show"), 2600);
  }
  function setWorld(key) {
    if (!SONGS[key] || key === currentKey) return;
    currentKey = key;
    if (!playing) return;
    pending = SONGS[key];
    SFX.world(order.indexOf(key));
    announce(SONGS[key]);
  }
  function music(on) {
    if (!on) {
      playing = false;
      clearInterval(timer);
      timer = null;
      if (ctx) musBus.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      chip.classList.remove("show");
      return;
    }
    init();
    playing = true;
    song = SONGS[currentKey] || SONGS.home;
    pending = null;
    step = 0;
    next = ctx.currentTime + 0.12;
    musBus.gain.setTargetAtTime(0.32, ctx.currentTime, 0.1);
    clearInterval(timer);
    timer = setInterval(tick, 50);
    announce(song);
  }
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (soundOn) ctx.resume();
  });

  // ---------- which world are we in? ----------
  const stops = order.map((id) => document.getElementById(id) || $(`[data-world="${id}"]`)?.closest("section")).map((el, i) => [order[i], el]).filter(([, el]) => el);
  let worldQueued = false;
  addEventListener("scroll", () => {
    if (worldQueued) return;
    worldQueued = true;
    requestAnimationFrame(() => {
      worldQueued = false;
      let key = "home";
      for (const [k, el] of stops) if (el.getBoundingClientRect().top <= innerHeight * 0.45) key = k;
      setWorld(key);
    });
  }, { passive: true });

  // ---------- interaction sounds ----------
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const KIND = [
    [".shop-item .si-inspect, .player-card, .boss, .class-card, .stage-node, .feed-post", "card"],
    [".boss-sig li, .id-thumb, .swatch, .cart-swatch, .lab-strip button, .bg-switch button", "tile"],
    [".world-map a, nav a, .site-nav a", "nav"],
    ["button, [role='button'], summary, .button, input[type='range'], select", "button"],
    ["a[href]", "link"],
  ];
  function kindOf(el) {
    for (const [sel, kind] of KIND) {
      const hit = el.closest(sel);
      if (hit) return [hit, kind];
    }
    return [null, null];
  }
  let lastHover = null, lastHoverAt = 0;
  document.addEventListener("pointerover", (e) => {
    if (!soundOn || !fine.matches || !ctx) return;
    const [el, kind] = kindOf(e.target);
    if (!el || el === lastHover) return;
    lastHover = el;
    const now = performance.now();
    if (now - lastHoverAt < 45) return;
    lastHoverAt = now;
    ({ card: SFX.hoverCard, tile: SFX.hoverTile, nav: SFX.hoverLink, button: SFX.hoverButton, link: SFX.hoverLink })[kind]();
  });
  document.addEventListener("pointerout", (e) => {
    if (lastHover && !lastHover.contains(e.relatedTarget)) lastHover = null;
  });
  document.addEventListener("pointerdown", (e) => {
    if (!soundOn || e.button > 0) return;
    if (e.target.closest("#sound-toggle, canvas, .battle")) return;
    init();
    const [el, kind] = kindOf(e.target);
    if (!el) return;
    ({ card: SFX.clickCard, tile: SFX.clickLink, nav: SFX.nav, button: SFX.clickButton, link: SFX.clickLink })[kind]();
  });
  document.addEventListener("keydown", (e) => {
    if (!soundOn || !ctx) return;
    if (e.target.matches?.("input[type='text'], input:not([type]), textarea") && e.key.length === 1) SFX.type();
  });
  // dialogs: whoosh open/closed and muffle the music underneath
  $$("dialog").forEach((d) =>
    new MutationObserver(() => {
      if (!ctx) return;
      const anyOpen = $$("dialog").some((x) => x.open);
      muffle.frequency.setTargetAtTime(anyOpen ? 900 : 16000, ctx.currentTime, 0.12);
      if (!soundOn) return;
      if (d.open) SFX.open();
      else SFX.close();
    }).observe(d, { attributes: true, attributeFilter: ["open"] }),
  );
  $("#motion-toggle")?.addEventListener("click", () => soundOn && SFX.toggle(!motionOff));
  $("#sound-toggle").addEventListener("click", () => {
    if (soundOn) {
      init();
      SFX.powerOn();
    }
  });

  return { init, blip, hiss, SFX, music, setWorld };
})();

// Route the site's older beeps through the new engine (richer envelope, mixed with the music).
tone = function (frequency = 660, duration = 0.08) {
  if (!soundOn || !pxlSound.blip) return;
  pxlSound.init();
  pxlSound.blip({ f: frequency, type: "square", dur: duration, vol: 0.024 });
};
pxlMusic = function (on) {
  pxlSound.music?.(on);
};
