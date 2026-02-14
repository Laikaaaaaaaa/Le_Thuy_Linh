const page = document.getElementById("page");
const audio = document.getElementById("bg-music");
const musicToggle = document.getElementById("music-toggle");
const musicText = musicToggle?.querySelector(".music-text") || null;
const sparklesLayer = document.getElementById("sparkles-layer");
const meteorsLayer = document.getElementById("meteors-layer");
const trailLayer = document.getElementById("trail-layer");
const heartsBack = document.getElementById("hearts-layer-back");
const heartsFront = document.getElementById("hearts-layer-front");
const clickBurstLayer = document.getElementById("click-burst-layer");
const fireworksLayer = document.getElementById("fireworks-layer");
const cursorGlow = document.getElementById("cursor-glow");
const finalMessage = document.getElementById("final-message");
const loveButton = document.getElementById("love-btn");
const memoryTimeline = document.getElementById("memory-timeline");
const letterCard = document.getElementById("letter-card");
const memoryTextList = Array.from(document.querySelectorAll("#memory-texts li"));

const splitTargets = document.querySelectorAll(".split-chars");
const typingTarget = document.querySelector(".typing");
const letterLines = document.querySelectorAll(".letter-line");
const checkboxes = document.querySelectorAll(".future-check");

let audioReady = false;
let autoplayAttempted = false;
let playlistIndex = 0;
let autoUnmuteArmed = false;
let autoplayRetryTimer = null;
let autoplayRetryCount = 0;
let letterTypingStarted = false;
let userPausedMusic = false;
const mediaCache = new Map();
let lastGlobalBurstAt = 0;
let lastLoveClickAt = 0;
let celebrationRunning = false;

const EFFECT_LIMITS = {
  clickHearts: 140,
  fireworks: 180,
  trailHearts: 80,
};

const fallbackTracks = (audio?.dataset?.tracks || "")
  .split("|")
  .map((track) => track.trim())
  .filter(Boolean);
let playlist = [...fallbackTracks];

const videoExtensions = ["mp4", "webm", "mov"];

function on(target, eventName, handler, options) {
  if (!target) return;
  target.addEventListener(eventName, handler, options);
}

function appendWithLimit(layer, node, limit) {
  if (!layer) return false;
  if (layer.childElementCount >= limit) {
    layer.removeChild(layer.firstElementChild);
  }
  layer.appendChild(node);
  return true;
}

function getMemoryTextByIndex(index) {
  const text = memoryTextList[index - 1]?.textContent?.trim();
  if (text) return text;
  return `Nội dung ảnh ${index}`;
}

function getExtensionFromPath(path) {
  const clean = path.split("?")[0].split("#")[0];
  const dotIndex = clean.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return clean.slice(dotIndex + 1).toLowerCase();
}

async function discoverMusicTracks() {
  try {
    const response = await fetch("/api/music", { cache: "no-store" });
    if (!response.ok) return [...fallbackTracks];
    const payload = await response.json();
    if (!Array.isArray(payload)) return [...fallbackTracks];

    const tracks = payload
      .map((item) => (typeof item?.url === "string" ? item.url.trim() : ""))
      .filter(Boolean);

    if (tracks.length) return tracks;
    return [...fallbackTracks];
  } catch (error) {
    return [...fallbackTracks];
  }
}

async function discoverFolderMedia(folderIndex) {
  try {
    const response = await fetch(`/api/media/${folderIndex}`, { cache: "no-store" });
    if (!response.ok) return [];
    const payload = await response.json();
    if (!Array.isArray(payload)) return [];

    return payload
      .map((item) => {
        const url = typeof item?.url === "string" ? item.url.trim() : "";
        let type = typeof item?.type === "string" ? item.type.trim().toLowerCase() : "";
        if (!url) return null;
        if (type !== "image" && type !== "video") {
          const ext = getExtensionFromPath(url);
          type = videoExtensions.includes(ext) ? "video" : "image";
        }
        return { url, type };
      })
      .filter(Boolean);
  } catch (error) {
    return [];
  }
}

