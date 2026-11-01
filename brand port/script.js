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
  sectionFrames.forEach(({ layers, progress }) => {
    layers.forEach(({ element, x, y }) => {
      element.style.setProperty(
        "--parallax-x",
        `${(progress * x * travelScale).toFixed(2)}px`,
      );
      element.style.setProperty(
        "--parallax-y",
        `${(progress * y * travelScale).toFixed(2)}px`,
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

const grid = $("#pixel-grid");
const cells = [];
let paint = "#FFB65D";
let drawing = false;
for (let row = 0; row < 16; row++) {
  const rowElement = document.createElement("div");
  rowElement.setAttribute("role", "row");
  for (let column = 0; column < 16; column++) {
    const cell = document.createElement("button");
    cell.className = "pixel-cell";
    cell.setAttribute("role", "gridcell");
    cell.setAttribute(
      "aria-label",
      `Row ${row + 1}, column ${column + 1}: blank`,
    );
    cell.dataset.index = String(row * 16 + column);
    cell.tabIndex = row === 0 && column === 0 ? 0 : -1;
    cells.push(cell);
    rowElement.append(cell);
  }
  grid.append(rowElement);
}
// An original starter smile gives visitors something to make their own.
const starter = [
  [5, 5],
  [6, 5],
  [9, 5],
  [10, 5],
  [5, 6],
  [6, 6],
  [9, 6],
  [10, 6],
  [4, 9],
  [5, 10],
  [6, 11],
  [7, 11],
  [8, 11],
  [9, 11],
  [10, 10],
  [11, 9],
];
starter.forEach(([x, y]) => {
  cells[y * 16 + x].dataset.color = "#001768";
  cells[y * 16 + x].style.setProperty("--cell", "#001768");
  cells[y * 16 + x].setAttribute(
    "aria-label",
    `Row ${y + 1}, column ${x + 1}: navy`,
  );
});
function paintCell(cell) {
  if (!cell?.classList.contains("pixel-cell")) return;
  cell.dataset.color = paint;
  cell.style.setProperty("--cell", paint || "#fff0d6");
  const index = Number(cell.dataset.index);
  const names = {
    "#FFB65D": "peach",
    "#BE3621": "red",
    "#001768": "navy",
    "": "blank",
  };
  cell.setAttribute(
    "aria-label",
    `Row ${Math.floor(index / 16) + 1}, column ${(index % 16) + 1}: ${names[paint] || paint}`,
  );
}
grid.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  drawing = true;
  paintCell(event.target);
  event.preventDefault();
});
grid.addEventListener("pointermove", (event) => {
  if (drawing)
    paintCell(document.elementFromPoint(event.clientX, event.clientY));
});
window.addEventListener("pointerup", () => {
  drawing = false;
});
window.addEventListener("pointercancel", () => {
  drawing = false;
});
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
    paintCell(cell);
    return;
  } else return;
  event.preventDefault();
  cell.tabIndex = -1;
  cells[next].tabIndex = 0;
  cells[next].focus();
});
$$("[data-paint]").forEach((button) =>
  button.addEventListener("click", () => {
    paint = button.dataset.paint;
    $$("[data-paint]").forEach((other) => {
      other.classList.toggle("selected", other === button);
      other.setAttribute("aria-pressed", String(other === button));
    });
    $("#erase").setAttribute("aria-pressed", "false");
  }),
);
$("#erase").addEventListener("click", () => {
  paint = "";
  $$("[data-paint]").forEach((button) => {
    button.classList.remove("selected");
    button.setAttribute("aria-pressed", "false");
  });
  $("#erase").setAttribute("aria-pressed", "true");
});
$("#clear-art").addEventListener("click", () => {
  const previous = paint;
  paint = "";
  cells.forEach(paintCell);
  paint = previous;
  toast("A fresh canvas. Your next idea starts here.");
});
$("#save-art").addEventListener("click", () => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  cells.forEach((cell, index) => {
    context.fillStyle = cell.dataset.color || "#fff0d6";
    context.fillRect((index % 16) * 32, Math.floor(index / 16) * 32, 32, 32);
  });
  const link = document.createElement("a");
  link.download = "my-pxl-art.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
  toast("Your pixel art is ready to keep.");
});

const dialog = $("#detail-dialog");
const assets = {
  "logo-details": [
    "LOGO DEVELOPMENT / ORIGINAL DRAFTS",
    "assets/logo-process.png",
    "Original PXL logo development board",
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
      $("#dialog-title").textContent = "PXL / ART & COLLECTIBLE CONCEPTS";
      const art = $(".product-art").cloneNode(true);
      content.append(art);
      const heading = document.createElement("h3");
      heading.textContent = "Little objects. XL imagination.";
      content.append(heading);
      const paragraph = document.createElement("p");
      paragraph.textContent =
        "The Explorer and The Daydreamer are original visual concepts made for this website. They illustrate PXL’s pixel illustration and collectible direction; they are not released products or items for sale.";
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
