import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";

const still = (value: number | number[]) => ({ a: 0, k: value });
const keyframes = (frames: [number, number[]][]) => ({
  a: 1,
  k: frames.map(([t, s], i) => i === frames.length - 1 ? { t, s } : {
    t, s, i: { x: [0.5], y: [1] }, o: { x: [0.5], y: [0] },
  }),
});

function token(index: number, kind: "loading" | "ambient", x: number, y: number, color: number[]) {
  const duration = kind === "loading" ? 60 : 240;
  const offset = kind === "loading" ? 8 : index % 2 ? 19 : -19;
  const opacity = kind === "loading" ? 100 : 55;
  return {
    ddd: 0, ind: index + 1, ty: 4, sr: 1, ip: 0, op: duration, st: 0, bm: 0,
    ks: {
      o: keyframes([[0, [kind === "loading" ? 72 : 0]], [duration * .5, [opacity]], [duration, [kind === "loading" ? 72 : 0]]]),
      r: still(0), a: still([0, 0, 0]), s: still([100, 100, 100]),
      p: keyframes([[0, [x, y, 0]], [duration * (.32 + (index % 3) * .13), [x + offset, y - (kind === "loading" ? 10 : 46), 0]], [duration, [x, y, 0]]]),
    },
    shapes: [
      { ty: "el", p: still([0, 0]), s: still(kind === "loading" ? [15, 15] : [7, 12]), d: 1 },
      { ty: "fl", c: still(color), o: still(100), r: 1 },
    ],
  };
}

function composition(kind: "loading" | "ambient") {
  const loading = kind === "loading";
  return {
    v: "5.12.2", fr: 30, ip: 0, op: loading ? 60 : 240,
    w: loading ? 84 : 800, h: loading ? 42 : 480,
    assets: [],
    layers: loading
      ? [token(0, kind, 17, 25, [.64, .48, .82, 1]), token(1, kind, 40, 25, [.93, .53, .71, 1]), token(2, kind, 63, 25, [.42, .71, .55, 1])]
      : [[48, 148], [104, 294], [714, 188], [751, 350], [197, 74], [637, 83]].map(([x, y], i) =>
        token(i, kind, x, y, i % 2 ? [1, .95, .72, 1] : [1, .75, .88, 1])),
  };
}

export function GameLottie({ kind }: { kind: "loading" | "ambient" }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let stopped = false;
    let animation: AnimationItem | undefined;
    void import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (stopped || !container.current) return;
      animation = lottie.loadAnimation({ container: container.current, renderer: "svg", loop: true, autoplay: !document.hidden,
        animationData: composition(kind), rendererSettings: { preserveAspectRatio: kind === "ambient" ? "none" : "xMidYMid meet" } });
    }).catch(() => {});
    const visibility = () => { if (document.hidden) animation?.pause(); else animation?.play(); };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopped = true;
      animation?.destroy();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [kind]);
  return <div ref={container} className={`lottie-${kind}`} aria-hidden="true" />;
}