/* ── Build stacked collage (paper pile style) ── */
function buildCollage(mediaList, folderIndex) {
  const collage = document.createElement("div");
  collage.className = "gallery-collage";
  collage.dataset.folder = folderIndex;

  const count = mediaList.length;
  if (count === 0) {
    collage.classList.add("gallery-empty");
    collage.innerHTML = `<div class="gallery-placeholder">Chưa có ảnh/video</div>`;
    return collage;
  }

  const showCount = Math.min(count, 3);
  for (let i = 0; i < showCount; i += 1) {
    const item = mediaList[i];
    const cell = document.createElement("div");
    cell.className = "gallery-cell";
    cell.style.setProperty("--stack-x", `${i * 15}px`);
    cell.style.setProperty("--stack-y", `${i * 11}px`);
    cell.style.setProperty("--stack-r", `${i % 2 === 0 ? -2 + i : 2 - i}deg`);
    cell.style.zIndex = `${showCount - i}`;

    if (item.type === "video") {
      const vid = document.createElement("video");
      vid.src = item.url;
      vid.muted = true;
      vid.autoplay = false;
      vid.loop = false;
      vid.preload = "none";
      vid.playsInline = true;
      vid.className = "gallery-thumb";
      const playIcon = document.createElement("span");
      playIcon.className = "gallery-play-icon";
      playIcon.textContent = "▶";
      cell.appendChild(vid);
      cell.appendChild(playIcon);
    } else {
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = `Kỷ niệm ${folderIndex}`;
      img.loading = "lazy";
      img.className = "gallery-thumb";
      cell.appendChild(img);
    }

    if (i === showCount - 1 && count > showCount) {
      const overlay = document.createElement("span");
      overlay.className = "gallery-more";
      overlay.textContent = `+${count - showCount}`;
      cell.appendChild(overlay);
    }

    collage.appendChild(cell);
  }

  collage.addEventListener("click", () => openLightbox(mediaList, 0));

  return collage;
}

async function getMediaListCached(folderIndex) {
  if (mediaCache.has(folderIndex)) {
    return mediaCache.get(folderIndex);
  }

  const mediaList = await discoverFolderMedia(folderIndex);
  mediaCache.set(folderIndex, mediaList);
  return mediaList;
}

async function renderTimelineCover(galleryWrap, folderIndex) {
  if (!galleryWrap || galleryWrap.dataset.loaded === "1") return;
  galleryWrap.dataset.loaded = "1";

  const mediaList = await getMediaListCached(folderIndex);
  const coverList = mediaList.slice(0, 3);
  galleryWrap.innerHTML = "";
  const collage = buildCollage(mediaList.length > 3 ? [...coverList, ...mediaList.slice(3)] : coverList, folderIndex);
  galleryWrap.appendChild(collage);
}

/* ── Lightbox ── */
let lightboxMediaList = [];
let lightboxIndex = 0;

function getLightboxElements() {
  return {
    overlay: document.getElementById("lightbox-overlay"),
    content: document.getElementById("lightbox-content"),
    counter: document.getElementById("lightbox-counter"),
    prevBtn: document.getElementById("lightbox-prev"),
    nextBtn: document.getElementById("lightbox-next"),
  };
}

function openLightbox(mediaList, startIndex) {
  lightboxMediaList = mediaList;
  lightboxIndex = startIndex;
  const lb = getLightboxElements();
  if (!lb.overlay || !lb.content || !lb.counter || !lb.prevBtn || !lb.nextBtn) return;
  lb.overlay.classList.add("active");
  document.body.style.overflow = "hidden";
  renderLightboxSlide();
}

function closeLightbox() {
  const lb = getLightboxElements();
  if (!lb.overlay || !lb.content) return;
  lb.overlay.classList.remove("active");
  document.body.style.overflow = "";
  const vid = lb.content.querySelector("video");
  if (vid) vid.pause();
  lb.content.innerHTML = "";
}

function renderLightboxSlide() {
  const lb = getLightboxElements();
  if (!lb.content || !lb.counter || !lb.prevBtn || !lb.nextBtn) return;
  const vid = lb.content.querySelector("video");
  if (vid) vid.pause();
  lb.content.innerHTML = "";

  const item = lightboxMediaList[lightboxIndex];
  if (!item) return;

  if (item.type === "video") {
    const video = document.createElement("video");
    video.src = item.url;
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    video.className = "lightbox-media";
    lb.content.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = "Ảnh kỷ niệm";
    img.className = "lightbox-media";
    lb.content.appendChild(img);
  }

  lb.counter.textContent = `${lightboxIndex + 1} / ${lightboxMediaList.length}`;
  lb.prevBtn.style.display = lightboxMediaList.length > 1 ? "" : "none";
  lb.nextBtn.style.display = lightboxMediaList.length > 1 ? "" : "none";
}

