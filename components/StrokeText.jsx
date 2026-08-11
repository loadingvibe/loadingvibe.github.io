"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "./StrokeText.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

export default function StrokeText({
  text = "Draw Attention",
  strokeColor = "#A78BFA",
  fillColor = "#F8FAFC",
  strokeWidth = 1.4,
  drawDuration = 1.6,
  fillDelay = 0.2,
  loopDelay = 4.5,
  stagger = 0.05,
  ease = "power2.out",
  trigger = "mount",
  fillMode = "wipe",
  fontSize = 128,
  fontWeight = 800,
  letterSpacing = -4,
  reverse = false,
  className = "",
  style = {},
}) {
  const rootRef = useRef(null);
  const strokeTextRef = useRef(null);
  const wipeRectRef = useRef(null);
  const [box, setBox] = useState(null);
  const rawId = useId();
  const wipeId = `stroke-text-wipe-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const characters = useMemo(() => Array.from(String(text ?? "")), [text]);
  const dash = Math.max(fontSize * 7, 200);
  const fontStyle = useMemo(
    () => ({ fontSize: `${fontSize}px`, fontWeight, letterSpacing: `${letterSpacing}px` }),
    [fontSize, fontWeight, letterSpacing],
  );

  useLayoutEffect(() => {
    const node = strokeTextRef.current;
    if (!node) return undefined;
    let cancelled = false;
    const measure = () => {
      if (cancelled || !strokeTextRef.current) return;
      let bbox;
      try {
        bbox = strokeTextRef.current.getBBox();
      } catch {
        return;
      }
      if (!bbox?.width) return;
      const pad = Math.max(Number(strokeWidth) || 1, fontSize * 0.1);
      const next = {
        x: bbox.x - pad,
        y: bbox.y - pad,
        width: bbox.width + pad * 2,
        height: bbox.height + pad * 2,
      };
      setBox((previous) => (
        previous
        && Math.abs(previous.x - next.x) < 0.5
        && Math.abs(previous.width - next.width) < 0.5
        && Math.abs(previous.y - next.y) < 0.5
          ? previous
          : next
      ));
    };
    measure();
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => { cancelled = true; };
  }, [characters, fontSize, fontWeight, letterSpacing, strokeWidth]);

  useEffect(() => {
    const root = rootRef.current;
    if (typeof window === "undefined" || !root || !box) return undefined;
    const strokes = gsap.utils.toArray(root.querySelectorAll("[data-stroke-char]"));
    const fills = gsap.utils.toArray(root.querySelectorAll("[data-fill-char]"));
    const wipe = wipeRectRef.current;
    if (!strokes.length) return undefined;

    const fillEnabled = fillMode !== "none";
    const useWipe = fillEnabled && fillMode === "wipe";
    const fillDuration = Math.max(0.4, drawDuration * 0.5);
    const staggerConfig = reverse ? { each: stagger, from: "end" } : stagger;
    const targets = [...strokes, ...fills, wipe].filter(Boolean);
    const setStart = () => {
      gsap.killTweensOf(targets);
      gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: dash });
      gsap.set(fills, { opacity: useWipe ? 1 : 0 });
      if (wipe) gsap.set(wipe, { attr: { width: 0 } });
    };
    const setEnd = () => {
      gsap.killTweensOf(targets);
      gsap.set(strokes, { strokeDasharray: dash, strokeDashoffset: 0 });
      gsap.set(fills, { opacity: fillEnabled ? 1 : 0 });
      if (wipe) gsap.set(wipe, { attr: { width: fillEnabled ? box.width : 0 } });
    };

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setEnd();
      return () => gsap.killTweensOf(targets);
    }

    const build = () => {
      setStart();
      const timeline = gsap.timeline({
        paused: true,
        repeat: trigger === "loop" ? -1 : 0,
        repeatDelay: trigger === "loop" ? Math.max(0, loopDelay) : 0,
        defaults: { overwrite: "auto" },
      });
      timeline.to(strokes, { strokeDashoffset: 0, duration: drawDuration, ease, stagger: staggerConfig }, 0);
      if (useWipe && wipe) {
        timeline.to(wipe, { attr: { width: box.width }, duration: fillDuration, ease: "power2.inOut" }, drawDuration + fillDelay);
      } else if (fillEnabled) {
        timeline.to(fills, { opacity: 1, duration: fillDuration, ease: "power2.out", stagger: staggerConfig }, drawDuration + fillDelay);
      }
      return timeline;
    };

    let timeline = null;
    let scrollTrigger = null;
    let removeHover = null;
    if (trigger === "hover") {
      setEnd();
      const play = () => {
        timeline?.kill();
        timeline = build();
        timeline.play(0);
      };
      root.addEventListener("pointerenter", play);
      removeHover = () => root.removeEventListener("pointerenter", play);
    } else {
      timeline = build();
      if (trigger === "scroll") {
        scrollTrigger = ScrollTrigger.create({
          trigger: root,
          start: "top 82%",
          once: true,
          onEnter: () => timeline?.play(0),
        });
      } else {
        timeline.play(0);
      }
    }

    return () => {
      removeHover?.();
      scrollTrigger?.kill();
      timeline?.kill();
      gsap.killTweensOf(targets);
    };
  }, [box, dash, drawDuration, fillDelay, loopDelay, stagger, ease, trigger, fillMode, reverse]);

  const viewBox = box
    ? `${box.x} ${box.y} ${box.width} ${box.height}`
    : `0 ${-fontSize} 600 ${fontSize * 1.3}`;

  return (
    <span
      ref={rootRef}
      className={`stroke-text ${trigger === "hover" ? "stroke-text--hover" : ""} ${className}`.trim()}
      style={{ ...style, "--stroke-text-height": `${Math.round(fontSize * 1.3)}px` }}
      role="img"
      aria-label={String(text ?? "")}
    >
      <svg className="stroke-text__svg" viewBox={viewBox} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        {fillMode === "wipe" && box && (
          <defs>
            <clipPath id={wipeId} clipPathUnits="userSpaceOnUse">
              <rect ref={wipeRectRef} x={box.x} y={box.y} width="0" height={box.height} />
            </clipPath>
          </defs>
        )}
        <text
          ref={strokeTextRef}
          className="stroke-text__stroke"
          x="0"
          y="0"
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          style={fontStyle}
        >
          {characters.map((character, index) => (
            <tspan data-stroke-char key={`s-${index}`}>{character}</tspan>
          ))}
        </text>
        <text
          className="stroke-text__fill"
          x="0"
          y="0"
          fill={fillColor}
          stroke="none"
          style={fontStyle}
          clipPath={fillMode === "wipe" && box ? `url(#${wipeId})` : undefined}
        >
          {characters.map((character, index) => (
            <tspan data-fill-char key={`f-${index}`}>{character}</tspan>
          ))}
        </text>
      </svg>
    </span>
  );
}
