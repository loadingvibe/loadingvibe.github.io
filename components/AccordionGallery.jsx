"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import "./AccordionGallery.css";

const DEFAULT_ITEMS = [
  { image: "https://picsum.photos/id/1015/900/1200", label: "Canyon" },
  { image: "https://picsum.photos/id/1018/900/1200", label: "Ridgeline" },
  { image: "https://picsum.photos/id/1039/900/1200", label: "Falls" },
  { image: "https://picsum.photos/id/1043/900/1200", label: "Harbour" },
  { image: "https://picsum.photos/id/1044/900/1200", label: "Skyline" },
];

export default function AccordionGallery({
  items = DEFAULT_ITEMS,
  defaultIndex = 2,
  accentColor = "#ffffff",
  overlayColor = "#060010",
  textColor = "#ffffff",
  height = 460,
  gap = 10,
  radius = 16,
  expandRatio = 0.52,
  orientation = "horizontal",
  duration = 0.6,
  ease = "power3.out",
  parallax = 0.5,
  tilt = 8,
  stagger = 0.06,
  trigger = "hover",
  showLabels = true,
  grayscale = true,
  className = "",
}) {
  const rootRef = useRef(null);
  const panelRefs = useRef([]);
  const mediaRefs = useRef([]);
  const barRefs = useRef([]);
  const textRefs = useRef([]);
  const timelineRef = useRef(null);
  const firstRunRef = useRef(true);
  const mediaSizeRef = useRef(320);

  const vertical = orientation === "vertical";
  const count = items.length;
  const [active, setActive] = useState(Math.min(Math.max(defaultIndex, 0), count - 1));
  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const applyLayout = useCallback(
    (animate) => {
      const panels = panelRefs.current;
      if (!panels.length) return;

      const ratio = Math.min(Math.max(expandRatio, 0.2), 0.9);
      const grow = count > 1 ? (ratio * (count - 1)) / (1 - ratio) : 1;
      const mediaSize = mediaSizeRef.current;

      timelineRef.current?.kill();
      const animationDuration = animate && !prefersReduced ? duration : 0;
      const timeline = gsap.timeline();

      panels.forEach((panel, index) => {
        if (!panel) return;
        const isActive = index === active;
        const media = mediaRefs.current[index];
        const bar = barRefs.current[index];
        const text = textRefs.current[index];
        const rotation = isActive ? 0 : index < active ? tilt : -tilt;
        const rotationProperty = vertical ? { rotateX: -rotation } : { rotateY: rotation };

        timeline.to(
          panel,
          { flexGrow: isActive ? grow : 1, ...rotationProperty, duration: animationDuration, ease },
          0,
        );

        if (media) {
          const drift = Math.max(-1.5, Math.min(1.5, active - index));
          const shift = drift * parallax * mediaSize * 0.06;
          const gray = grayscale ? (isActive ? 0 : 1) : 0;
          timeline.to(
            media,
            {
              xPercent: -50,
              yPercent: -50,
              x: vertical ? 0 : isActive ? 0 : shift,
              y: vertical ? (isActive ? 0 : shift) : 0,
              "--ag-gray": gray,
              "--ag-dim": isActive ? 0 : 0.35,
              duration: animationDuration,
              ease,
            },
            0,
          );
        }

        if (showLabels && bar && text) {
          if (isActive) {
            timeline.to(
              [bar, text],
              { opacity: 1, x: 0, duration: animationDuration, ease, stagger: prefersReduced ? 0 : stagger },
              0,
            );
          } else {
            timeline.to(
              [bar, text],
              { opacity: 0, x: -14, duration: animationDuration * 0.6, ease },
              0,
            );
          }
        }
      });

      timelineRef.current = timeline;
    },
    [active, count, duration, ease, expandRatio, grayscale, parallax, prefersReduced, showLabels, stagger, tilt, vertical],
  );

  useEffect(() => {
    const element = rootRef.current;
    if (!element) return undefined;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const total = vertical ? rect.height : rect.width;
      const usable = Math.max(total - gap * (count - 1), 120);
      const size = Math.max(140, usable * Math.min(Math.max(expandRatio, 0.2), 0.9) * 1.22);
      mediaSizeRef.current = size;
      element.style.setProperty("--ag-media-size", `${size}px`);
      applyLayout(!firstRunRef.current);
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [applyLayout, count, expandRatio, gap, vertical]);

  useEffect(() => {
    applyLayout(!firstRunRef.current);
    firstRunRef.current = false;
  }, [applyLayout]);

  useEffect(
    () => () => {
      timelineRef.current?.kill();
    },
    [],
  );

  const handleClick = (index, event) => {
    if (index !== active) {
      event.preventDefault();
      setActive(index);
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index + 1) % count);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index - 1 + count) % count);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`accordion-gallery${vertical ? " accordion-gallery--vertical" : ""}${className ? ` ${className}` : ""}`}
      style={{
        "--ag-accent": accentColor,
        "--ag-overlay": overlayColor,
        "--ag-text": textColor,
        "--ag-gap": `${gap}px`,
        "--ag-radius": `${radius}px`,
        height: vertical ? `${Math.round(height * 1.6)}px` : `${height}px`,
      }}
      role="list"
      aria-label="Roy 的生活画廊"
    >
      {items.map((item, index) => {
        const isActive = index === active;
        const Tag = item.link ? "a" : "div";
        return (
          <Tag
            key={item.image}
            ref={(element) => { panelRefs.current[index] = element; }}
            className={`ag-panel${isActive ? " ag-panel--active" : ""}`}
            style={{ borderRadius: `${radius}px` }}
            href={item.link || undefined}
            onClick={(event) => handleClick(index, event)}
            onMouseEnter={() => { if (trigger === "hover") setActive(index); }}
            onFocus={() => setActive(index)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            role="listitem"
            tabIndex={0}
            aria-current={isActive ? "true" : undefined}
            aria-label={item.label}
          >
            <span className="ag-panel__frame">
              <span className="ag-panel__media" ref={(element) => { mediaRefs.current[index] = element; }}>
                <img src={item.image} alt={item.alt || item.label || ""} draggable="false" />
              </span>
              <span className="ag-panel__overlay" aria-hidden="true" />
            </span>
            {showLabels && (
              <span className="ag-panel__label" aria-hidden="true">
                <span className="ag-panel__bar" ref={(element) => { barRefs.current[index] = element; }} />
                <span className="ag-panel__text" ref={(element) => { textRefs.current[index] = element; }}>
                  {item.label}
                </span>
              </span>
            )}
          </Tag>
        );
      })}
    </div>
  );
}