function lightboxPrev() {
  lightboxIndex = (lightboxIndex - 1 + lightboxMediaList.length) % lightboxMediaList.length;
  renderLightboxSlide();
}

function lightboxNext() {
  lightboxIndex = (lightboxIndex + 1) % lightboxMediaList.length;
  renderLightboxSlide();
}

function initLightbox() {
  const lb = getLightboxElements();
  const closeButton = document.getElementById("lightbox-close");
  if (!lb.overlay || !lb.prevBtn || !lb.nextBtn || !closeButton) return;

  on(lb.overlay, "click", (e) => {
    if (e.target === lb.overlay || e.target.id === "lightbox-close") closeLightbox();
  });
  on(closeButton, "click", closeLightbox);
  on(lb.prevBtn, "click", (e) => { e.stopPropagation(); lightboxPrev(); });
  on(lb.nextBtn, "click", (e) => { e.stopPropagation(); lightboxNext(); });

  document.addEventListener("keydown", (e) => {
    if (!lb.overlay.classList.contains("active")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") lightboxPrev();
    if (e.key === "ArrowRight") lightboxNext();
  });
}

/* ── Build full timeline ── */
async function buildMemoryTimeline(total = 20) {
  if (!memoryTimeline) return;
  memoryTimeline.innerHTML = "";
  mediaCache.clear();

  const visibleLimit = Math.min(total, 10);
  const rows = [];
  for (let index = 1; index <= visibleLimit; index += 1) {
    const row = document.createElement("article");
    row.className = "memory-row reveal-item";

    const galleryWrap = document.createElement("div");
    galleryWrap.className = "memory-gallery-wrap";

    const loadingEl = document.createElement("div");
    loadingEl.className = "gallery-loading";
    loadingEl.textContent = "Đang tải...";
    galleryWrap.appendChild(loadingEl);

    const marker = document.createElement("span");
    marker.className = "memory-marker";
    marker.textContent = "❤";

    const content = document.createElement("div");
    content.className = "memory-content";
    content.textContent = getMemoryTextByIndex(index);

    row.appendChild(galleryWrap);
    row.appendChild(marker);
    row.appendChild(content);
    memoryTimeline.appendChild(row);
    rows.push({ row, galleryWrap, index });
  }

  if (total > visibleLimit) {
    const futureRow = document.createElement("article");
    futureRow.className = "memory-row memory-row-future reveal-item";

    const futureNote = document.createElement("div");
    futureNote.className = "memory-future-note";
    futureNote.textContent = "Viết tiếp câu chuyện sau này, còn tiếp...";

    futureRow.appendChild(futureNote);
    memoryTimeline.appendChild(futureRow);
  }

  if (!("IntersectionObserver" in window)) {
    for (const { galleryWrap, index } of rows) {
      await renderTimelineCover(galleryWrap, index);
    }
    return;
  }

  const coverObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const index = Number(entry.target.dataset.folderIndex || "0");
        if (!index) return;

        renderTimelineCover(entry.target, index);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: "240px 0px" }
  );

  rows.forEach(({ galleryWrap, index }) => {
    galleryWrap.dataset.folderIndex = String(index);
    coverObserver.observe(galleryWrap);
  });
}

function splitTextToChars() {
  splitTargets.forEach((target) => {
    const text = target.textContent;
    target.textContent = "";

    [...text].forEach((char, index) => {
      const span = document.createElement("span");
      span.className = "char";
      span.style.animationDelay = `${index * 0.045 + 0.15}s`;
      span.textContent = char === " " ? "\u00A0" : char;
      target.appendChild(span);
    });
  });
}

function forceScrollTopOnReload() {
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  window.scrollTo(0, 0);
  window.addEventListener("load", () => {
    window.scrollTo(0, 0);
    setTimeout(() => window.scrollTo(0, 0), 30);
  });

  window.addEventListener("beforeunload", () => {
    window.scrollTo(0, 0);
  });
}

