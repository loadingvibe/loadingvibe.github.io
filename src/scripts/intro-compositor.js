const VERTEX_SHADER = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  uniform vec2 u_uvScale;
  uniform vec2 u_uvOffset;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    vec2 baseUv = a_position * 0.5 + 0.5;
    v_uv = u_uvOffset + baseUv * u_uvScale;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 v_uv;
  uniform sampler2D u_source;
  uniform sampler2D u_mask;

  void main() {
    vec4 source = texture2D(u_source, v_uv);
    float maskValue = texture2D(u_mask, v_uv).r;
    float alpha = smoothstep(0.035, 0.965, maskValue);
    gl_FragColor = vec4(source.rgb * alpha, alpha);
  }
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vertex || !fragment) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

function createTexture(gl) {
  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  );
  return texture;
}

export function createIntroCompositor(canvas, sourceVideo, maskVideo, onUnavailable) {
  if (
    !(canvas instanceof HTMLCanvasElement) ||
    !(sourceVideo instanceof HTMLVideoElement) ||
    !(maskVideo instanceof HTMLVideoElement)
  ) return null;

  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;

  const program = createProgram(gl);
  const sourceTexture = createTexture(gl);
  const maskTexture = createTexture(gl);
  const buffer = gl.createBuffer();
  if (!program || !sourceTexture || !maskTexture || !buffer) return null;

  const positionLocation = gl.getAttribLocation(program, "a_position");
  const uvScaleLocation = gl.getUniformLocation(program, "u_uvScale");
  const uvOffsetLocation = gl.getUniformLocation(program, "u_uvOffset");
  const sourceLocation = gl.getUniformLocation(program, "u_source");
  const maskLocation = gl.getUniformLocation(program, "u_mask");
  let disposed = false;
  let videoFrameId = 0;
  let animationFrameId = 0;
  let unavailableSignaled = false;
  const maximumFrameDrift = 1 / 48;

  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(positionLocation);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.uniform1i(sourceLocation, 0);
  gl.uniform1i(maskLocation, 1);
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  function resize() {
    if (disposed) return;
    const viewportWidth = Math.max(1, window.innerWidth);
    const viewportHeight = Math.max(1, window.innerHeight);
    const sourceAspect = (sourceVideo.videoWidth || 1344) / (sourceVideo.videoHeight || 768);
    const usePortraitComposition = viewportWidth <= 760 && viewportHeight > viewportWidth;
    const cssHeight = usePortraitComposition
      ? Math.min(viewportHeight * 0.78, viewportWidth * 1.34)
      : viewportHeight;
    const cssWidth = usePortraitComposition ? cssHeight * sourceAspect : viewportWidth;
    const cssAspect = cssWidth / cssHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    let pixelWidth = Math.round(cssWidth * ratio);
    let pixelHeight = Math.round(cssHeight * ratio);
    const maxWidth = 1920;
    const maxHeight = 1200;

    if (pixelWidth > maxWidth) {
      pixelWidth = maxWidth;
      pixelHeight = Math.round(pixelWidth / cssAspect);
    }
    if (pixelHeight > maxHeight) {
      pixelHeight = maxHeight;
      pixelWidth = Math.round(pixelHeight * cssAspect);
    }

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.style.left = usePortraitComposition ? `${(viewportWidth - cssWidth) / 2}px` : "0px";
    canvas.style.top = usePortraitComposition ? `${viewportHeight - cssHeight}px` : "0px";
    canvas.style.right = "auto";
    canvas.style.bottom = "auto";
    gl.viewport(0, 0, canvas.width, canvas.height);
    draw();
  }

  function draw() {
    if (disposed || sourceVideo.readyState < 2 || maskVideo.readyState < 2) return false;
    if (!sourceVideo.videoWidth || !sourceVideo.videoHeight) return false;
    if (
      sourceVideo.seeking ||
      maskVideo.seeking ||
      Math.abs(sourceVideo.currentTime - maskVideo.currentTime) > maximumFrameDrift
    ) return false;

    const sourceAspect = sourceVideo.videoWidth / sourceVideo.videoHeight;
    const canvasAspect = canvas.width / canvas.height;
    let scaleX = 1;
    let scaleY = 1;
    let offsetX = 0;
    let offsetY = 0;

    if (sourceAspect > canvasAspect) {
      scaleX = canvasAspect / sourceAspect;
      offsetX = (1 - scaleX) / 2;
    } else {
      scaleY = sourceAspect / canvasAspect;
      offsetY = (1 - scaleY) / 2;
    }

    try {
      gl.useProgram(program);
      gl.uniform2f(uvScaleLocation, scaleX, scaleY);
      gl.uniform2f(uvOffsetLocation, offsetX, offsetY);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sourceTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceVideo);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, maskTexture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskVideo);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      return true;
    } catch {
      signalUnavailable();
      return false;
    }
  }

  function renderPlaybackFrame() {
    videoFrameId = 0;
    animationFrameId = 0;
    if (disposed) return;

    if (
      Math.abs(maskVideo.currentTime - sourceVideo.currentTime) > maximumFrameDrift &&
      !maskVideo.seeking
    ) {
      try {
        maskVideo.currentTime = sourceVideo.currentTime;
      } catch {
        // The next decoded frame retries after metadata is available.
      }
    }
    draw();
    if (sourceVideo.paused || sourceVideo.ended) return;

    if (typeof sourceVideo.requestVideoFrameCallback === "function") {
      videoFrameId = sourceVideo.requestVideoFrameCallback(renderPlaybackFrame);
    } else {
      animationFrameId = requestAnimationFrame(renderPlaybackFrame);
    }
  }

  function startPlaybackFrames() {
    if (videoFrameId || animationFrameId || disposed) return;
    renderPlaybackFrame();
  }

  function stopPlaybackFrames() {
    if (videoFrameId && typeof sourceVideo.cancelVideoFrameCallback === "function") {
      sourceVideo.cancelVideoFrameCallback(videoFrameId);
    }
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    videoFrameId = 0;
    animationFrameId = 0;
  }

  function signalUnavailable() {
    if (unavailableSignaled || disposed) return;
    unavailableSignaled = true;
    if (typeof onUnavailable === "function") onUnavailable();
  }

  function handleContextLost(event) {
    event.preventDefault();
    stopPlaybackFrames();
    signalUnavailable();
  }

  sourceVideo.addEventListener("play", startPlaybackFrames);
  sourceVideo.addEventListener("pause", stopPlaybackFrames);
  sourceVideo.addEventListener("ended", stopPlaybackFrames);
  sourceVideo.addEventListener("loadeddata", draw);
  sourceVideo.addEventListener("seeked", draw);
  maskVideo.addEventListener("loadeddata", draw);
  maskVideo.addEventListener("seeked", draw);
  canvas.addEventListener("webglcontextlost", handleContextLost);
  if (!sourceVideo.paused && !sourceVideo.ended) startPlaybackFrames();

  function destroy() {
    disposed = true;
    sourceVideo.removeEventListener("play", startPlaybackFrames);
    sourceVideo.removeEventListener("pause", stopPlaybackFrames);
    sourceVideo.removeEventListener("ended", stopPlaybackFrames);
    sourceVideo.removeEventListener("loadeddata", draw);
    sourceVideo.removeEventListener("seeked", draw);
    maskVideo.removeEventListener("loadeddata", draw);
    maskVideo.removeEventListener("seeked", draw);
    canvas.removeEventListener("webglcontextlost", handleContextLost);
    stopPlaybackFrames();
    gl.deleteTexture(sourceTexture);
    gl.deleteTexture(maskTexture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  }

  resize();
  return { draw, resize, destroy };
}
