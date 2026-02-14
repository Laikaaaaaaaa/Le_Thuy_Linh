const page = document.getElementById("page");
const audio = document.getElementById("bg-music");
const musicToggle = document.getElementById("music-toggle");
const musicText = musicToggle.querySelector(".music-text");
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

const fallbackTracks = (audio.dataset.tracks || "")
  .split("|")
  .map((track) => track.trim())
  .filter(Boolean);
let playlist = [...fallbackTracks];

const mediaExtensions = ["jpg", "jpeg", "png", "webp", "gif", "jfif", "bmp", "avif"];
const videoExtensions = ["mp4", "webm", "mov"];
const allExtensions = [...mediaExtensions, ...videoExtensions];
const musicExtensions = ["mp3", "wav", "ogg", "m4a", "aac", "flac", "webm"];

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

function isSupportedMusicFile(path) {
  return musicExtensions.includes(getExtensionFromPath(path));
}

function sortFilesByName(items) {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
  );
}

async function discoverMusicTracks() {
  const basePaths = ["music", "static/music"];

  for (const basePath of basePaths) {
    try {
      const response = await fetch(`${basePath}/`, { cache: "no-store" });
      if (!response.ok) continue;

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const links = Array.from(doc.querySelectorAll("a[href]"));

      const tracks = links
        .map((anchor) => anchor.getAttribute("href") || "")
        .map((href) => decodeURIComponent(href.trim()))
        .filter((href) => href && href !== "../" && !href.endsWith("/"))
        .map((href) => {
          const fileName = href.split("/").pop() || href;
          if (!isSupportedMusicFile(fileName)) return null;

          const normalizedHref = href.startsWith("./") ? href.slice(2) : href;
          let url;

          if (/^https?:\/\//i.test(normalizedHref) || normalizedHref.startsWith("/")) {
            url = normalizedHref;
          } else if (normalizedHref.startsWith(`${basePath}/`)) {
            url = normalizedHref;
          } else {
            url = `${basePath}/${normalizedHref}`;
          }

          return { name: fileName, url };
        })
        .filter(Boolean);

      if (tracks.length) {
        const sortedTracks = sortFilesByName(tracks);
        return sortedTracks.map((track) => track.url);
      }
    } catch (error) {
      continue;
    }
  }

  return [...fallbackTracks];
}

function isSupportedMediaFile(path) {
  const ext = getExtensionFromPath(path);
  return allExtensions.includes(ext);
}

function getMediaTypeFromPath(path) {
  const ext = getExtensionFromPath(path);
  return videoExtensions.includes(ext) ? "video" : "image";
}

function sortMediaByName(items) {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
  );
}

async function fetchDirectoryMedia(basePath) {
  try {
    const res = await fetch(`${basePath}/`, { cache: "no-store" });
    if (!res.ok) return [];

    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const links = Array.from(doc.querySelectorAll("a[href]"));

    const mediaItems = links
      .map((anchor) => anchor.getAttribute("href") || "")
      .map((href) => decodeURIComponent(href.trim()))
      .filter((href) => href && href !== "../" && !href.endsWith("/"))
      .map((href) => {
        const fileName = href.split("/").pop() || href;
        if (!isSupportedMediaFile(fileName)) return null;
        return {
          name: fileName,
          url: `${basePath}/${fileName}`,
          type: getMediaTypeFromPath(fileName),
        };
      })
      .filter(Boolean);

    return sortMediaByName(mediaItems);
  } catch (error) {
    return [];
  }
}

function probeImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

function probeVideo(url) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const done = (status) => {
      video.onloadedmetadata = null;
      video.oncanplay = null;
      video.onerror = null;
      resolve(status);
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => done(true);
    video.oncanplay = () => done(true);
    video.onerror = () => done(false);
    video.src = url;
    video.load();
  });
}

function probeMedia(url, type) {
  return type === "video" ? probeVideo(url) : probeImage(url);
}

/* ── Discover all media in a folder (static/images_videos/{n}/) ── */
async function discoverFolderMedia(folderIndex) {
  const basePaths = [
    `static/images_video/${folderIndex}`,
    `static/images_videos/${folderIndex}`,
  ];
  const found = [];

  for (const basePath of basePaths) {
    const listed = await fetchDirectoryMedia(basePath);
    if (listed.length) {
      return listed.map((item) => ({ url: item.url, type: item.type }));
    }
  }

  let fileNum = 1;
  let consecutiveMisses = 0;

  while (consecutiveMisses < 2) {
    const probes = basePaths.flatMap((basePath) =>
      allExtensions.map((ext) => {
        const url = `${basePath}/${fileNum}.${ext}`;
        const type = videoExtensions.includes(ext) ? "video" : "image";
        return probeMedia(url, type).then((ok) => (ok ? { url, ext, type } : null));
      })
    );

    const results = await Promise.all(probes);
    const hit = results.find((r) => r !== null);

    if (hit) {
      found.push({ url: hit.url, type: hit.type });
      consecutiveMisses = 0;
    } else {
      consecutiveMisses += 1;
    }

    fileNum += 1;
  }

  return found;
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
      vid.autoplay = true;
      vid.loop = true;
      vid.preload = "metadata";
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
  lb.overlay.classList.add("active");
  document.body.style.overflow = "hidden";
  renderLightboxSlide();
}