function runTyping() {
  if (!typingTarget) return;
  const text = typingTarget.dataset.text || "";
  const chars = [...text];
  let i = 0;
  typingTarget.classList.add("typing-cursor");

  const timer = setInterval(() => {
    typingTarget.textContent += chars[i] || "";
    i += 1;
    if (i >= chars.length) {
      clearInterval(timer);
      typingTarget.classList.remove("typing-cursor");
    }
  }, 42);
}

function shouldReduceEffects() {
  return window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function prepareLetterTyping() {
  letterLines.forEach((line) => {
    const text = (line.dataset.fullText || line.textContent || "").trim();
    line.dataset.fullText = text;
    line.textContent = "";
  });
}

function typeLineFast(line, text, speed = 11, chunkSize = 2) {
  return new Promise((resolve) => {
    if (!text) {
      resolve();
      return;
    }

    const chars = [...text];
    let pointer = 0;
    line.classList.add("typing-cursor-line");

    const timer = setInterval(() => {
      const next = chars.slice(pointer, pointer + chunkSize).join("");
      line.textContent += next;
      pointer += chunkSize;

      if (pointer >= chars.length) {
        clearInterval(timer);
        line.classList.remove("typing-cursor-line");
        resolve();
      }
    }, speed);
  });
}

async function runLetterTypingFast() {
  if (letterTypingStarted || !letterLines.length) return;
  letterTypingStarted = true;

  if (letterCard) {
    letterCard.classList.add("typing-active");
  }

  for (let index = 0; index < letterLines.length; index += 1) {
    const line = letterLines[index];
    const text = line.dataset.fullText || "";
    line.style.opacity = "1";
    line.style.transform = "translateY(0)";
    await typeLineFast(line, text, 11, 2);
    await new Promise((resolve) => setTimeout(resolve, 48));
  }

  if (letterCard) {
    letterCard.classList.remove("typing-active");
  }
}

function createFloatingHearts(layer, count, minDuration, maxDuration, front = false) {
  if (!layer) return;
  for (let i = 0; i < count; i += 1) {
    const heart = document.createElement("span");
    heart.className = "floating-heart";
    heart.textContent = "❤";

    const size = Math.random() * (front ? 18 : 14) + (front ? 10 : 8);
    const duration = Math.random() * (maxDuration - minDuration) + minDuration;
    const delay = Math.random() * -duration;
    const left = Math.random() * 100;
    const drift = Math.random() * 180 - 90;

    heart.style.left = `${left}%`;
    heart.style.bottom = `${Math.random() * -100}px`;
    heart.style.fontSize = `${size}px`;
    heart.style.opacity = `${Math.random() * 0.5 + 0.2}`;
    heart.style.animationDuration = `${duration}s`;
    heart.style.animationDelay = `${delay}s`;
    heart.style.setProperty("--drift", `${drift}px`);

    layer.appendChild(heart);
  }
}

function createSparkles(count) {
  if (!sparklesLayer) return;
  for (let i = 0; i < count; i += 1) {
    const sparkle = document.createElement("span");
    sparkle.className = "floating-sparkle";

    const size = Math.random() * 6 + 3;
    sparkle.style.width = `${size}px`;
    sparkle.style.height = `${size}px`;
    sparkle.style.left = `${Math.random() * 100}%`;
    sparkle.style.top = `${Math.random() * 100}%`;
    sparkle.style.opacity = `${Math.random() * 0.5 + 0.2}`;
    sparkle.style.animationDuration = `${Math.random() * 8 + 5}s`;
    sparkle.style.animationDelay = `${Math.random() * -9}s`;

    sparklesLayer.appendChild(sparkle);
  }
}

function createMeteors(count) {
  if (!meteorsLayer) return;
  for (let i = 0; i < count; i += 1) {
    const meteor = document.createElement("span");
    meteor.className = "meteor";
    meteor.style.left = `${Math.random() * 110}%`;
    meteor.style.top = `${Math.random() * 35 - 22}%`;
    meteor.style.setProperty("--duration", `${Math.random() * 8 + 7}s`);
    meteor.style.setProperty("--delay", `${Math.random() * -15}s`);
    meteor.style.setProperty("--size", `${Math.random() * 2.5 + 1.2}px`);
    meteorsLayer.appendChild(meteor);
  }
}

function revealOnScroll() {
  const revealBlocks = document.querySelectorAll(".reveal");
  const revealItems = document.querySelectorAll(".reveal-item");

  if (!("IntersectionObserver" in window)) {
    revealBlocks.forEach((el) => el.classList.add("visible"));
    revealItems.forEach((el) => el.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.2,
      rootMargin: "0px 0px -7% 0px"
    }
  );

  revealBlocks.forEach((el) => observer.observe(el));

  const childObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          childObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.22, rootMargin: "0px 0px -8% 0px" }
  );

  let memoryDelayIndex = 0;
  revealItems.forEach((el, index) => {
    if (el.classList.contains("memory-row")) {
      el.style.transitionDelay = `${memoryDelayIndex * 90}ms`;
      memoryDelayIndex += 1;
    } else {
      el.style.transitionDelay = `${index % 5 * 70}ms`;
    }
    childObserver.observe(el);
  });

  setTimeout(() => {
    revealBlocks.forEach((el) => el.classList.add("visible"));
    revealItems.forEach((el) => {
      if (el.classList.contains("visible")) return;
      const rect = el.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.95) {
        el.classList.add("visible");
      }
    });
  }, 2800);

  const letterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          runLetterTypingFast();
          letterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.45 }
  );

  if (letterCard) letterObserver.observe(letterCard);
}

