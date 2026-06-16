import { Mesh, Program, Renderer, Triangle, Vec3 } from "ogl";
import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

interface VoicePoweredOrbProps {
  active?: boolean;
  className?: string;
  enableVoiceControl?: boolean;
  hue?: number;
  maxHoverIntensity?: number;
  maxRotationSpeed?: number;
  onVoiceDetected?: (detected: boolean) => void;
  voiceLevel?: number;
  voiceSensitivity?: number;
}

type BrowserWindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const vertexShader = /* glsl */ `
precision highp float;

attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform float hue;
uniform float hover;
uniform float rot;
uniform float hoverIntensity;
varying vec2 vUv;

vec3 rgb2yiq(vec3 c) {
  float y = dot(c, vec3(0.299, 0.587, 0.114));
  float i = dot(c, vec3(0.596, -0.274, -0.322));
  float q = dot(c, vec3(0.211, -0.523, 0.312));
  return vec3(y, i, q);
}

vec3 yiq2rgb(vec3 c) {
  float r = c.x + 0.956 * c.y + 0.621 * c.z;
  float g = c.x - 0.272 * c.y - 0.647 * c.z;
  float b = c.x - 1.106 * c.y + 1.703 * c.z;
  return vec3(r, g, b);
}

vec3 adjustHue(vec3 color, float hueDeg) {
  float hueRad = hueDeg * 3.14159265 / 180.0;
  vec3 yiq = rgb2yiq(color);
  float cosA = cos(hueRad);
  float sinA = sin(hueRad);
  float i = yiq.y * cosA - yiq.z * sinA;
  float q = yiq.y * sinA + yiq.z * cosA;
  yiq.y = i;
  yiq.z = q;
  return yiq2rgb(yiq);
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.11369, 0.13787));
  p3 += dot(p3, p3.yxz + 19.19);
  return -1.0 + 2.0 * fract(vec3(
    p3.x + p3.y,
    p3.x + p3.z,
    p3.y + p3.z
  ) * p3.zyx);
}

float snoise3(vec3 p) {
  const float K1 = 0.333333333;
  const float K2 = 0.166666667;
  vec3 i = floor(p + (p.x + p.y + p.z) * K1);
  vec3 d0 = p - (i - (i.x + i.y + i.z) * K2);
  vec3 e = step(vec3(0.0), d0 - d0.yzx);
  vec3 i1 = e * (1.0 - e.zxy);
  vec3 i2 = 1.0 - e.zxy * (1.0 - e);
  vec3 d1 = d0 - (i1 - K2);
  vec3 d2 = d0 - (i2 - K1);
  vec3 d3 = d0 - 0.5;
  vec4 h = max(0.6 - vec4(
    dot(d0, d0),
    dot(d1, d1),
    dot(d2, d2),
    dot(d3, d3)
  ), 0.0);
  vec4 n = h * h * h * h * vec4(
    dot(d0, hash33(i)),
    dot(d1, hash33(i + i1)),
    dot(d2, hash33(i + i2)),
    dot(d3, hash33(i + 1.0))
  );
  return dot(vec4(31.316), n);
}

vec4 extractAlpha(vec3 colorIn) {
  float a = max(max(colorIn.r, colorIn.g), colorIn.b);
  return vec4(colorIn.rgb / (a + 1e-5), a);
}

const vec3 baseColor1 = vec3(0.611765, 0.262745, 0.996078);
const vec3 baseColor2 = vec3(0.298039, 0.760784, 0.913725);
const vec3 baseColor3 = vec3(0.062745, 0.078431, 0.600000);
const float innerRadius = 0.6;
const float noiseScale = 0.65;

float light1(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * attenuation);
}

float light2(float intensity, float attenuation, float dist) {
  return intensity / (1.0 + dist * dist * attenuation);
}

vec4 draw(vec2 uv) {
  vec3 color1 = adjustHue(baseColor1, hue);
  vec3 color2 = adjustHue(baseColor2, hue);
  vec3 color3 = adjustHue(baseColor3, hue);

  float ang = atan(uv.y, uv.x);
  float len = length(uv);
  float invLen = len > 0.0 ? 1.0 / len : 0.0;

  float n0 = snoise3(vec3(uv * noiseScale, iTime * 0.5)) * 0.5 + 0.5;
  float r0 = mix(mix(innerRadius, 1.0, 0.4), mix(innerRadius, 1.0, 0.6), n0);
  float d0 = distance(uv, (r0 * invLen) * uv);
  float v0 = light1(1.0, 10.0, d0);
  v0 *= smoothstep(r0 * 1.05, r0, len);
  float cl = cos(ang + iTime * 2.0) * 0.5 + 0.5;

  float a = iTime * -1.0;
  vec2 pos = vec2(cos(a), sin(a)) * r0;
  float d = distance(uv, pos);
  float v1 = light2(1.5, 5.0, d);
  v1 *= light1(1.0, 50.0, d0);

  float v2 = smoothstep(1.0, mix(innerRadius, 1.0, n0 * 0.5), len);
  float v3 = smoothstep(innerRadius, mix(innerRadius, 1.0, 0.5), len);

  vec3 col = mix(color1, color2, cl);
  col = mix(color3, col, v0);
  col = (col + v1) * v2 * v3;
  col = clamp(col, 0.0, 1.0);

  return extractAlpha(col);
}

vec4 mainImage(vec2 fragCoord) {
  vec2 center = iResolution.xy * 0.5;
  float size = min(iResolution.x, iResolution.y);
  vec2 uv = (fragCoord - center) / size * 2.0;

  float s = sin(rot);
  float c = cos(rot);
  uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);

  uv.x += hover * hoverIntensity * 0.1 * sin(uv.y * 10.0 + iTime);
  uv.y += hover * hoverIntensity * 0.1 * sin(uv.x * 10.0 + iTime);

  return draw(uv);
}

void main() {
  vec2 fragCoord = vUv * iResolution.xy;
  vec4 col = mainImage(fragCoord);
  gl_FragColor = vec4(col.rgb * col.a, col.a);
}
`;

