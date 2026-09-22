import "@waline/client/style";
import { createIntroCompositor } from "./intro-compositor.js";
import { createVideoRipple } from "./video-ripple.js";

const app = document.querySelector("[data-story-app]");

if (app instanceof HTMLElement) {
  const introVideo = app.querySelector("[data-intro-video]");
  const introMaskVideo = app.querySelector("[data-intro-mask-video]");
  const introForeground = app.querySelector("[data-intro-foreground]");
  const introDisplay = app.querySelector("[data-intro-display]");
  const storyVideos = Array.from(app.querySelectorAll("[data-story-video]"));
  const folderBurst = app.querySelector("[data-folder-burst]");
  const folderTrigger = app.querySelector("[data-folder-trigger]");
  const folderHitMap = app.querySelector(".folder-hit-map");
  const spacer = app.querySelector("[data-story-spacer]");
  const progressBar = app.querySelector("[data-progress-bar]");
  const progressNumber = app.querySelector("[data-progress-number]");
  const marker = app.querySelector("[data-pointer-marker]");
  const canvas = app.querySelector("[data-ripple-field]");
  const commentsMount = app.querySelector("[data-comments-mount]");
  const commentsLoading = app.querySelector("[data-comments-loading]");
  const panels = new Map(
    Array.from(app.querySelectorAll("[data-scene-panel]")).map((panel) => [panel.dataset.scenePanel, panel]),
  );
  const storyLinks = Array.from(app.querySelectorAll("[data-story-link]"));
  const anchors = Array.from(app.querySelectorAll("[data-anchor]"));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");

  const FALLBACK_DURATION = 5.042;
  const CROSSFADE_SECONDS = 0.5;
  const clamp = (value, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
  const mix = (from, to, amount) => from + (to - from) * amount;
  const smoothstep = (start, end, value) => {
    if (start === end) return value < start ? 0 : 1;
    const amount = clamp((value - start) / (end - start));
    return amount * amount * (3 - 2 * amount);
  };
  const FOLDER_STABLE_FRAME = { x: 20.5, y: 14.4, width: 31.8, height: 57.2 };
  const FOLDER_EXIT_FRAMES = [
    { time: 0, x: 19.7, y: 29, width: 30.5, height: 40.8 },
    { time: 1.05, x: 19.7, y: 29, width: 30.5, height: 40.8 },
    { time: 1.1, x: 19, y: 29.3, width: 30.9, height: 39.3 },
    { time: 1.2, x: 17.9, y: 31.9, width: 24.4, height: 30.4 },
    { time: 1.3, x: 15.6, y: 33.7, width: 15.1, height: 18.9 },
    { time: 1.4, x: 15.3, y: 35, width: 9.1, height: 11.5 },
    { time: 1.45, x: 15.7, y: 37.8, width: 6.5, height: 6.8 },
    { time: 1.54, x: 16.5, y: 38.8, width: 3.2, height: 4.2 },
  ];

  let mediaDurations = storyVideos.map((video) => Number(video.dataset.duration) || FALLBACK_DURATION);
  let durations = storyVideos.map((video, index) => {
    const scrollDuration = Number(video.dataset.scrollDuration);
    return scrollDuration > 0 ? scrollDuration : mediaDurations[index];
  });
  let scrollPowers = storyVideos.map((video) => {
    const power = Number(video.dataset.scrollPower);
    return power > 0 ? power : 1;
  });
  let offsets = [];
  let totalDuration = durations.reduce((total, duration) => total + duration, 0);
  let targetStoryTime = 0;
  let renderedStoryTime = 0;
  let lastScrollY = window.scrollY;
  let currentScene = "";
  let comments = null;
  let commentsStarted = false;
  let isNavigating = false;
  let initialHashHandled = false;
  let introTargetTime = 0.08;
  let introPointerActive = false;
  let markerTargetX = window.innerWidth / 2;
  let markerTargetY = window.innerHeight / 2;
  let markerX = markerTargetX;
  let markerY = markerTargetY;
  let storyFrame = 0;
  let introCompositor = null;
  let introFallbackActive = false;

  function enableIntroFallback({ freeze = true } = {}) {
    if (!(introVideo instanceof HTMLVideoElement)) return;
    introFallbackActive = true;
    introVideo.classList.add("is-composite-fallback");
    if (introForeground instanceof HTMLCanvasElement) introForeground.hidden = true;
    introCompositor?.destroy();
    introCompositor = null;

    if (freeze) {
      introVideo.pause();
      introMaskVideo?.pause();
      seekVideo(introVideo, 0.08, true);
      seekVideo(introMaskVideo, 0.08, true);
    }
  }

  function scheduleStory() {
    if (storyFrame === 0) storyFrame = requestAnimationFrame(renderStory);
  }

  function timelineTimeForMedia(index, mediaTime) {
    const mediaDuration = mediaDurations[index] || FALLBACK_DURATION;
    const timelineDuration = durations[index] || mediaDuration;
    const power = scrollPowers[index] || 1;
    const mediaProgress = clamp(mediaTime / mediaDuration);
    const timelineProgress = Math.pow(mediaProgress, 1 / power);
    return (offsets[index] || 0) + timelineDuration * timelineProgress;
  }

  function folderExitFrameAt(mediaTime) {
    const lastFrame = FOLDER_EXIT_FRAMES[FOLDER_EXIT_FRAMES.length - 1];
    if (mediaTime <= FOLDER_EXIT_FRAMES[0].time) return FOLDER_EXIT_FRAMES[0];
    if (mediaTime >= lastFrame.time) return lastFrame;

    const nextIndex = FOLDER_EXIT_FRAMES.findIndex((frame) => frame.time >= mediaTime);
    const next = FOLDER_EXIT_FRAMES[nextIndex];
    const previous = FOLDER_EXIT_FRAMES[nextIndex - 1];
    const amount = clamp((mediaTime - previous.time) / (next.time - previous.time));
    return {
      x: mix(previous.x, next.x, amount),
      y: mix(previous.y, next.y, amount),
      width: mix(previous.width, next.width, amount),
      height: mix(previous.height, next.height, amount),
    };
  }

  function updateFolderTarget(storyTime) {
    if (!(folderTrigger instanceof HTMLElement) || offsets.length < 4) return;
    const fourthStart = offsets[3];
    const fourthDuration = durations[3] || FALLBACK_DURATION;
    const fourthProgress = clamp((storyTime - fourthStart) / fourthDuration);
    const fourthMediaTime = Math.pow(fourthProgress, scrollPowers[3] || 1) *
      (mediaDurations[3] || FALLBACK_DURATION);
    const sourceBlend = smoothstep(
      fourthStart - CROSSFADE_SECONDS / 2,
      fourthStart + CROSSFADE_SECONDS / 2,
      storyTime,
    );
    const exitFrame = folderExitFrameAt(fourthMediaTime);
    const frame = {
      x: mix(FOLDER_STABLE_FRAME.x, exitFrame.x, sourceBlend),
      y: mix(FOLDER_STABLE_FRAME.y, exitFrame.y, sourceBlend),
      width: mix(FOLDER_STABLE_FRAME.width, exitFrame.width, sourceBlend),
      height: mix(FOLDER_STABLE_FRAME.height, exitFrame.height, sourceBlend),
    };

    folderTrigger.style.setProperty("--folder-center-x", `${(frame.x + frame.width / 2).toFixed(3)}%`);
    folderTrigger.style.setProperty("--folder-center-y", `${(frame.y + frame.height / 2).toFixed(3)}%`);
    folderTrigger.style.setProperty("--folder-width", `${frame.width.toFixed(3)}%`);
    folderTrigger.style.setProperty("--folder-height", `${frame.height.toFixed(3)}%`);
    folderTrigger.style.setProperty("--folder-label-y", `${mix(80, 75, sourceBlend).toFixed(3)}%`);
    folderTrigger.style.setProperty(
      "--folder-label-scale",
      clamp(frame.width / FOLDER_STABLE_FRAME.width, 0.18, 1).toFixed(3),
    );

    if (folderHitMap instanceof HTMLElement) {
      const mobileMapY = mix(62, 54, sourceBlend);
      folderHitMap.style.setProperty("--folder-map-y", `${mobileMapY.toFixed(3)}%`);
      folderHitMap.style.setProperty("--folder-map-shift", `${(-mobileMapY).toFixed(3)}%`);
    }
  }

  function rebuildTimeline() {
    mediaDurations = storyVideos.map((video, index) => {
      const measured = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      return measured || Number(video.dataset.duration) || mediaDurations[index] || FALLBACK_DURATION;
    });
    durations = storyVideos.map((video, index) => {
      const scrollDuration = Number(video.dataset.scrollDuration);
      return scrollDuration > 0 ? scrollDuration : mediaDurations[index];
    });
    scrollPowers = storyVideos.map((video) => {
      const power = Number(video.dataset.scrollPower);
      return power > 0 ? power : 1;
    });
    offsets = [];
    durations.reduce((elapsed, duration) => {
      offsets.push(elapsed);
      return elapsed + duration;
    }, 0);
    totalDuration = durations.reduce((total, duration) => total + duration, 0);

    if (spacer instanceof HTMLElement) {
      const viewportUnit = CSS.supports("height", "1svh") && window.matchMedia("(max-width: 760px)").matches
        ? "svh"
        : "vh";
      spacer.style.height = `${totalDuration * 100}${viewportUnit}`;
    }

    const scrollRange = spacer instanceof HTMLElement
      ? Math.max(1, spacer.offsetHeight - window.innerHeight)
      : 1;
    anchors.forEach((anchor) => {
      if (!(anchor instanceof HTMLElement)) return;
      const videoIndex = Number(anchor.dataset.videoIndex);
      const mediaTime = Number(anchor.dataset.mediaTime);
      const hasMediaCue = Number.isInteger(videoIndex) && videoIndex >= 0 && videoIndex < storyVideos.length &&
        Number.isFinite(mediaTime);
      const rawCueTime = hasMediaCue
        ? timelineTimeForMedia(videoIndex, mediaTime)
        : Number(anchor.dataset.time) || 0;
      const cueTime = clamp(rawCueTime, 0, totalDuration);
      anchor.style.top = `${(cueTime / totalDuration) * scrollRange}px`;
    });

    updateScrollTarget();
    scheduleStory();

    if (!initialHashHandled && window.location.hash) {
      initialHashHandled = true;
      let hashId = "";
      try {
        hashId = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        hashId = "";
      }
      const target = hashId ? document.getElementById(hashId) : null;
      if (target instanceof HTMLElement) {
        requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
      }
    }
  }

  function updateScrollTarget() {
    if (!(spacer instanceof HTMLElement)) return;
    const maxScroll = Math.max(1, spacer.offsetHeight - window.innerHeight);
    const progress = clamp(window.scrollY / maxScroll);
    targetStoryTime = progress * totalDuration;
    lastScrollY = window.scrollY;
    if (progressBar instanceof HTMLElement) {
      progressBar.style.transform = `scaleY(${progress})`;
    }
    scheduleStory();
  }

  function videoOpacity(index, storyTime) {
    const start = offsets[index];
    const end = start + durations[index];
    const fadeInDuration = index === 2 ? 0.16 : CROSSFADE_SECONDS;
    const fadeOutDuration = index === 1 ? 0.16 : CROSSFADE_SECONDS;
    const fadeInHalf = fadeInDuration / 2;
    const fadeOutHalf = fadeOutDuration / 2;
    const fadeIn = index === 0
      ? smoothstep(0, CROSSFADE_SECONDS, storyTime)
      : smoothstep(start - fadeInHalf, start + fadeInHalf, storyTime);
    const fadeOut = index === storyVideos.length - 1
      ? 1 - smoothstep(start + 2.15, start + 2.85, storyTime)
      : 1 - smoothstep(end - fadeOutHalf, end + fadeOutHalf, storyTime);
    return clamp(fadeIn * fadeOut);
  }

  function seekVideo(video, target, force = false) {
    if (!(video instanceof HTMLVideoElement) || video.readyState < 1 || !Number.isFinite(video.duration)) return false;
    const frameDuration = 1 / 24;
    const safeTarget = Math.round(
      clamp(target, 0, Math.max(0, video.duration - frameDuration)) / frameDuration,
    ) * frameDuration;
    const difference = safeTarget - video.currentTime;
    if (Math.abs(difference) < 0.012) return false;
    if (!force && video.seeking && Math.abs(difference) < 0.42) return true;
    const response = reduceMotion.matches ? 1 : Math.abs(difference) > 1 ? 0.42 : 0.2;
    const nextTime = force ? safeTarget : video.currentTime + difference * response;
    try {
      video.currentTime = nextTime;
      return true;
    } catch {
      // Metadata can arrive between readyState checks on iOS; the next frame retries safely.
      return false;
    }
  }

  function setPanel(name, opacity, options = {}) {
    const panel = panels.get(name);
    if (!(panel instanceof HTMLElement)) return;
    const { interactive = false, accessible = interactive } = options;
    const value = clamp(opacity);
    panel.style.setProperty("--scene-opacity", value.toFixed(4));
    const visible = value > 0.035;
    panel.classList.toggle("is-visible", visible);
    panel.classList.toggle("is-interactive", interactive);
    const hidden = !accessible;
    if (panel.getAttribute("aria-hidden") !== String(hidden)) {
      panel.setAttribute("aria-hidden", String(hidden));
    }
    if (panel.inert !== hidden) panel.inert = hidden;
  }

  async function startComments() {
    if (commentsStarted || !(commentsMount instanceof HTMLElement)) return;
    commentsStarted = true;

    try {
      const { init: initWaline } = await import("@waline/client");
      comments = initWaline({
        el: commentsMount,
        serverURL: "https://comments.loadingvibe.com",
        path: "/",
        lang: "en-US",
        login: "enable",
        meta: ["nick", "mail", "link"],
        requiredMeta: ["nick"],
        pageSize: 10,
        wordLimit: 1000,
      });
      commentsLoading?.remove();
    } catch {
      if (commentsLoading instanceof HTMLElement) {
        commentsLoading.innerHTML = 'The comments could not connect. <a href="/marginalia/">Open the comments page</a>.';
      }
    }
  }

  function renderStory() {
    storyFrame = 0;
    let seeksPending = false;
    const response = reduceMotion.matches ? 1 : Math.abs(targetStoryTime - renderedStoryTime) > 2 ? 0.24 : 0.13;
    renderedStoryTime = mix(renderedStoryTime, targetStoryTime, response);
    if (Math.abs(targetStoryTime - renderedStoryTime) < 0.001) renderedStoryTime = targetStoryTime;

    const introOpacity = 1 - smoothstep(0, CROSSFADE_SECONDS, renderedStoryTime);
    if (introVideo instanceof HTMLVideoElement) {
      introVideo.style.setProperty("--intro-opacity", introOpacity.toFixed(4));
    }
    if (introForeground instanceof HTMLCanvasElement) {
      introForeground.style.opacity = introOpacity.toFixed(4);
    }
    if (introDisplay instanceof HTMLElement) {
      introDisplay.style.opacity = introOpacity.toFixed(4);
    }

    storyVideos.forEach((video, index) => {
      if (!(video instanceof HTMLVideoElement)) return;
      const timelineDuration = durations[index] || FALLBACK_DURATION;
      const timelineProgress = clamp((renderedStoryTime - offsets[index]) / timelineDuration);
      const mediaProgress = Math.pow(timelineProgress, scrollPowers[index] || 1);
      const localTarget = mediaProgress * (mediaDurations[index] || FALLBACK_DURATION);
      video.style.opacity = videoOpacity(index, renderedStoryTime).toFixed(4);
      seeksPending = seekVideo(video, localTarget) || seeksPending;
    });
    if (introVideo instanceof HTMLVideoElement) {
      const atOpening = lastScrollY <= 2;
      if (reduceMotion.matches) {
        introVideo.pause();
        introMaskVideo?.pause();
        seeksPending = seekVideo(introVideo, 0.08) || seeksPending;
        seeksPending = seekVideo(introMaskVideo, 0.08) || seeksPending;
      } else if (finePointer.matches) {
        introVideo.pause();
        introMaskVideo?.pause();
        const fallbackSafeTime = introFallbackActive ? 0.08 : atOpening ? introTargetTime : 0.08;
        seeksPending = seekVideo(introVideo, fallbackSafeTime) || seeksPending;
        seeksPending = seekVideo(introMaskVideo, fallbackSafeTime) || seeksPending;
      } else if (atOpening && document.visibilityState === "visible") {
        if (introFallbackActive) {
          introVideo.pause();
          introMaskVideo?.pause();
          seeksPending = seekVideo(introVideo, 0.08) || seeksPending;
          seeksPending = seekVideo(introMaskVideo, 0.08) || seeksPending;
        } else {
          const playbackStarts = [];
          if (introVideo.paused) playbackStarts.push(introVideo.play());
          if (introMaskVideo instanceof HTMLVideoElement && introMaskVideo.paused) {
            playbackStarts.push(introMaskVideo.play());
          }
          if (playbackStarts.length) {
            Promise.allSettled(playbackStarts).then((results) => {
              if (results.some((result) => result.status === "rejected")) {
                enableIntroFallback({ freeze: true });
              }
            });
          }
        }
      } else {
        introVideo.pause();
        introMaskVideo?.pause();
        seeksPending = seekVideo(introVideo, 0.08) || seeksPending;
        seeksPending = seekVideo(introMaskVideo, 0.08) || seeksPending;
      }
      if (introOpacity > 0.002) introCompositor?.draw();
    }

    const aboutStart = timelineTimeForMedia(0, 2.55);
    const aboutEnd = timelineTimeForMedia(1, 0.45);
    const folderStart = timelineTimeForMedia(2, 3.25);
    const folderFadeStart = timelineTimeForMedia(3, 1.45);
    const folderEnd = timelineTimeForMedia(3, 1.55);
    const commentsStart = timelineTimeForMedia(3, 2.05);

    const introSceneOpacity = 1 - smoothstep(0.62, 1.35, renderedStoryTime);
    const aboutOpacity = smoothstep(2.55, 3.18, renderedStoryTime) *
      (1 - smoothstep(aboutEnd - 0.45, aboutEnd + 0.35, renderedStoryTime));
    const folderOpacity = smoothstep(folderStart, folderStart + 0.006, renderedStoryTime) *
      (1 - smoothstep(folderFadeStart, folderEnd, renderedStoryTime));
    const commentsOpacity = smoothstep(commentsStart, commentsStart + 0.72, renderedStoryTime);
    const folderPresent = renderedStoryTime >= folderStart && renderedStoryTime < folderEnd;

    updateFolderTarget(renderedStoryTime);

    setPanel("intro", introSceneOpacity, {
      interactive: introSceneOpacity > 0.62,
      accessible: introSceneOpacity > 0.5,
    });
    setPanel("about", aboutOpacity, { accessible: aboutOpacity > 0.5 });
    setPanel("folder", folderOpacity, {
      interactive: folderPresent,
      accessible: folderPresent,
    });
    setPanel("comments", commentsOpacity, {
      interactive: commentsOpacity > 0.72,
      accessible: commentsOpacity > 0.72,
    });

    const nextScene = renderedStoryTime < aboutStart
      ? "intro"
      : renderedStoryTime < folderStart
        ? "about"
        : renderedStoryTime < folderEnd
          ? "folder"
          : renderedStoryTime < commentsStart
            ? "fall"
            : "comments";

    if (currentScene !== nextScene) {
      currentScene = nextScene;
      app.dataset.scene = currentScene;
      const chapter = currentScene === "intro" ? 1 : currentScene === "about" ? 2 : currentScene === "folder" ? 3 : 4;
      if (progressNumber instanceof HTMLElement) progressNumber.textContent = String(chapter).padStart(2, "0");

      storyLinks.forEach((link) => {
        if (!(link instanceof HTMLAnchorElement)) return;
        const key = link.dataset.storyLink;
        const active = (key === "home" && currentScene === "intro") ||
          (key === "about" && currentScene === "about") ||
          (key === "comments" && currentScene === "comments");
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    }

    if (commentsOpacity > 0.025) startComments();
    if (seeksPending || Math.abs(targetStoryTime - renderedStoryTime) >= 0.001) scheduleStory();
  }

  function cuePointer(event) {
    const atOpening = window.scrollY <= 2 && currentScene === "intro";
    introPointerActive = atOpening && finePointer.matches;
    markerTargetX = event.clientX;
    markerTargetY = event.clientY;
    schedulePointer();
    scheduleStory();

    if (marker instanceof HTMLElement) marker.classList.toggle("is-visible", introPointerActive);
    if (!introPointerActive || !(introVideo instanceof HTMLVideoElement)) return;

    const normalizedX = clamp(event.clientX / window.innerWidth);
    const normalizedY = clamp(event.clientY / window.innerHeight);
    const horizontal = normalizedX - 0.5;
    const vertical = normalizedY - 0.5;
    const distance = Math.hypot(horizontal, vertical);

    if (distance < 0.13) {
      introTargetTime = 0.5;
    } else if (Math.abs(horizontal) >= Math.abs(vertical)) {
      const intensity = clamp((Math.abs(horizontal) - 0.08) / 0.42);
      introTargetTime = horizontal > 0 ? mix(1.05, 2.55, intensity) : mix(5.55, 7.15, intensity);
    } else {
      const intensity = clamp((Math.abs(vertical) - 0.08) / 0.42);
      introTargetTime = vertical < 0 ? mix(4.45, 5.2, intensity) : mix(7.5, 8.95, intensity);
    }
  }

  function resetPointer() {
    introPointerActive = false;
    introTargetTime = 0.08;
    if (marker instanceof HTMLElement) marker.classList.remove("is-visible");
    ripple?.clear();
  }

  let ripple = null;
  let previousWaveX = -100;
  let previousWaveY = -100;
  let previousWaveTime = 0;
  let pointerFrame = 0;

  function schedulePointer() {
    if (pointerFrame === 0) pointerFrame = requestAnimationFrame(renderPointer);
  }

  function addWave(x, y, kind = "move") {
    if (!introPointerActive || reduceMotion.matches || !finePointer.matches || !ripple) return;
    const now = performance.now();
    if (kind === "move") {
      const distance = Math.hypot(x - previousWaveX, y - previousWaveY);
      if (distance < 15 || now - previousWaveTime < 38) return;
    }
    ripple.add(x, y, kind);
    previousWaveX = x;
    previousWaveY = y;
    previousWaveTime = now;
  }

  function renderPointer() {
    pointerFrame = 0;
    if (marker instanceof HTMLElement) {
      markerX = mix(markerX, markerTargetX, 0.34);
      markerY = mix(markerY, markerTargetY, 0.34);
      marker.style.transform = `translate3d(${markerX - 3.5}px, ${markerY - 3.5}px, 0)`;
      if (
        introPointerActive &&
        (Math.abs(markerX - markerTargetX) > 0.2 || Math.abs(markerY - markerTargetY) > 0.2)
      ) {
        schedulePointer();
      }
    }
  }

  async function openBlog() {
    if (isNavigating) return;
    isNavigating = true;
    app.classList.add("is-bursting");
    resetPointer();

    let navigated = false;
    const navigate = () => {
      if (navigated) return;
      navigated = true;
      window.location.assign("/blog/");
    };
    const fallbackTimer = window.setTimeout(navigate, 1700);

    if (reduceMotion.matches) {
      window.clearTimeout(fallbackTimer);
      navigate();
      return;
    }

    if (!(folderBurst instanceof HTMLVideoElement)) {
      window.clearTimeout(fallbackTimer);
      navigate();
      return;
    }

    folderBurst.currentTime = 0;
    folderBurst.playbackRate = 3.2;
    folderBurst.addEventListener("ended", navigate, { once: true });
    try {
      await folderBurst.play();
    } catch {
      window.clearTimeout(fallbackTimer);
      navigate();
    }
  }

  storyVideos.forEach((video) => {
    if (!(video instanceof HTMLVideoElement)) return;
    video.muted = true;
    video.pause();
    video.addEventListener("loadedmetadata", rebuildTimeline);
    video.addEventListener("seeked", scheduleStory);
    video.addEventListener("error", () => app.classList.add("has-video-error"));
  });

  if (introVideo instanceof HTMLVideoElement) {
    introVideo.muted = true;
    introVideo.addEventListener("loadedmetadata", () => {
      if (finePointer.matches || reduceMotion.matches) {
        introVideo.pause();
        seekVideo(introVideo, introTargetTime, true);
      }
      scheduleStory();
    });
    introVideo.addEventListener("seeked", scheduleStory);
    introVideo.addEventListener("error", () => enableIntroFallback({ freeze: true }));
  }

  if (introMaskVideo instanceof HTMLVideoElement) {
    introMaskVideo.muted = true;
    introMaskVideo.addEventListener("loadedmetadata", () => {
      introMaskVideo.pause();
      seekVideo(introMaskVideo, introTargetTime, true);
      scheduleStory();
    });
    introMaskVideo.addEventListener("seeked", () => {
      introCompositor?.draw();
      scheduleStory();
    });
    introMaskVideo.addEventListener("error", () => {
      enableIntroFallback({ freeze: true });
    });
  }

  folderTrigger?.addEventListener("click", openBlog);

  storyLinks.forEach((link) => {
    if (!(link instanceof HTMLAnchorElement)) return;
    link.addEventListener("click", (event) => {
      const key = link.dataset.storyLink;
      const target = key ? app.querySelector(`[data-anchor="${key}"]`) : null;
      if (!(target instanceof HTMLElement)) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion.matches ? "auto" : "smooth", block: "start" });
      window.history.replaceState({}, "", `#${target.id}`);
    });
  });

  window.addEventListener("scroll", () => {
    updateScrollTarget();
    if (window.scrollY > 2) resetPointer();
  }, { passive: true });
  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      rebuildTimeline();
      introCompositor?.resize();
      ripple?.resize();
    });
  });
  window.addEventListener("pointermove", (event) => {
    cuePointer(event);
    addWave(event.clientX, event.clientY, "move");
  }, { passive: true });
  window.addEventListener("pointerdown", (event) => {
    cuePointer(event);
    addWave(event.clientX, event.clientY, "click");
  }, { passive: true });
  document.documentElement.addEventListener("mouseleave", resetPointer);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      introVideo?.pause();
      introMaskVideo?.pause();
      storyVideos.forEach((video) => video.pause());
      folderBurst?.pause();
      ripple?.clear();
    } else {
      scheduleStory();
    }
  });
  window.addEventListener("pageshow", scheduleStory);
  window.addEventListener("pagehide", (event) => {
    if (event.persisted) return;
    comments?.destroy?.();
    comments = null;
    commentsStarted = false;
    ripple?.destroy();
    ripple = null;
    introCompositor?.destroy();
    introCompositor = null;
  });

  const unlockVideos = () => {
    [introVideo, introMaskVideo, ...storyVideos, folderBurst].forEach((video) => {
      if (!(video instanceof HTMLVideoElement) || video.readyState < 1) return;
      const previousTime = video.currentTime;
      video.play()
        .then(() => {
          const isIntroLayer = video === introVideo || video === introMaskVideo;
          if (!isIntroLayer || finePointer.matches || window.scrollY > 2) video.pause();
          if (video !== folderBurst) seekVideo(video, previousTime, true);
        })
        .catch(() => undefined);
    });
  };
  window.addEventListener("pointerdown", unlockVideos, { once: true, passive: true });
  window.addEventListener("touchstart", unlockVideos, { once: true, passive: true });

  if (
    canvas instanceof HTMLCanvasElement &&
    introVideo instanceof HTMLVideoElement &&
    finePointer.matches &&
    !reduceMotion.matches
  ) {
    ripple = createVideoRipple(canvas, introVideo);
  }
  if (
    introForeground instanceof HTMLCanvasElement &&
    introVideo instanceof HTMLVideoElement &&
    introMaskVideo instanceof HTMLVideoElement
  ) {
    introCompositor = createIntroCompositor(
      introForeground,
      introVideo,
      introMaskVideo,
      () => enableIntroFallback({ freeze: true }),
    );
    if (!introCompositor) {
      enableIntroFallback({ freeze: true });
    }
  }
  rebuildTimeline();
  scheduleStory();
}
