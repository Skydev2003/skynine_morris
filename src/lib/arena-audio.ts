import { useCallback, useEffect, useRef, useState } from "react";

type Cue = "place" | "capture" | "capture-hit" | "win" | "loss" | "start" | "search" | "matched";
type MusicScene = "club" | "arena";

const melody = [
  [72, 76, 79, 76, 74, 72, 67, 69], [69, 72, 76, 79, 76, 72, 74, 76],
  [77, 81, 84, 81, 79, 77, 72, 74], [74, 77, 79, 83, 81, 79, 74, 71],
  [72, 76, 79, 84, 83, 79, 76, 74], [69, 72, 76, 81, 79, 76, 72, 69],
  [77, 81, 84, 81, 77, 79, 81, 76], [74, 77, 79, 83, 79, 77, 74, 71],
];
const bass = [48, 45, 41, 43, 48, 45, 41, 43];
const clubMelody = [
  [76, 79, 81, 79, 74, 0, 72, 74], [76, 0, 79, 76, 72, 0, 69, 0],
  [74, 77, 81, 77, 76, 0, 72, 74], [71, 74, 79, 81, 79, 0, 74, 0],
  [84, 0, 83, 79, 81, 79, 76, 0], [81, 0, 79, 76, 74, 76, 72, 0],
  [77, 81, 84, 81, 79, 77, 76, 74], [71, 74, 79, 74, 72, 0, 0, 0],
];
const clubChords = [
  [48, 55, 64, 71], [45, 52, 60, 67], [41, 48, 57, 64], [43, 50, 59, 65],
];
const cues: Record<Cue, number[]> = {
  place: [57, 72], capture: [53, 67, 79, 86], "capture-hit": [62, 53, 45], win: [72, 76, 79, 84, 88], loss: [76, 72, 67], start: [67, 72, 79],
  search: [72, 79, 76], matched: [76, 81, 84, 88],
};

class ArenaAudio {
  context: AudioContext;
  output: GainNode;
  music: Record<MusicScene, GainNode>;
  scene: MusicScene | null = null;
  step = 0;
  next = 0;
  constructor() {
    this.context = new AudioContext();
    this.output = this.context.createGain();
    this.output.gain.value = .7;
    this.output.connect(this.context.destination);
    this.music = { club: this.context.createGain(), arena: this.context.createGain() };
    for (const channel of Object.values(this.music)) {
      channel.gain.value = 0;
      channel.connect(this.output);
    }
  }

  note(midi: number, time: number, length: number, volume: number, type: OscillatorType = "sine", output = this.output) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + .014);
    gain.gain.exponentialRampToValueAtTime(.0001, time + length);
    osc.connect(gain);
    gain.connect(output);
    osc.start(time);
    osc.stop(time + length + .01);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  }

  select(scene: MusicScene | null) {
    if (this.scene === scene) return;
    const now = this.context.currentTime;
    if (this.scene) this.music[this.scene].gain.setTargetAtTime(0, now, .055);
    if (scene) this.music[scene].gain.setTargetAtTime(1, now, .055);
    this.scene = scene;
    this.step = 0;
    this.next = now + .03;
  }

  tick() {
    if (!this.scene || this.context.state !== "running" || document.hidden) return;
    const now = this.context.currentTime;
    if (this.next < now) this.next = now + .03;
    const isClub = this.scene === "club";
    const output = this.music[this.scene];
    while (this.next < now + .17) {
      const bar = Math.floor(this.step / 8) % melody.length;
      const note = this.step % 8;
      if (isClub) {
        const pitch = clubMelody[bar][note];
        const [root, fifth, third, seventh] = clubChords[bar % clubChords.length];
        if (pitch) this.note(pitch, this.next, .6, note % 2 ? .042 : .068, "triangle", output);
        if (note === 0 || note === 4) this.note(note === 0 ? root : fifth, this.next, 1.02, .075, "sine", output);
        if (note === 2 || note === 6) {
          this.note(third, this.next, .9, .042, "sine", output);
          this.note(seventh, this.next + .025, .85, .03, "sine", output);
        }
      } else {
        this.note(melody[bar][note], this.next, .35, note % 2 ? .016 : .026, "triangle", output);
        if (note === 0 || note === 4) this.note(bass[bar] + (note === 4 ? 7 : 0), this.next, .8, .048, "sine", output);
        if (note === 0) this.note(bass[bar] + 24, this.next, 1.1, .017, "sine", output);
      }
      this.step++;
      this.next += isClub ? (note % 2 === 0 ? .34 : .26) : .29;
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

export function useArenaAudio(scene: MusicScene | null) {
  const audio = useRef<ArenaAudio | null>(null);
  const [muted, setMuted] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const preference = useRef<boolean | null>(null);

  const readMute = useCallback(() => {
    preference.current ??= localStorage.getItem("morris-muted") === "1";
    return preference.current;
  }, []);

  const unlock = useCallback(() => {
    if (readMute() || document.hidden || !window.AudioContext) return;
    try {
      if (!audio.current) {
        audio.current = new ArenaAudio();
        const context = audio.current.context;
        context.onstatechange = () => setRunning(context.state === "running");
      }
      const context = audio.current.context;
      setRunning(context.state === "running");
      if (context.state !== "running") void context.resume().catch(() => {});
    } catch {}
  }, [readMute]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMuted(readMute()));
    function onGesture(event: Event) {
      if (!event.isTrusted || (event.target instanceof Element && event.target.closest("[data-sound-control]"))) return;
      unlock();
    }
    document.addEventListener("click", onGesture, true);
    document.addEventListener("keydown", onGesture, true);
    const visibility = () => {
      if (document.hidden) void audio.current?.context.suspend().catch(() => {});
      else if (audio.current) unlock();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("click", onGesture, true);
      document.removeEventListener("keydown", onGesture, true);
      document.removeEventListener("visibilitychange", visibility);
      if (audio.current) {
        audio.current.context.onstatechange = null;
        void audio.current.context.close().catch(() => {});
      }
      audio.current = null;
    };
  }, [readMute, unlock]);

  useEffect(() => {
    const engine = audio.current;
    engine?.select(scene);
    if (!scene || muted || !running || !engine) return;
    engine.tick();
    const interval = window.setInterval(() => engine.tick(), 110);
    return () => window.clearInterval(interval);
  }, [scene, muted, running]);

  const enabled = running && muted === false;
  return {
    enabled,
    playing: enabled && scene !== null,
    toggle: () => {
      const nextMute = !readMute() && audio.current?.context.state === "running";
      preference.current = nextMute;
      setMuted(nextMute);
      localStorage.setItem("morris-muted", nextMute ? "1" : "0");
      if (nextMute) void audio.current?.context.suspend().catch(() => {});
      else unlock();
    },
    cue: (name: Cue) => { if (!readMute()) audio.current?.cue(name); },
  };
}