export function VoicePoweredOrb({
  active = false,
  className,
  enableVoiceControl = false,
  hue = 0,
  maxHoverIntensity = 0.8,
  maxRotationSpeed = 1.2,
  onVoiceDetected,
  voiceLevel = 0,
  voiceSensitivity = 1.5,
}: VoicePoweredOrbProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const propsRef = useRef({
    active,
    enableVoiceControl,
    hue,
    maxHoverIntensity,
    maxRotationSpeed,
    onVoiceDetected,
    voiceLevel,
    voiceSensitivity,
  });

  propsRef.current = {
    active,
    enableVoiceControl,
    hue,
    maxHoverIntensity,
    maxRotationSpeed,
    onVoiceDetected,
    voiceLevel,
    voiceSensitivity,
  };

  useEffect(() => {
    if (!enableVoiceControl) {
      stopMicrophone();
      return undefined;
    }

    let cancelled = false;

    startMicrophone().then((started) => {
      if (cancelled && started) stopMicrophone();
    });

    return () => {
      cancelled = true;
      stopMicrophone();
    };
  }, [enableVoiceControl]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let renderer: Renderer | null = null;
    let gl: Renderer["gl"] | null = null;
    let rafId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let removeResizeListener: (() => void) | null = null;
    let detected = false;

    try {
      renderer = new Renderer({
        alpha: true,
        antialias: true,
        depth: false,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
        premultipliedAlpha: false,
      });
      gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }

      container.appendChild(gl.canvas);

      const geometry = new Triangle(gl);
      const program = new Program(gl, {
        depthTest: false,
        fragment: fragmentShader,
        transparent: true,
        uniforms: {
          hover: { value: 0 },
          hoverIntensity: { value: 0 },
          hue: { value: hue },
          iResolution: {
            value: new Vec3(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height),
          },
          iTime: { value: 0 },
          rot: { value: 0 },
        },
        vertex: vertexShader,
      });
      const mesh = new Mesh(gl, { geometry, program });

      const resize = () => {
        if (!renderer || !gl || !container.clientWidth || !container.clientHeight) return;

        renderer.setSize(container.clientWidth, container.clientHeight);
        program.uniforms.iResolution.value.set(
          gl.canvas.width,
          gl.canvas.height,
          gl.canvas.width / gl.canvas.height,
        );
      };

      if (typeof window.ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
      } else {
        window.addEventListener("resize", resize);
        removeResizeListener = () => window.removeEventListener("resize", resize);
      }

      resize();

      let currentRotation = 0;
      let lastTime = 0;
      let smoothedLevel = 0;

      const update = (timestamp: number) => {
        rafId = requestAnimationFrame(update);
        if (!renderer || !gl) return;

        const dt = lastTime ? (timestamp - lastTime) * 0.001 : 0;
        lastTime = timestamp;

        const currentProps = propsRef.current;
        const microphoneLevel = currentProps.enableVoiceControl ? analyzeAudio() : 0;
        const targetLevel = clamp01(
          Math.max(currentProps.voiceLevel, microphoneLevel, currentProps.active ? 0.08 : 0),
        );
        const smoothing = targetLevel > smoothedLevel ? 0.18 : 0.1;
        smoothedLevel += (targetLevel - smoothedLevel) * smoothing;

        const nextDetected = smoothedLevel > 0.08;
        if (nextDetected !== detected) {
          detected = nextDetected;
          currentProps.onVoiceDetected?.(detected);
        }

        const activeDrift = currentProps.active ? 0.18 : 0.05;
        currentRotation += dt * (activeDrift + smoothedLevel * currentProps.maxRotationSpeed * 2);

        program.uniforms.iTime.value = timestamp * 0.001;
        program.uniforms.hue.value = currentProps.hue;
        program.uniforms.hover.value = clamp01(smoothedLevel * 1.9 + (currentProps.active ? 0.08 : 0));
        program.uniforms.hoverIntensity.value = Math.min(
          currentProps.maxHoverIntensity,
          smoothedLevel * currentProps.maxHoverIntensity + (currentProps.active ? 0.08 : 0),
        );
        program.uniforms.rot.value = currentRotation;

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        renderer.render({ scene: mesh });
      };

      rafId = requestAnimationFrame(update);
    } catch (error) {
      console.warn("Voice orb failed to initialize:", error);
    }

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      removeResizeListener?.();
      stopMicrophone();

      if (gl?.canvas && container.contains(gl.canvas)) {
        container.removeChild(gl.canvas);
      }

      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  function analyzeAudio() {
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    if (!analyser || !dataArray) return 0;

    analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let index = 0; index < dataArray.length; index += 1) {
      const value = dataArray[index] / 255;
      sum += value * value;
    }

    const rms = Math.sqrt(sum / dataArray.length);
    return clamp01(rms * propsRef.current.voiceSensitivity * 3);
  }

  async function startMicrophone() {
    if (!navigator.mediaDevices?.getUserMedia) return false;

    try {
      stopMicrophone();

      const AudioContextConstructor =
        window.AudioContext ?? (window as BrowserWindowWithWebkitAudio).webkitAudioContext;
      if (!AudioContextConstructor) return false;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });
      const audioContext = new AudioContextConstructor();
      if (audioContext.state === "suspended") await audioContext.resume();

      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      analyser.fftSize = 512;
      analyser.maxDecibels = -10;
      analyser.minDecibels = -90;
      analyser.smoothingTimeConstant = 0.3;
      microphone.connect(analyser);

      mediaStreamRef.current = stream;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      microphoneRef.current = microphone;
      dataArrayRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

      return true;
    } catch {
      stopMicrophone();
      return false;
    }
  }

  function stopMicrophone() {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    microphoneRef.current?.disconnect();
    microphoneRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    dataArrayRef.current = null;

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }
    audioContextRef.current = null;
  }

  return <div ref={containerRef} className={cn("voice-powered-orb", className)} aria-hidden="true" />;
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}
