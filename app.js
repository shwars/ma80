(() => {
  "use strict";

  const albumData = window.MA80_ALBUM;
  if (!albumData || !albumData.photos?.length) {
    document.body.innerHTML = '<p style="padding:2rem">Не удалось загрузить фотографии.</p>';
    return;
  }

  const photos = albumData.photos;
  const root = document.documentElement;
  const album = document.querySelector("#album");
  const pile = document.querySelector("#pile");
  const deck = document.querySelector("#deck");
  const ambient = document.querySelector("#ambient");
  const status = document.querySelector("#photo-status");
  const previousButton = document.querySelector("#previous-button");
  const nextButton = document.querySelector("#next-button");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const PILE_SLOTS = [
    { x: -0.2, y: -0.32, rotation: -10, size: 0.88, opacity: 0.46 },
    { x: 0.2, y: 0.32, rotation: 9, size: 0.86, opacity: 0.43 },
    { x: -0.08, y: -0.39, rotation: -5, size: 0.8, opacity: 0.39 },
    { x: 0.1, y: 0.39, rotation: 6, size: 0.82, opacity: 0.4 },
    { x: -0.28, y: -0.24, rotation: 12, size: 0.73, opacity: 0.33 },
    { x: 0.29, y: 0.23, rotation: -12, size: 0.75, opacity: 0.35 },
    { x: 0.01, y: 0.02, rotation: -2, size: 0.7, opacity: 0.3 },
  ];

  let viewport = { width: window.innerWidth, height: window.innerHeight };
  let index = readIndexFromHash();
  let currentFrame = null;
  let pilePoses = new Map();
  let animating = false;
  let pointerStart = null;
  let quietTimer = null;
  let viewportTimers = [];

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

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function fitDimensions(photo, maxWidth, maxHeight) {
    const ratio = photo.width / photo.height;
    let width = maxWidth;
    let height = width / ratio;
    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }
    return { width, height };
  }

  function pileCandidates(centerIndex) {
    const result = [];
    const add = (candidate) => {
      if (
        candidate >= 0 &&
        candidate < photos.length &&
        candidate !== centerIndex &&
        !result.includes(candidate)
      ) {
        result.push(candidate);
      }
    };

    [1, -1, 2, -2, 3, -3].forEach((offset) => add(centerIndex + offset));
    const random = seededRandom((centerIndex + 1) * 7919);
    while (result.length < PILE_SLOTS.length && result.length < photos.length - 1) {
      add(Math.floor(random() * photos.length));
    }
    return result.slice(0, PILE_SLOTS.length);
  }

  function buildPileModel(centerIndex) {
    return pileCandidates(centerIndex).map((photoIndex, slotIndex) => {
      const photo = photos[photoIndex];
      const slot = PILE_SLOTS[slotIndex];
      const random = seededRandom((centerIndex + 1) * 104729 + (photoIndex + 1) * 1543);
      const base = fitDimensions(photo, viewport.width * 0.72, viewport.height * 0.72);
      const active = fitDimensions(
        photo,
        Math.max(1, viewport.width - 12),
        Math.max(1, viewport.height - 12)
      );
      const width = base.width * slot.size;
      const height = base.height * slot.size;
      const pose = {
        x: slot.x * viewport.width + (random() - 0.5) * viewport.width * 0.045,
        y: slot.y * viewport.height + (random() - 0.5) * viewport.height * 0.045,
        rotation: slot.rotation + (random() - 0.5) * 4,
        width,
        height,
        scale: Math.min(width / active.width, height / active.height),
        opacity: slot.opacity,
      };
      return { photoIndex, pose, slotIndex };
    });
  }

  function renderPile(centerIndex) {
    pilePoses = new Map();
    const fragment = document.createDocumentFragment();
    buildPileModel(centerIndex).forEach(({ photoIndex, pose, slotIndex }) => {
      pilePoses.set(photoIndex, pose);
      const card = document.createElement("figure");
      card.className = "pile-card";
      card.dataset.index = String(photoIndex);
      card.style.width = `${pose.width}px`;
      card.style.height = `${pose.height}px`;
      card.style.zIndex = String(PILE_SLOTS.length - slotIndex);
      card.style.setProperty("--pile-x", `${pose.x}px`);
      card.style.setProperty("--pile-y", `${pose.y}px`);
      card.style.setProperty("--pile-rotation", `${pose.rotation}deg`);
      card.style.setProperty("--pile-opacity", String(pose.opacity));

      const image = document.createElement("img");
      image.src = photos[photoIndex].thumb;
      image.alt = "";
      image.draggable = false;
      card.append(image);
      fragment.append(card);
    });
    pile.replaceChildren(fragment);
  }

  function frameTransform(pose) {
    return `translate3d(${pose.x}px, ${pose.y}px, -160px) rotate(${pose.rotation}deg) scale(${pose.scale})`;
  }

  function fallbackPose(photoIndex, slotIndex = 0) {
    const model = buildPileModel(index);
    return (
      model.find((item) => item.photoIndex === photoIndex)?.pose ||
      model[slotIndex % Math.max(1, model.length)]?.pose || {
        x: 0,
        y: 0,
        rotation: 0,
        scale: 0.62,
        opacity: 0.28,
      }
    );
  }

  function syncViewport(stabilize = false) {
    const visual = window.visualViewport;
    viewport = {
      width: Math.round(visual?.width || window.innerWidth),
      height: Math.round(visual?.height || window.innerHeight),
    };
    root.style.setProperty("--app-width", `${viewport.width}px`);
    root.style.setProperty("--app-height", `${viewport.height}px`);
    root.style.setProperty("--app-left", `${Math.round(visual?.offsetLeft || 0)}px`);
    root.style.setProperty("--app-top", `${Math.round(visual?.offsetTop || 0)}px`);

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
    renderPile(index);
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
    syncViewport();
    currentFrame = makeFrame(photos[index]);
    currentFrame.style.opacity = "1";
    deck.replaceChildren(currentFrame);
    renderPile(index);
    updateState();
    preloadNearby();
    wakeChrome();
  }

  function goTo(nextIndex, direction = nextIndex > index ? 1 : -1) {
    nextIndex = Math.max(0, Math.min(photos.length - 1, nextIndex));
    if (animating || nextIndex === index) {
      resetDraggedFrame();
      return;
    }

    animating = true;
    deck.classList.remove("is-dragging");
    const oldIndex = index;
    const outgoing = currentFrame;
    const incoming = makeFrame(photos[nextIndex]);
    const currentModel = buildPileModel(oldIndex);
    const nextModel = buildPileModel(nextIndex);
    const incomingPose =
      pilePoses.get(nextIndex) ||
      currentModel.find((item) => item.photoIndex === nextIndex)?.pose ||
      fallbackPose(nextIndex, direction > 0 ? 0 : 1);
    const outgoingPose =
      nextModel.find((item) => item.photoIndex === oldIndex)?.pose ||
      fallbackPose(oldIndex, direction > 0 ? 1 : 0);

    pile.querySelector(`[data-index="${nextIndex}"]`)?.classList.add("is-picked");
    incoming.style.zIndex = "2";
    outgoing.style.zIndex = "3";
    deck.append(incoming);

    const spatial = !reducedMotion.matches;
    const duration = spatial ? 720 : 180;
    const easing = "cubic-bezier(0.16, 1, 0.3, 1)";
    const incomingFrames = spatial
      ? [
          {
            opacity: incomingPose.opacity,
            transform: frameTransform(incomingPose),
            filter: "brightness(.62) saturate(.68) blur(1px)",
          },
          {
            opacity: 1,
            transform: "translate3d(0, 0, 0) rotate(0) scale(1)",
            filter: "brightness(1) saturate(1) blur(0)",
          },
        ]
      : [{ opacity: 0 }, { opacity: 1 }];
    const outgoingFrames = spatial
      ? [
          {
            opacity: 1,
            transform: outgoing.style.transform || "translate3d(0, 0, 0) rotate(0) scale(1)",
            filter: "brightness(1) saturate(1) blur(0)",
          },
          {
            opacity: outgoingPose.opacity,
            transform: frameTransform(outgoingPose),
            filter: "brightness(.62) saturate(.68) blur(1px)",
          },
        ]
      : [{ opacity: 1 }, { opacity: 0 }];

    const incomingAnimation = incoming.animate(incomingFrames, {
      duration,
      easing,
      fill: "forwards",
    });
    outgoing.animate(outgoingFrames, { duration, easing, fill: "forwards" });

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
        incoming.style.zIndex = "";
        animating = false;
        renderPile(index);
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
        {
          duration: reducedMotion.matches ? 1 : 260,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
        }
      )
      .finished.catch(() => {})
      .finally(() => {
        currentFrame.style.transform = "";
      });
    deck.classList.remove("is-dragging");
  }

  function wakeChrome() {
    album.classList.remove("is-quiet");
    window.clearTimeout(quietTimer);
    quietTimer = window.setTimeout(() => album.classList.add("is-quiet"), 2400);
  }

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
    const resisted =
      dx *
      ((dx > 0 && index === 0) || (dx < 0 && index === photos.length - 1) ? 0.22 : 1);
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
    if (event.key === "ArrowLeft") goTo(index - 1, -1);
    if (event.key === "ArrowRight" || event.key === " ") goTo(index + 1, 1);
    if (event.key === "Home") goTo(0, -1);
    if (event.key === "End") goTo(photos.length - 1, 1);
    wakeChrome();
  });

  ["pointermove", "pointerdown", "focusin"].forEach((eventName) => {
    album.addEventListener(eventName, wakeChrome, { passive: true });
  });

  window.addEventListener("hashchange", () => {
    const requested = readIndexFromHash();
    if (requested !== index) goTo(requested);
  });
  window.addEventListener("resize", settleViewport, { passive: true });
  window.addEventListener("orientationchange", settleViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", settleViewport, { passive: true });
  window.visualViewport?.addEventListener("scroll", settleViewport, { passive: true });
  window.screen.orientation?.addEventListener?.("change", settleViewport);

  showInitial();
})();