function handleParallax() {
  let ticking = false;

  const update = () => {
    const y = window.scrollY;
    document.documentElement.style.setProperty("--parallax", `${y}px`);
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  });
}

function initCursorGlow() {
  if (!cursorGlow) return;
  if (shouldReduceEffects()) return;

  window.addEventListener("pointermove", (event) => {
    cursorGlow.style.left = `${event.clientX}px`;
    cursorGlow.style.top = `${event.clientY}px`;
    document.body.classList.add("pointer-active");
  });

  window.addEventListener("pointerleave", () => {
    document.body.classList.remove("pointer-active");
  });
}

function initPointerTrail() {
  if (shouldReduceEffects()) return;
  if (!trailLayer) return;
  let lastTime = 0;

  window.addEventListener("pointermove", (event) => {
    const now = performance.now();
    if (now - lastTime < 90) return;
    lastTime = now;

    const heart = document.createElement("span");
    heart.className = "trail-heart";
    heart.textContent = Math.random() > 0.35 ? "❤" : "✦";
    heart.style.left = `${event.clientX}px`;
    heart.style.top = `${event.clientY}px`;
    heart.style.fontSize = `${Math.random() * 8 + 10}px`;
    appendWithLimit(trailLayer, heart, EFFECT_LIMITS.trailHearts);
    heart.addEventListener("animationend", () => heart.remove());
  });
}

function initMemoryTilt() {
  const galleryWraps = document.querySelectorAll(".memory-gallery-wrap");

  galleryWraps.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const ry = (px - 0.5) * 7;
      const rx = (0.5 - py) * 6;
      card.style.setProperty("--rx", `${rx}deg`);
      card.style.setProperty("--ry", `${ry}deg`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });
}

