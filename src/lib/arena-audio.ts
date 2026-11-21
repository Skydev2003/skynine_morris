import { useEffect, useRef, useState } from "react";

type Cue = "place" | "capture" | "win" | "loss" | "start";

const melody = [
  [72, 76, 79, 76, 74, 72, 67, 69], [69, 72, 76, 79, 76, 72, 74, 76],
  [77, 81, 84, 81, 79, 77, 72, 74], [74, 77, 79, 83, 81, 79, 74, 71],
  [72, 76, 79, 84, 83, 79, 76, 74], [69, 72, 76, 81, 79, 76, 72, 69],
  [77, 81, 84, 81, 77, 79, 81, 76], [74, 77, 79, 83, 79, 77, 74, 71],
];
const bass = [48, 45, 41, 43, 48, 45, 41, 43];
const cues: Record<Cue, number[]> = {
  place: [57, 72], capture: [53, 67, 79, 86], win: [72, 76, 79, 84, 88], loss: [76, 72, 67], start: [67, 72, 79],
};

class ArenaAudio {
  context: AudioContext;
  output: GainNode;
  step = 0;
  next = 0;
  constructor() {
    this.context = new AudioContext();
    this.output = this.context.createGain();
    this.output.gain.value = .7;
    this.output.connect(this.context.destination);
  }

  note(midi: number, time: number, length: number, volume: number, type: OscillatorType = "sine") {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + .014);
    gain.gain.exponentialRampToValueAtTime(.0001, time + length);
    osc.connect(gain);
    gain.connect(this.output);
    osc.start(time);
    osc.stop(time + length + .01);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  tick() {
    if (this.context.state !== "running" || document.hidden) return;
    const now = this.context.currentTime;
    if (this.next < now) this.next = now + .03;
    while (this.next < now + .17) {
      const bar = Math.floor(this.step / 8) % melody.length;
      const note = this.step % 8;
      this.note(melody[bar][note], this.next, .35, note % 2 ? .016 : .026, "triangle");
      if (note === 0 || note === 4) this.note(bass[bar] + (note === 4 ? 7 : 0), this.next, .8, .048);
      if (note === 0) this.note(bass[bar] + 24, this.next, 1.1, .017);
      this.step++;
      this.next += .29;
    }
  }

  cue(cue: Cue) {
    if (this.context.state !== "running" || document.hidden) return;
    const now = this.context.currentTime + .01;
    for (const [i, midi] of cues[cue].entries()) {
      this.note(midi, now + i * (cue === "win" ? .105 : .046), cue === "place" ? .13 : .4,
        cue === "place" ? .095 : .145, i === 0 ? "triangle" : "sine");
    }
  }
}

export function useArenaAudio(inGame: boolean) {
  const audio = useRef<ArenaAudio | null>(null);
  const [muted, setMuted] = useState(false);
  const mute = useRef(false);

  useEffect(() => {
    function unlock() {
      if (mute.current || !window.AudioContext) return;
      try {
        audio.current ??= new ArenaAudio();
        if (audio.current.context.state === "suspended") void audio.current.context.resume().catch(() => {});
      } catch {}
    }
    const frame = requestAnimationFrame(() => {
      mute.current = localStorage.getItem("morris-muted") === "1";
      setMuted(mute.current);
    });
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    const visibility = () => { if (document.hidden) void audio.current?.context.suspend().catch(() => {}); else unlock(); };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", visibility);
      void audio.current?.context.close().catch(() => {});
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    if (!inGame || muted) return;
    const interval = window.setInterval(() => audio.current?.tick(), 110);
    return () => window.clearInterval(interval);
  }, [inGame, muted]);

  return {
    muted,
    toggle: () => {
      mute.current = !mute.current;
      setMuted(mute.current);
      localStorage.setItem("morris-muted", mute.current ? "1" : "0");
      if (mute.current) void audio.current?.context.suspend().catch(() => {});
      else if (window.AudioContext) {
        try {
          audio.current ??= new ArenaAudio();
          audio.current.next = 0;
          void audio.current.context.resume().catch(() => {});
        } catch {}
      }
    },
    cue: (name: Cue) => { if (!mute.current) audio.current?.cue(name); },
  };
}
