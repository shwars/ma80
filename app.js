(() => {
  "use strict";

  const albumData = window.MA80_ALBUM;
  if (!albumData || !albumData.photos?.length) {
    document.body.innerHTML = '<p style="padding:2rem">Не удалось загрузить фотографии.</p>';
    return;
  }

  const photos = albumData.photos;
  const cover = document.querySelector("#cover");
  const album = document.querySelector("#album");
  const deck = document.querySelector("#deck");
  const ambient = document.querySelector("#ambient");
  const counter = document.querySelector("#counter");
  const ageLabel = document.querySelector("#age-label");
  const detailLabel = document.querySelector("#detail-label");
  const timeline = document.querySelector("#timeline");
  const timelineStart = document.querySelector("#timeline-start");
  const timelineEnd = document.querySelector("#timeline-end");
  const previousButton = document.querySelector("#previous-button");
  const nextButton = document.querySelector("#next-button");
  const fullscreenButton = document.querySelector("#fullscreen-button");
  const startButton = document.querySelector("#start-button");
  const restartButton = document.querySelector("#restart-button");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let index = readIndexFromHash();
  let currentFrame = null;
  let animating = false;
  let pointerStart = null;
  let quietTimer = null;

  timeline.max = String(photos.length - 1);
  timelineStart.textContent = `${photos[0].age} ${russianYears(photos[0].age)}`;
  timelineEnd.textContent = `${photos.at(-1).age} ${russianYears(photos.at(-1).age)}`;
  const coverIndexes = [0, Math.floor(photos.length * 0.43), photos.length - 1];
  document.querySelectorAll(".cover__print").forEach((print, position) => {
    print.style.backgroundImage = `url("${photos[coverIndexes[position]].thumb}")`;
  });

  function readIndexFromHash() {
    const match = window.location.hash.match(/^#photo-(\d+)$/);
    if (!match) return 0;
    return Math.min(photos.length - 1, Math.max(0, Number(match[1]) - 1));
  }

  function russianYears(age) {
    const lastTwo = age % 100;
    const last = age % 10;
    if (lastTwo >= 11 && lastTwo <= 14) return "лет";
    if (last === 1) return "год";
    if (last >= 2 && last <= 4) return "года";
    return "лет";
  }

  function makeFrame(photo) {
    const frame = document.createElement("figure");
    frame.className = "photo-frame";
    frame.style.margin = "0";
    frame.style.opacity = "0";
    const image = document.createElement("img");
    image.src = photo.thumb;
    image.srcset = `${photo.thumb} 640w, ${photo.full} 1920w`;
    image.sizes = "(max-width: 720px) 100vw, 88vw";
    image.width = photo.width;
    image.height = photo.height;
    image.alt = `Мама, примерно в ${photo.age} ${russianYears(photo.age)}`;
    image.draggable = false;
    frame.append(image);
    return frame;
  }

  function updateChrome() {
    const photo = photos[index];
    counter.textContent = `${String(index + 1).padStart(2, "0")} / ${photos.length}`;
    ageLabel.textContent = `около ${photo.age} лет`;
    detailLabel.textContent = photo.dateKnown
      ? `${photo.year} · ${photo.variant}`
      : `примерная дата · ${photo.variant}`;
    timeline.value = String(index);
    const progress = photos.length === 1 ? 100 : (index / (photos.length - 1)) * 100;
    timeline.style.setProperty("--progress", `${progress}%`);
    previousButton.disabled = index === 0;
    nextButton.disabled = index === photos.length - 1;
    ambient.style.setProperty("--photo-color", photo.color);
    ambient.style.setProperty("--photo-background", `url("${photo.thumb}")`);
    window.history.replaceState(null, "", `#photo-${index + 1}`);
    document.title = `Мама — ${index + 1} из ${photos.length}`;
  }

  function preloadNearby() {
    [-2, -1, 1, 2].forEach((offset) => {
      const photo = photos[index + offset];
      if (photo) {
        const image = new Image();
        image.src = photo.full;
      }
    });
  }

  function showInitial() {
    currentFrame = makeFrame(photos[index]);
    currentFrame.style.opacity = "1";
    deck.replaceChildren(currentFrame);
    updateChrome();
    preloadNearby();
  }

  function goTo(nextIndex, direction = nextIndex > index ? 1 : -1) {
    nextIndex = Math.max(0, Math.min(photos.length - 1, nextIndex));
    if (animating || nextIndex === index) {
      resetDraggedFrame();
      return;
    }

    animating = true;
    deck.classList.remove("is-dragging");
    const outgoing = currentFrame;
    const incoming = makeFrame(photos[nextIndex]);
    const spatial = !reducedMotion.matches;
    const duration = spatial ? 680 : 220;
    const easing = "cubic-bezier(0.16, 1, 0.3, 1)";
    incoming.style.zIndex = "2";
    deck.append(incoming);

    const incomingFrames = spatial
      ? [
          { opacity: 0, transform: `translate3d(${direction * 72}vw, 0, -100px) rotate(${direction * 3}deg) scale(.94)`, filter: "blur(8px)" },
          { opacity: 1, transform: "translate3d(0, 0, 0) rotate(0) scale(1)", filter: "blur(0)" },
        ]
      : [{ opacity: 0 }, { opacity: 1 }];
    const outgoingFrames = spatial
      ? [
          { opacity: 1, transform: outgoing.style.transform || "translate3d(0, 0, 0) rotate(0) scale(1)", filter: "blur(0)" },
          { opacity: 0, transform: `translate3d(${-direction * 38}vw, 0, -180px) rotate(${-direction * 4}deg) scale(.9)`, filter: "blur(10px)" },
        ]
      : [{ opacity: 1 }, { opacity: 0 }];

    const incomingAnimation = incoming.animate(incomingFrames, { duration, easing, fill: "forwards" });
    outgoing.animate(outgoingFrames, { duration: duration * 0.9, easing, fill: "forwards" });

    index = nextIndex;
    currentFrame = incoming;
    updateChrome();

    incomingAnimation.finished
      .catch(() => {})
      .finally(() => {
        outgoing.remove();
        incoming.getAnimations().forEach((animation) => animation.cancel());
        incoming.style.opacity = "1";
        incoming.style.transform = "";
        incoming.style.filter = "";
        animating = false;
        preloadNearby();
      });
  }

  function resetDraggedFrame() {
    if (!currentFrame) return;
    currentFrame.animate(
      [
        { transform: currentFrame.style.transform || "translate3d(0,0,0)" },
        { transform: "translate3d(0,0,0) rotate(0) scale(1)" },
      ],
      { duration: reducedMotion.matches ? 1 : 300, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    ).finished.finally(() => {
      currentFrame.style.transform = "";
    });
    deck.classList.remove("is-dragging");
  }

  function showAlbum() {
    if (!album.hidden) return;
    showInitial();
    album.hidden = false;
    cover.animate(
      [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.035)" }],
      { duration: reducedMotion.matches ? 1 : 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "forwards" }
    ).finished.finally(() => {
      cover.hidden = true;
      album.focus?.();
    });
    wakeChrome();
  }

  function showCover() {
    cover.hidden = false;
    cover.getAnimations().forEach((animation) => animation.cancel());
    cover.style.opacity = "1";
    cover.style.transform = "";
    album.hidden = true;
    document.title = "Мама — 80 лет";
    startButton.focus();
  }

  function wakeChrome() {
    album.classList.remove("is-quiet");
    window.clearTimeout(quietTimer);
    quietTimer = window.setTimeout(() => album.classList.add("is-quiet"), 3200);
  }

  startButton.addEventListener("click", showAlbum);
  restartButton.addEventListener("click", showCover);
  previousButton.addEventListener("click", () => goTo(index - 1, -1));
  nextButton.addEventListener("click", () => goTo(index + 1, 1));
  timeline.addEventListener("input", () => goTo(Number(timeline.value)));

  fullscreenButton.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (_) {
      // Some mobile browsers intentionally refuse programmatic fullscreen.
    }
  });

  document.addEventListener("fullscreenchange", () => {
    fullscreenButton.setAttribute(
      "aria-label",
      document.fullscreenElement ? "Выйти из полноэкранного режима" : "Открыть на весь экран"
    );
  });

  deck.addEventListener("pointerdown", (event) => {
    if (animating || event.button !== 0) return;
    pointerStart = { x: event.clientX, y: event.clientY, time: performance.now() };
    deck.setPointerCapture(event.pointerId);
    deck.classList.add("is-dragging");
    wakeChrome();
  });

  deck.addEventListener("pointermove", (event) => {
    if (!pointerStart || animating) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    if (Math.abs(dy) > Math.abs(dx) * 1.25) return;
    const resisted = dx * (dx > 0 && index === 0 || dx < 0 && index === photos.length - 1 ? 0.22 : 1);
    const rotation = Math.max(-4, Math.min(4, resisted / 80));
    currentFrame.style.transform = `translate3d(${resisted}px, 0, 0) rotate(${rotation}deg) scale(.985)`;
  });

  function finishPointer(event) {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const elapsed = Math.max(1, performance.now() - pointerStart.time);
    const velocity = Math.abs(dx) / elapsed;
    pointerStart = null;
    if (Math.abs(dx) > Math.min(90, window.innerWidth * 0.18) || velocity > 0.55) {
      goTo(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    } else {
      resetDraggedFrame();
    }
  }

  deck.addEventListener("pointerup", finishPointer);
  deck.addEventListener("pointercancel", () => {
    pointerStart = null;
    resetDraggedFrame();
  });

  document.addEventListener("keydown", (event) => {
    if (album.hidden) {
      if (event.key === "Enter" || event.key === " ") showAlbum();
      return;
    }
    if (event.target === timeline) return;
    if (event.key === "ArrowLeft") goTo(index - 1, -1);
    if (event.key === "ArrowRight" || event.key === " ") goTo(index + 1, 1);
    if (event.key === "Home") goTo(0, -1);
    if (event.key === "End") goTo(photos.length - 1, 1);
    wakeChrome();
  });

  ["pointermove", "pointerdown", "focusin"].forEach((eventName) =>
    album.addEventListener(eventName, wakeChrome, { passive: true })
  );

  window.addEventListener("hashchange", () => {
    const requested = readIndexFromHash();
    if (requested !== index && !album.hidden) goTo(requested);
  });
})();
