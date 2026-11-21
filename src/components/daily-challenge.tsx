import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import type { DailyPuzzle } from "@/lib/daily-puzzle";
import { placing, targets, type Action, type Game } from "@/lib/morris";
import { CoinIcon } from "./coin";
import { Dialog } from "./dialog";
import { Board } from "./morris-board";

type Snapshot = { puzzle: DailyPuzzle; completed: boolean; reward: number };
type SolveResult = { correct: false } | { correct: true; game: Game; earned: number };
const palette = { mint: "mint", rose: "rose" } as const;

async function dailyRequest<T>(token: string, body: object, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(8000);
  const response = await fetch("/api/daily", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

export function DailyChallenge({ token, close, rewarded }: { token: string; close: () => void; rewarded: (coins: number) => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [attempt, setAttempt] = useState<SolveResult>();
  const [load, setLoad] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    void dailyRequest<Snapshot>(token, { op: "state" }, controller.signal).then((data) => {
      if (!controller.signal.aborted) setSnapshot(data);
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "เปิดด่านไม่สำเร็จ");
    });
    return () => controller.abort();
  }, [token, load]);

  const game = attempt?.correct ? attempt.game : snapshot?.puzzle.game;
  const completed = Boolean(snapshot?.completed || attempt?.correct);

  async function point(at: number) {
    if (!snapshot || !game || completed || pending || error) return;
    let action: Action;
    if (placing(game)) {
      action = { type: "place", at };
    } else {
      if (game.board[at] === "mint") {
        setSelected(selected === at ? null : at);
        return;
      }
      if (selected === null || !targets(game, selected).includes(at)) return;
      action = { type: "move", from: selected, at };
    }
    setSelected(null);
    setPending(true);
    try {
      const result = await dailyRequest<SolveResult>(token, { op: "solve", day: snapshot.puzzle.day, action });
      setAttempt(result);
      if (result.correct) rewarded(result.earned);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "ตรวจคำตอบไม่สำเร็จ");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title="ด่านประจำวัน" className="feature-dialog daily-challenge" close={close}>
      {error ? (
        <p className="feature-error" role="alert">{error} <button type="button" className="outline" onClick={() => {
          setError(""); setSnapshot(undefined); setAttempt(undefined); setShowHint(false); setLoad(load + 1);
        }}>โหลดด่านใหม่</button></p>
      ) : !snapshot && <p className="feature-empty" role="status">กำลังเปิดด่าน…</p>}
      {snapshot && game && (
        <>
          <div className="daily-goal">
            <p>{snapshot.puzzle.goal === "block" ? "วางหมาก 1 ตัวเพื่อสกัดคู่แข่งไม่ให้เรียงสาม" :
              placing(game) ? "วางหมาก 1 ตัวให้เรียงสาม" : "เลื่อนหมาก 1 ตัวให้เรียงสาม"}</p>
            <span className="daily-prize"><CoinIcon /> {snapshot.reward} เหรียญ</span>
          </div>
          <div className="daily-board">
            <Board game={game} active={!completed && !pending && !error} palette={palette}
              selected={selected} onPoint={(at) => void point(at)} impact={null}
              hintPoints={showHint && !completed ? snapshot.puzzle.clue : undefined} />
          </div>
          {completed ? (
            <p className="feature-status daily-complete" role="status">
              {attempt?.correct && attempt.earned ? <>ผ่านด่าน! <CoinIcon /> รับ {attempt.earned} เหรียญ</> : "ผ่านด่านวันนี้แล้ว · รับรางวัลไปแล้ว"}
            </p>
          ) : (
            <>
              <button className="outline daily-hint-button" type="button" aria-pressed={showHint} onClick={() => setShowHint(!showHint)}>
                <Lightbulb aria-hidden="true" /> {showHint ? "ซ่อนคำใบ้" : "ดูคำใบ้"}
              </button>
              {showHint && <p className="daily-hint" role="status">{snapshot.puzzle.goal === "block"
                ? "ดูหมากคู่แข่งที่สว่างขึ้น แล้วปิดจุดว่างในแนวเดียวกัน"
                : "ดูหมากของคุณที่สว่างขึ้น แล้วเติมจุดว่างให้ครบสามตัว"}</p>}
              {pending ? <p className="feature-status" role="status">กำลังตรวจคำตอบ…</p>
                : attempt?.correct === false && <p className="feature-status" role="status">ยังไม่ผ่าน ลองเลือกจุดอื่นได้เลย</p>}
            </>
          )}
        </>
      )}
    </Dialog>
  );
}
