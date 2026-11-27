import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ShieldAlert, Swords, Trophy } from "lucide-react";
import { capturedCount, count, lastCapture, other, placing, type Side } from "@/lib/morris";
import { emojis, type Room } from "@/lib/rooms";
import { PieceTray } from "./piece-tray";
import { TurnClock } from "./turn-clock";
import type { MatchProfile } from "@/lib/shop";
import { Board, Player } from "./morris-board";

export function MatchStage({ room, confirmed, cue, side, accessToken, ownProfile, selected, pending, reaction, error, point, react, expired }: {
  room: Room;
  confirmed: Room;
  cue: (name: "place" | "capture" | "capture-hit" | "win" | "loss" | "start") => void;
  side: Side;
  accessToken?: string;
  ownProfile: MatchProfile;
  selected: number | null;
  pending: boolean;
  reaction: Room["reaction"];
  error: string;
  point: (at: number) => void;
  expired: () => void;
  react: (emoji: string) => void;
}) {
  const game = room.game;
  const myTurn = game.turn === side;
  const phase = placing(game) ? "วางหมาก" : count(game, game.turn) === 3 ? "บิน" : "เลื่อนหมาก";
  const title = game.winner ? game.winner === side ? "คุณชนะ!" : "คู่แข่งชนะ!" : myTurn ? "ตาของคุณ" : "ตาของคู่แข่ง";
  const hint = game.winner ? room.finish_reason === "timeout" ? "จบเกมเพราะหมดเวลา" : "จบการแข่งขัน" : !myTurn ? game.capture ? "คู่แข่งกำลังเลือกจับหมาก" : "รอคู่แข่งเดินหมาก"
    : game.capture ? "สร้างมิลล์แล้ว เลือกหมากคู่แข่ง 1 ตัว" : phase === "วางหมาก" ? "ลากหมากจากด้านล่าง หรือแตะจุดว่าง"
    : phase === "บิน" ? "เลือกหมากแล้วบินไปจุดว่าง" : "เลือกหมากแล้วเลื่อนไปจุดว่างที่ติดกัน";

  const palette = { mint: room.host_color, rose: room.guest_color };
  const character = { mint: room.host_character, rose: room.guest_character };
  const rival = other(side);
  const names = { mint: room.host_name, rose: room.guest_name };
  const canPlay = myTurn && !pending && !game.winner;
  const { code, host_id: hostId, guest_id: guestId, local_match: localMatch } = confirmed;
  const profileKey = `${code}:${hostId}:${guestId}`;
  const [profileSnapshot, setProfileSnapshot] = useState<{ key: string; profiles: Partial<Record<Side, MatchProfile>> }>();
  const rivalProfile = profileSnapshot?.key === profileKey ? profileSnapshot.profiles[rival] : undefined;

  useEffect(() => {
    if (localMatch || !guestId || !accessToken) return;
    const controller = new AbortController();
    async function loadProfiles() {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ op: "profiles", code }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
      });
      if (!response.ok) return;
      const profiles = await response.json() as Partial<Record<Side, MatchProfile>>;
      if (!controller.signal.aborted) setProfileSnapshot({ key: profileKey, profiles });
    }
    void loadProfiles().catch(() => {});
    return () => controller.abort();
  }, [accessToken, code, guestId, localMatch, profileKey]);

  const latest = lastCapture(confirmed.game);
  const at = latest?.at;
  const by = latest?.by;
  const revision = confirmed.game_revision;
  const seenRevision = useRef(revision);
  const shownRevision = useRef(room.game_revision);
  const playCue = useEffectEvent(cue);
  const soundMove = game.last !== null && game.board[game.last] !== null;

  useEffect(() => { playCue("start"); }, []);

  useEffect(() => {
    if (room.game_revision <= shownRevision.current) return;
    shownRevision.current = room.game_revision;
    if (soundMove) playCue("place");
  }, [room.game_revision, soundMove]);
  const [captureNotice, setCaptureNotice] = useState<{ at: number; by: Side; revision: number } | null>(null);

  useEffect(() => {
    if (revision <= seenRevision.current) return;
    seenRevision.current = revision;
    if (confirmed.game.winner) playCue(confirmed.game.winner === side ? "win" : "loss");
    else if (at !== undefined && by) playCue(by === side ? "capture" : "capture-hit");
    if (at !== undefined && by) {
      const frame = window.requestAnimationFrame(() => setCaptureNotice({ at, by, revision }));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [at, by, revision, confirmed.game.winner, side]);

  useEffect(() => {
    if (!captureNotice) return;
    const timeout = window.setTimeout(() => setCaptureNotice(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [captureNotice]);

  const ownCapture = captureNotice?.by === side;

  return (
    <section className="table-stage" aria-label="สนามเล่น">
      <div className="turn-zone">
        {!game.winner && <TurnClock deadline={room.turn_deadline} expired={expired} paused={pending} />}
        <div role="status" aria-live="polite" aria-atomic="true">
        <div key={title + game.capture} className={`turn-sign color-${palette[game.turn]} ${myTurn ? "my-turn" : ""}`}>
          {game.winner ? <Trophy /> : <i className="color-chip" />}
          <div><h1>{title}</h1><p>{hint}</p></div>
          {!game.winner && <span className="phase">{phase}</span>}
        </div>
        </div>
      </div>
      <Player side={side} game={game} current={myTurn && !game.winner} you name={names[side]} taken={capturedCount(confirmed.game, side)}
        character={character[side]} profile={ownProfile} color={palette[side]} capturePulse={captureNotice?.by === side} />
      <div className="table-center">
        <Board game={game} active={canPlay} selected={selected} onPoint={point} palette={palette}
          impact={captureNotice && { at: captureNotice.at, color: palette[other(captureNotice.by)], revision: captureNotice.revision, own: ownCapture }} />
        <div className="capture-announcement" role="alert" aria-atomic="true">
          {captureNotice && <div className={`capture-banner ${ownCapture ? "capture-success" : "capture-loss"}`} key={captureNotice.revision}>
            <span className="capture-emblem" aria-hidden="true">{ownCapture ? <Swords /> : <ShieldAlert />}</span>
            <span>{ownCapture ? "กินหมากสำเร็จ" : "เสียหมาก"}</span>
            <strong>{ownCapture ? "+1" : "−1"}</strong>
          </div>}
        </div>
        {reaction && <div key={room.reacted_at} className={`reaction-pop ${reaction.sender === (side === "mint" ? room.host_id : room.guest_id) ? "mine" : ""}`} role="status">
          {reaction.emoji}<small>{reaction.sender === (side === "mint" ? room.host_id : room.guest_id) ? "คุณ" : "คู่แข่ง"}</small>
        </div>}
      </div>
      <Player side={rival} game={game} current={!myTurn && !game.winner} you={false} name={names[rival]} taken={capturedCount(confirmed.game, rival)}
        character={character[rival]} profile={rivalProfile} color={palette[rival]} capturePulse={captureNotice?.by === rival} />
      <div className="table-controls">
        <PieceTray key={`${game.turn}-${game.reserve[side]}`} count={game.reserve[side]} color={palette[side]}
          enabled={canPlay && placing(game) && !game.capture && game.reserve[side] > 0} place={point} />
        <div className="emojis" role="group" aria-label="ส่งอิโมจิ">{emojis.map((emoji, i) =>
          <button key={emoji} title={["ทักทาย", "ไฟลุก", "ประหลาดใจ", "ปรบมือ", "เท่มาก", "เกมดี"][i]} disabled={pending} onClick={() => react(emoji)}>{emoji}</button>)}</div>
        {error && <p className="table-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
