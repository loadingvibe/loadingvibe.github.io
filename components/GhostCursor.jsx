"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import "./GhostCursor.css";

export default function GhostCursor({
  className = "",
  style,
  trailLength = 36,
  inertia = 0.5,
  grainIntensity = 0.035,
  bloomStrength = 0.08,
  bloomRadius = 0.8,
  bloomThreshold = 0.03,
  brightness = 1.15,
  color = "#58b9e8",
  mixBlendMode = "multiply",
  edgeIntensity = 0.08,
  maxDevicePixelRatio = 0.75,
  targetPixels,
  fadeDelayMs,
  fadeDurationMs,
  zIndex = 0,
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const composerRef = useRef(null);
  const materialRef = useRef(null);
  const filmPassRef = useRef(null);
  const trailBufferRef = useRef([]);
  const headRef = useRef(0);
  const frameRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const mouseRef = useRef(new THREE.Vector2(0.5, 0.5));
  const velocityRef = useRef(new THREE.Vector2(0, 0));
  const fadeOpacityRef = useRef(1);
  const lastMoveRef = useRef(typeof performance !== "undefined" ? performance.now() : Date.now());
  const pointerActiveRef = useRef(false);
  const runningRef = useRef(false);
  const validSizeRef = useRef(false);

  const isTouch = useMemo(
    () => typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0),
    [],
  );
  const pixelBudget = targetPixels ?? (isTouch ? 600000 : 900000);
  const fadeDelay = fadeDelayMs ?? (isTouch ? 450 : 850);
  const fadeDuration = fadeDurationMs ?? (isTouch ? 850 : 1350);

  const filmGrainShader = useMemo(
    () => ({
      uniforms: { tDiffuse: { value: null }, iTime: { value: 0 }, intensity: { value: grainIntensity } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float iTime;
        uniform float intensity;
        varying vec2 vUv;
        float hash1(float n) { return fract(sin(n) * 43758.5453); }
        void main() {
          vec4 sampled = texture2D(tDiffuse, vUv);
          float grain = hash1(vUv.x * 1000.0 + vUv.y * 2000.0 + iTime) * 2.0 - 1.0;
          sampled.rgb += grain * intensity * sampled.rgb;
          gl_FragColor = sampled;
        }
      `,
    }),
    [grainIntensity],
  );

  const unpremultiplyPass = useMemo(
    () => new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
          vec4 sampled = texture2D(tDiffuse, vUv);
          float alpha = max(sampled.a, 0.00001);
          gl_FragColor = vec4(clamp(sampled.rgb / alpha, 0.0, 1.0), sampled.a);
        }
      `,
    }),
    [],
  );

  useEffect(() => {
    const host = containerRef.current;
    const parent = host?.parentElement;
    if (!host || !parent) return undefined;

    let mounted = true;
    const previousPosition = parent.style.position;
    if (!previousPosition || previousPosition === "static") parent.style.position = "relative";

    const renderer = new THREE.WebGLRenderer({
      antialias: !isTouch,
      alpha: true,
      depth: false,
      stencil: false,
      powerPreference: isTouch ? "low-power" : "high-performance",
      premultipliedAlpha: false,
    });
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.pointerEvents = "none";
    renderer.domElement.style.mixBlendMode = mixBlendMode;
    rendererRef.current = renderer;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const maximumTrail = Math.max(1, Math.floor(trailLength));
    trailBufferRef.current = Array.from({ length: maximumTrail }, () => new THREE.Vector2(0.5, 0.5));
    const baseColor = new THREE.Color(color);

    const material = new THREE.ShaderMaterial({
      defines: { MAX_TRAIL_LENGTH: maximumTrail },
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new THREE.Vector3(1, 1, 1) },
        iMouse: { value: new THREE.Vector2(0.5, 0.5) },
        iPrevMouse: { value: trailBufferRef.current.map((value) => value.clone()) },
        iOpacity: { value: 1 },
        iScale: { value: 1 },
        iBaseColor: { value: new THREE.Vector3(baseColor.r, baseColor.g, baseColor.b) },
        iBrightness: { value: brightness },
        iEdgeIntensity: { value: edgeIntensity },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float iTime;
        uniform vec3 iResolution;
        uniform vec2 iMouse;
        uniform vec2 iPrevMouse[MAX_TRAIL_LENGTH];
        uniform float iOpacity;
        uniform float iScale;
        uniform vec3 iBaseColor;
        uniform float iBrightness;
        uniform float iEdgeIntensity;
        varying vec2 vUv;

        float hash(vec2 point) { return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 point) {
          vec2 index = floor(point);
          vec2 fraction = fract(point);
          fraction *= fraction * (3.0 - 2.0 * fraction);
          return mix(
            mix(hash(index), hash(index + vec2(1.0, 0.0)), fraction.x),
            mix(hash(index + vec2(0.0, 1.0)), hash(index + vec2(1.0)), fraction.x),
            fraction.y
          );
        }
        float fbm(vec2 point) {
          float value = 0.0;
          float amplitude = 0.5;
          mat2 rotation = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
          for (int octave = 0; octave < 5; octave++) {
            value += amplitude * noise(point);
            point = rotation * point * 2.0;
            amplitude *= 0.5;
          }
          return value;
        }
        vec4 blob(vec2 point, vec2 mousePosition, float intensity, float activity) {
          vec2 q = vec2(
            fbm(point * iScale + iTime * 0.1),
            fbm(point * iScale + vec2(5.2, 1.3) + iTime * 0.1)
          );
          vec2 r = vec2(
            fbm(point * iScale + q * 1.5 + iTime * 0.15),
            fbm(point * iScale + q * 1.5 + vec2(8.3, 2.8) + iTime * 0.15)
          );
          float smoke = fbm(point * iScale + r * 0.8);
          float radius = 0.5 + 0.3 * (1.0 / iScale);
          float distanceFactor = 1.0 - smoothstep(0.0, radius * activity, length(point - mousePosition));
          float alpha = pow(smoke, 2.5) * distanceFactor;
          vec3 firstTint = mix(iBaseColor, vec3(1.0), 0.15);
          vec3 secondTint = mix(iBaseColor, vec3(0.8, 0.9, 1.0), 0.25);
          vec3 outputColor = mix(firstTint, secondTint, sin(iTime * 0.5) * 0.5 + 0.5);
          return vec4(outputColor * alpha * intensity, alpha * intensity);
        }
        void main() {
          vec2 aspect = vec2(iResolution.x / iResolution.y, 1.0);
          vec2 point = (gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0) * aspect;
          vec2 mousePosition = (iMouse * 2.0 - 1.0) * aspect;
          vec3 accumulatedColor = vec3(0.0);
          float accumulatedAlpha = 0.0;
          vec4 head = blob(point, mousePosition, 1.0, iOpacity);
          accumulatedColor += head.rgb;
          accumulatedAlpha += head.a;
          for (int index = 0; index < MAX_TRAIL_LENGTH; index++) {
            vec2 previous = (iPrevMouse[index] * 2.0 - 1.0) * aspect;
            float trail = pow(1.0 - float(index) / float(MAX_TRAIL_LENGTH), 2.0);
            if (trail > 0.01) {
              vec4 sampleBlob = blob(point, previous, trail * 0.8, iOpacity);
              accumulatedColor += sampleBlob.rgb;
              accumulatedAlpha += sampleBlob.a;
            }
          }
          accumulatedColor *= iBrightness;
          vec2 normalized = gl_FragCoord.xy / iResolution.xy;
          float edgeDistance = min(min(normalized.x, 1.0 - normalized.x), min(normalized.y, 1.0 - normalized.y));
          float edgeMask = mix(1.0 - clamp(iEdgeIntensity, 0.0, 1.0), 1.0, clamp(edgeDistance * 2.0, 0.0, 1.0));
          gl_FragColor = vec4(accumulatedColor, clamp(accumulatedAlpha * iOpacity * edgeMask, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    materialRef.current = material;
    scene.add(new THREE.Mesh(geometry, material));

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), bloomStrength, bloomRadius, bloomThreshold);
    composer.addPass(bloomPass);
    const filmPass = new ShaderPass(filmGrainShader);
    composer.addPass(filmPass);
    composer.addPass(unpremultiplyPass);
    composerRef.current = composer;
    filmPassRef.current = filmPass;

    const resize = () => {
      if (!mounted) return;
      const rectangle = host.getBoundingClientRect();
      const width = Math.floor(rectangle.width);
      const height = Math.floor(rectangle.height);
      if (width <= 0 || height <= 0) {
        validSizeRef.current = false;
        return;
      }
      const deviceRatio = Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio);
      const neededPixels = width * height * deviceRatio * deviceRatio;
      const budgetScale = neededPixels <= pixelBudget ? 1 : Math.max(0.5, Math.sqrt(pixelBudget / neededPixels));
      const pixelRatio = deviceRatio * Math.min(1, budgetScale);
      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      composer.setPixelRatio?.(pixelRatio);
      composer.setSize(width, height);
      const pixelWidth = Math.max(1, Math.floor(width * pixelRatio));
      const pixelHeight = Math.max(1, Math.floor(height * pixelRatio));
      material.uniforms.iResolution.value.set(pixelWidth, pixelHeight, 1);
      material.uniforms.iScale.value = Math.max(0.5, Math.min(2, Math.min(width, height) / 350));
      bloomPass.setSize(pixelWidth, pixelHeight);
      validSizeRef.current = true;
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(parent);
    resizeObserver.observe(host);
    resizeObserverRef.current = resizeObserver;

    const startedAt = performance.now();
    const animate = () => {
      if (!mounted) return;
      if (!validSizeRef.current) {
        frameRef.current = requestAnimationFrame(animate);
        return;
      }
      const now = performance.now();
      if (pointerActiveRef.current) {
        velocityRef.current.set(
          mouseRef.current.x - material.uniforms.iMouse.value.x,
          mouseRef.current.y - material.uniforms.iMouse.value.y,
        );
        material.uniforms.iMouse.value.copy(mouseRef.current);
        fadeOpacityRef.current = 1;
      } else {
        velocityRef.current.multiplyScalar(inertia);
        if (velocityRef.current.lengthSq() > 0.000001) material.uniforms.iMouse.value.add(velocityRef.current);
        const idleTime = now - lastMoveRef.current;
        if (idleTime > fadeDelay) fadeOpacityRef.current = Math.max(0, 1 - (idleTime - fadeDelay) / fadeDuration);
      }
      const total = trailBufferRef.current.length;
      headRef.current = (headRef.current + 1) % total;
      trailBufferRef.current[headRef.current].copy(material.uniforms.iMouse.value);
      material.uniforms.iPrevMouse.value.forEach((value, index) => {
        value.copy(trailBufferRef.current[(headRef.current - index + total) % total]);
      });
      material.uniforms.iOpacity.value = fadeOpacityRef.current;
      material.uniforms.iTime.value = (now - startedAt) / 1000;
      filmPass.uniforms.iTime.value = (now - startedAt) / 1000;
      composer.render();
      if (!pointerActiveRef.current && fadeOpacityRef.current <= 0.001) {
        runningRef.current = false;
        frameRef.current = null;
        return;
      }
      frameRef.current = requestAnimationFrame(animate);
    };

    const ensureAnimation = () => {
      if (!runningRef.current) {
        runningRef.current = true;
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    const handlePointerMove = (event) => {
      const rectangle = parent.getBoundingClientRect();
      mouseRef.current.set(
        THREE.MathUtils.clamp((event.clientX - rectangle.left) / Math.max(1, rectangle.width), 0, 1),
        THREE.MathUtils.clamp(1 - (event.clientY - rectangle.top) / Math.max(1, rectangle.height), 0, 1),
      );
      pointerActiveRef.current = true;
      lastMoveRef.current = performance.now();
      ensureAnimation();
    };
    const handlePointerEnter = () => {
      pointerActiveRef.current = true;
      ensureAnimation();
    };
    const handlePointerLeave = () => {
      pointerActiveRef.current = false;
      lastMoveRef.current = performance.now();
      ensureAnimation();
    };

    parent.addEventListener("pointermove", handlePointerMove, { passive: true });
    parent.addEventListener("pointerenter", handlePointerEnter, { passive: true });
    parent.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    ensureAnimation();

    return () => {
      mounted = false;
      validSizeRef.current = false;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      runningRef.current = false;
      parent.removeEventListener("pointermove", handlePointerMove);
      parent.removeEventListener("pointerenter", handlePointerEnter);
      parent.removeEventListener("pointerleave", handlePointerLeave);
      resizeObserverRef.current?.disconnect();
      scene.clear();
      geometry.dispose();
      material.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      if (!previousPosition || previousPosition === "static") parent.style.position = previousPosition;
    };
  }, [
    bloomRadius,
    bloomStrength,
    bloomThreshold,
    brightness,
    color,
    edgeIntensity,
    fadeDelay,
    fadeDuration,
    filmGrainShader,
    inertia,
    isTouch,
    maxDevicePixelRatio,
    mixBlendMode,
    pixelBudget,
    trailLength,
    unpremultiplyPass,
  ]);

  useEffect(() => {
    if (!materialRef.current) return;
    const nextColor = new THREE.Color(color);
    materialRef.current.uniforms.iBaseColor.value.set(nextColor.r, nextColor.g, nextColor.b);
  }, [color]);

  useEffect(() => {
    if (materialRef.current) materialRef.current.uniforms.iBrightness.value = brightness;
  }, [brightness]);

  useEffect(() => {
    if (filmPassRef.current?.uniforms?.intensity) filmPassRef.current.uniforms.intensity.value = grainIntensity;
  }, [grainIntensity]);

  const mergedStyle = useMemo(() => ({ zIndex, ...style }), [style, zIndex]);
  return <div ref={containerRef} className={`ghost-cursor ${className}`} style={mergedStyle} aria-hidden="true" />;
}