function burstHearts(x, y, amount = 18, spread = 140) {
  if (!clickBurstLayer) return;
  const available = Math.max(0, EFFECT_LIMITS.clickHearts - clickBurstLayer.childElementCount);
  if (available <= 0) return;
  const actualAmount = Math.min(amount, available);

  for (let i = 0; i < actualAmount; i += 1) {
    const piece = document.createElement("span");
    piece.className = "click-heart";
    piece.textContent = "❤";

    const angle = (Math.PI * 2 * i) / actualAmount;
    const radius = Math.random() * spread + 40;
    const tx = Math.cos(angle) * radius;
    const ty = Math.sin(angle) * radius;

    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.fontSize = `${Math.random() * 10 + 12}px`;
    piece.style.setProperty("--x", `${tx}px`);
    piece.style.setProperty("--y", `${ty}px`);
    piece.style.animationDuration = `${Math.random() * 0.45 + 0.8}s`;

    appendWithLimit(clickBurstLayer, piece, EFFECT_LIMITS.clickHearts);
    piece.addEventListener("animationend", () => piece.remove());
  }
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function fireworkExplosion(cx, cy, count = 42) {
  if (!fireworksLayer) return;
  const available = Math.max(0, EFFECT_LIMITS.fireworks - fireworksLayer.childElementCount);
  if (available <= 0) return;
  const actualCount = Math.min(count, available);
  const colors = ["#ffd4ea", "#ff7cb9", "#fff2f8", "#ffc2df", "#ff96c6"];

  for (let i = 0; i < actualCount; i += 1) {
    const dot = document.createElement("span");
    dot.className = "firework";

    const angle = (Math.PI * 2 * i) / actualCount + randomRange(-0.08, 0.08);
    const dist = randomRange(80, 260);
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;

    dot.style.left = `${cx}px`;
    dot.style.top = `${cy}px`;
    dot.style.color = colors[Math.floor(Math.random() * colors.length)];
    dot.style.setProperty("--tx", `${tx}px`);
    dot.style.setProperty("--ty", `${ty}px`);

    appendWithLimit(fireworksLayer, dot, EFFECT_LIMITS.fireworks);
    dot.addEventListener("animationend", () => dot.remove());
  }
}

function fullScreenCelebration() {
  if (celebrationRunning) return;
  celebrationRunning = true;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const lowMode = shouldReduceEffects();
  const rounds = lowMode ? 3 : 5;
  const fireworkCount = lowMode ? 18 : 30;
  const heartCount = lowMode ? 12 : 20;

  for (let i = 0; i < rounds; i += 1) {
    const x = randomRange(width * 0.1, width * 0.9);
    const y = randomRange(height * 0.15, height * 0.75);

    setTimeout(() => fireworkExplosion(x, y, fireworkCount), i * 180);
    setTimeout(() => burstHearts(x, y, heartCount, 180), i * 160 + 30);
  }

  setTimeout(() => {
    celebrationRunning = false;
  }, rounds * 220 + 600);
}

function handleGlobalClickHearts() {
  on(document, "pointerdown", (event) => {
    if (event.target.closest(".music-toggle")) return;
    if (event.target.closest("#love-btn")) return;

    const now = performance.now();
    if (now - lastGlobalBurstAt < 120) return;
    lastGlobalBurstAt = now;

    burstHearts(event.clientX, event.clientY, 10, 70);
  });
}

function handleChecklist() {
  checkboxes.forEach((box) => {
    box.addEventListener("change", (event) => {
      const item = event.target.closest(".future-item");
      if (!item) return;

      item.classList.toggle("done", event.target.checked);
      const rect = item.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      burstHearts(x, y, event.target.checked ? 16 : 8, 95);
    });
  });
}

function updateMusicButton() {
  if (!audio || !musicToggle || !musicText) return;
  const isPaused = audio.paused;
  musicToggle.classList.toggle("paused", isPaused);
  if (!playlist.length) {
    musicText.textContent = isPaused ? "Nhạc: Off" : "Nhạc: On";
    return;
  }

  const label = `${playlistIndex + 1}/${playlist.length}`;
  musicText.textContent = isPaused ? `Nhạc: Off (${label})` : `Nhạc: On (${label})`;
}

function setTrackByIndex(index) {
  if (!audio) return;
  if (!playlist.length) return;
  playlistIndex = (index + playlist.length) % playlist.length;
  audio.src = playlist[playlistIndex];
  audio.load();
}

function nextTrack(shouldPlay = true) {
  if (!playlist.length) return;
  setTrackByIndex(playlistIndex + 1);
  if (shouldPlay) {
    tryPlayAudio();
  } else {
    updateMusicButton();
  }
}

async function tryPlayAudio() {
  if (!audio) return;
  if (!playlist.length) return;

  if (!audioReady) {
    audio.volume = 0.22;
    audioReady = true;
  }

  if (!audio.src) {
    setTrackByIndex(playlistIndex);
  }

  try {
    if (autoUnmuteArmed) {
      audio.muted = true;
    }

    await audio.play();

    if (autoUnmuteArmed) {
      setTimeout(() => {
        audio.muted = false;
        autoUnmuteArmed = false;
        updateMusicButton();
      }, 450);
    }

    if (autoplayRetryTimer) {
      clearInterval(autoplayRetryTimer);
      autoplayRetryTimer = null;
    }
    updateMusicButton();
  } catch (error) {
    try {
      audio.muted = true;
      autoUnmuteArmed = true;
      await audio.play();
      updateMusicButton();
    } catch (mutedError) {
      updateMusicButton();
    }
  }
}

function startAutoplayRetry() {
  if (!audio) return;
  if (autoplayRetryTimer) return;
  autoplayRetryCount = 0;

  autoplayRetryTimer = setInterval(async () => {
    if (userPausedMusic) {
      clearInterval(autoplayRetryTimer);
      autoplayRetryTimer = null;
      return;
    }

    autoplayRetryCount += 1;
    if (!audio.paused) {
      clearInterval(autoplayRetryTimer);
      autoplayRetryTimer = null;
      return;
    }

    await tryPlayAudio();

    if (autoplayRetryCount >= 300) {
      autoplayRetryCount = 0;
    }
  }, 1200);
}

async function initMusic() {
  if (!audio || !musicToggle || !musicText) return;
  playlist = await discoverMusicTracks();
  playlistIndex = 0;
  userPausedMusic = false;

  if (playlist.length) {
    setTrackByIndex(0);
  }

  audio.autoplay = true;
  audio.muted = true;

  on(musicToggle, "click", async () => {
    if (audio.paused) {
      userPausedMusic = false;
      audio.muted = false;
      autoUnmuteArmed = false;
      await tryPlayAudio();
      startAutoplayRetry();
    } else {
      userPausedMusic = true;
      audio.pause();
      if (autoplayRetryTimer) {
        clearInterval(autoplayRetryTimer);
        autoplayRetryTimer = null;
      }
      updateMusicButton();
    }
  });

  on(audio, "ended", () => {
    if (userPausedMusic) return;
    nextTrack(true);
  });

  on(audio, "pause", () => {
    if (userPausedMusic) return;
    setTimeout(() => {
      if (!userPausedMusic && audio.paused) {
        tryPlayAudio();
        startAutoplayRetry();
      }
    }, 120);
  });

  on(document, "visibilitychange", () => {
    if (document.hidden || userPausedMusic) return;
    if (audio.paused) {
      tryPlayAudio();
      startAutoplayRetry();
    }
  });

  on(window, "focus", () => {
    if (userPausedMusic) return;
    if (audio.paused) {
      tryPlayAudio();
      startAutoplayRetry();
    }
  });

  const warmup = async () => {
    if (autoplayAttempted) return;
    autoplayAttempted = true;
    userPausedMusic = false;
    audio.muted = false;
    autoUnmuteArmed = false;
    await tryPlayAudio();
    window.removeEventListener("pointerdown", warmup);
    window.removeEventListener("keydown", warmup);
  };

  on(window, "pointerdown", warmup, { once: true });
  on(window, "keydown", warmup, { once: true });

  tryPlayAudio();
  startAutoplayRetry();
  updateMusicButton();
}

function handleLoveButton() {
  if (!loveButton || !page || !finalMessage) return;
  on(loveButton, "click", () => {
    const now = performance.now();
    const clickCooldown = 1400;
    if (now - lastLoveClickAt < clickCooldown) {
      burstHearts(
        loveButton.getBoundingClientRect().left + loveButton.getBoundingClientRect().width / 2,
        loveButton.getBoundingClientRect().top + loveButton.getBoundingClientRect().height / 2,
        6,
        70
      );
      return;
    }
    lastLoveClickAt = now;

    const rect = loveButton.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    burstHearts(centerX, centerY, shouldReduceEffects() ? 18 : 30, 170);
    fullScreenCelebration();
    page.classList.add("screen-shake");
    finalMessage.classList.add("show");

    setTimeout(() => {
      page.classList.remove("screen-shake");
    }, 900);
  });
}

function init() {
  const lowMode = shouldReduceEffects();

  forceScrollTopOnReload();
  buildMemoryTimeline(20);
  prepareLetterTyping();
  splitTextToChars();
  runTyping();
  createSparkles(lowMode ? 26 : 44);
  createMeteors(lowMode ? 7 : 12);
  createFloatingHearts(heartsBack, lowMode ? 14 : 22, 13, 26, false);
  createFloatingHearts(heartsFront, lowMode ? 10 : 16, 10, 20, true);
  revealOnScroll();
  handleParallax();
  initCursorGlow();
  initPointerTrail();
  initLightbox();
  handleGlobalClickHearts();
  handleChecklist();
  initMusic();
  handleLoveButton();

  /* Run tilt after gallery media has loaded */
  setTimeout(() => initMemoryTilt(), 3000);

  const intro = document.getElementById("intro");
  if (intro) {
    intro.classList.add("visible");
  }
}

document.addEventListener("DOMContentLoaded", init);
