(() => {
  "use strict";

  const albumData = window.MA80_ALBUM;
  if (!albumData || !albumData.photos?.length) {
    document.body.innerHTML = '<p style="padding:2rem">Не удалось загрузить фотографии.</p>';
    return;
  }

  const photos = albumData.photos;
  const root = document.documentElement;
  const cover = document.querySelector("#cover");
  const album = document.querySelector("#album");
  const deck = document.querySelector("#deck");
  const ambient = document.querySelector("#ambient");
  const status = document.querySelector("#photo-status");
  const previousButton = document.querySelector("#previous-button");
  const nextButton = document.querySelector("#next-button");
  const startButton = document.querySelector("#start-button");
  const closeButton = document.querySelector("#close-button");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let index = readIndexFromHash();
  let currentFrame = null;
  let animating = false;
  let pointerStart = null;
  let quietTimer = null;
  let viewportTimers = [];

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

  function syncViewport(stabilize = false) {
    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width || window.innerWidth);
    const height = Math.round(viewport?.height || window.innerHeight);
    root.style.setProperty("--app-width", `${width}px`);
    root.style.setProperty("--app-height", `${height}px`);

    if (stabilize && currentFrame) {
      pointerStart = null;
      deck.classList.remove("is-dragging");
      deck.querySelectorAll(".photo-frame").forEach((frame) => {
        frame.getAnimations().forEach((animation) => animation.cancel());
        if (frame !== currentFrame) frame.remove();
      });
      currentFrame.style.opacity = "1";
      currentFrame.style.transform = "";
      currentFrame.style.filter = "";
      animating = false;
    }
  }

  function settleViewport() {
    viewportTimers.forEach(window.clearTimeout);
    viewportTimers = [];
    syncViewport(true);
    requestAnimationFrame(() => syncViewport(true));
    viewportTimers.push(window.setTimeout(() => syncViewport(true), 160));
    viewportTimers.push(window.setTimeout(() => syncViewport(true), 480));
  }

  function makeFrame(photo) {
    const frame = document.createElement("figure");
    frame.className = "photo-frame";
    frame.style.margin = "0";
    frame.style.opacity = "0";

    const image = document.createElement("img");
    image.src = photo.thumb;
    image.srcset = `${photo.thumb} 640w, ${photo.full} 1920w`;
    image.sizes = "100vw";
    image.width = photo.width;
    image.height = photo.height;
    image.alt = `Мама, примерно в ${photo.age} ${russianYears(photo.age)}`;
    image.draggable = false;
    frame.append(image);
    return frame;
  }

  function updateState() {
    const photo = photos[index];
    status.textContent = `≈ ${photo.age} · ${index + 1}/${photos.length}`;
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
    updateState();
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
    const duration = spatial ? 620 : 180;
    const easing = "cubic-bezier(0.16, 1, 0.3, 1)";
    incoming.style.zIndex = "2";
    deck.append(incoming);

    const incomingFrames = spatial
      ? [
          {
            opacity: 0,
            transform: `translate3d(${direction * 74}vw, 0, -100px) rotate(${direction * 3}deg) scale(.95)`,
            filter: "blur(8px)",
          },
          { opacity: 1, transform: "translate3d(0, 0, 0) rotate(0) scale(1)", filter: "blur(0)" },
        ]
      : [{ opacity: 0 }, { opacity: 1 }];
    const outgoingFrames = spatial
      ? [
          {
            opacity: 1,
            transform: outgoing.style.transform || "translate3d(0, 0, 0) rotate(0) scale(1)",
            filter: "blur(0)",
          },
          {
            opacity: 0,
            transform: `translate3d(${-direction * 40}vw, 0, -180px) rotate(${-direction * 4}deg) scale(.9)`,
            filter: "blur(10px)",
          },
        ]
      : [{ opacity: 1 }, { opacity: 0 }];

    const incomingAnimation = incoming.animate(incomingFrames, { duration, easing, fill: "forwards" });
    outgoing.animate(outgoingFrames, { duration: duration * 0.9, easing, fill: "forwards" });

    index = nextIndex;
    currentFrame = incoming;
    updateState();
    wakeChrome();

    incomingAnimation.finished
      .catch(() => {})
      .finally(() => {
        if (outgoing.isConnected) outgoing.remove();
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
    currentFrame
      .animate(
        [
          { transform: currentFrame.style.transform || "translate3d(0,0,0)" },
          { transform: "translate3d(0,0,0) rotate(0) scale(1)" },
        ],
        { duration: reducedMotion.matches ? 1 : 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      )
      .finished.catch(() => {})
      .finally(() => {
        currentFrame.style.transform = "";
      });
    deck.classList.remove("is-dragging");
  }

  function showAlbum() {
    if (!album.hidden) return;
    showInitial();
    album.hidden = false;
    syncViewport();
    cover
      .animate(
        [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.035)" }],
        {
          duration: reducedMotion.matches ? 1 : 460,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "forwards",
        }
      )
      .finished.catch(() => {})
      .finally(() => {
        cover.hidden = true;
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
    quietTimer = window.setTimeout(() => album.classList.add("is-quiet"), 2400);
  }

  startButton.addEventListener("click", showAlbum);
  closeButton.addEventListener("click", showCover);
  previousButton.addEventListener("click", () => goTo(index - 1, -1));
  nextButton.addEventListener("click", () => goTo(index + 1, 1));

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
    const resisted = dx * ((dx > 0 && index === 0) || (dx < 0 && index === photos.length - 1) ? 0.22 : 1);
    const rotation = Math.max(-4, Math.min(4, resisted / 80));
    currentFrame.style.transform = `translate3d(${resisted}px, 0, 0) rotate(${rotation}deg) scale(.99)`;
  });

  function finishPointer(event) {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const elapsed = Math.max(1, performance.now() - pointerStart.time);
    const velocity = Math.abs(dx) / elapsed;
    pointerStart = null;
    if (Math.abs(dx) > Math.min(80, window.innerWidth * 0.16) || velocity > 0.5) {
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
    if (event.key === "ArrowLeft") goTo(index - 1, -1);
    if (event.key === "ArrowRight" || event.key === " ") goTo(index + 1, 1);
    if (event.key === "Home") goTo(0, -1);
    if (event.key === "End") goTo(photos.length - 1, 1);
    if (event.key === "Escape") showCover();
    wakeChrome();
  });

  ["pointermove", "pointerdown", "focusin"].forEach((eventName) => {
    album.addEventListener(eventName, wakeChrome, { passive: true });
  });

  window.addEventListener("hashchange", () => {
    const requested = readIndexFromHash();
    if (requested !== index && !album.hidden) goTo(requested);
  });
  window.addEventListener("resize", settleViewport, { passive: true });
  window.addEventListener("orientationchange", settleViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", settleViewport, { passive: true });
  window.screen.orientation?.addEventListener?.("change", settleViewport);

  syncViewport();
})();