function closeLightbox() {
  const lb = getLightboxElements();
  lb.overlay.classList.remove("active");
  document.body.style.overflow = "";
  const vid = lb.content.querySelector("video");
  if (vid) vid.pause();
  lb.content.innerHTML = "";
}

function renderLightboxSlide() {
  const lb = getLightboxElements();
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
  lb.overlay.addEventListener("click", (e) => {
    if (e.target === lb.overlay || e.target.id === "lightbox-close") closeLightbox();
  });
  document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
  lb.prevBtn.addEventListener("click", (e) => { e.stopPropagation(); lightboxPrev(); });
  lb.nextBtn.addEventListener("click", (e) => { e.stopPropagation(); lightboxNext(); });

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

  for (const { galleryWrap, index } of rows) {
    discoverFolderMedia(index).then((mediaList) => {
      galleryWrap.innerHTML = "";
      const collage = buildCollage(mediaList, index);
      galleryWrap.appendChild(collage);
    });
  }
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
    trailLayer.appendChild(heart);
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
  for (let i = 0; i < amount; i += 1) {
    const piece = document.createElement("span");
    piece.className = "click-heart";
    piece.textContent = "❤";

    const angle = (Math.PI * 2 * i) / amount;
    const radius = Math.random() * spread + 40;
    const tx = Math.cos(angle) * radius;
    const ty = Math.sin(angle) * radius;

    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.fontSize = `${Math.random() * 10 + 12}px`;
    piece.style.setProperty("--x", `${tx}px`);
    piece.style.setProperty("--y", `${ty}px`);
    piece.style.animationDuration = `${Math.random() * 0.45 + 0.8}s`;

    clickBurstLayer.appendChild(piece);
    piece.addEventListener("animationend", () => piece.remove());
  }
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function fireworkExplosion(cx, cy, count = 42) {
  const colors = ["#ffd4ea", "#ff7cb9", "#fff2f8", "#ffc2df", "#ff96c6"];

  for (let i = 0; i < count; i += 1) {
    const dot = document.createElement("span");
    dot.className = "firework";

    const angle = (Math.PI * 2 * i) / count + randomRange(-0.08, 0.08);
    const dist = randomRange(80, 260);
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;

    dot.style.left = `${cx}px`;
    dot.style.top = `${cy}px`;
    dot.style.color = colors[Math.floor(Math.random() * colors.length)];
    dot.style.setProperty("--tx", `${tx}px`);
    dot.style.setProperty("--ty", `${ty}px`);

    fireworksLayer.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove());
  }
}

function fullScreenCelebration() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  for (let i = 0; i < 6; i += 1) {
    const x = randomRange(width * 0.1, width * 0.9);
    const y = randomRange(height * 0.15, height * 0.75);

    setTimeout(() => fireworkExplosion(x, y, 50), i * 170);
    setTimeout(() => burstHearts(x, y, 30, 220), i * 150 + 30);
  }
}

function handleGlobalClickHearts() {
  document.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".music-toggle")) return;
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
  playlist = await discoverMusicTracks();
  playlistIndex = 0;
  userPausedMusic = false;

  if (playlist.length) {
    setTrackByIndex(0);
  }

  audio.autoplay = true;
  audio.muted = true;

  musicToggle.addEventListener("click", async () => {
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

  audio.addEventListener("ended", () => {
    if (userPausedMusic) return;
    nextTrack(true);
  });

  audio.addEventListener("pause", () => {
    if (userPausedMusic) return;
    setTimeout(() => {
      if (!userPausedMusic && audio.paused) {
        tryPlayAudio();
        startAutoplayRetry();
      }
    }, 120);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || userPausedMusic) return;
    if (audio.paused) {
      tryPlayAudio();
      startAutoplayRetry();
    }
  });

  window.addEventListener("focus", () => {
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

  window.addEventListener("pointerdown", warmup, { once: true });
  window.addEventListener("keydown", warmup, { once: true });

  tryPlayAudio();
  startAutoplayRetry();
  updateMusicButton();
}

function handleLoveButton() {
  loveButton.addEventListener("click", () => {
    const rect = loveButton.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    burstHearts(centerX, centerY, 44, 210);
    fullScreenCelebration();
    page.classList.add("screen-shake");
    finalMessage.classList.add("show");

    setTimeout(() => {
      page.classList.remove("screen-shake");
    }, 900);
  });
}

function init() {
  forceScrollTopOnReload();
  buildMemoryTimeline(20);
  prepareLetterTyping();
  splitTextToChars();
  runTyping();
  createSparkles(56);
  createMeteors(16);
  createFloatingHearts(heartsBack, 28, 13, 26, false);
  createFloatingHearts(heartsFront, 22, 10, 20, true);
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
