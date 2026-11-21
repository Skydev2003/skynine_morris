"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AuthScreen } from "./auth-screen";
import { MatchStage } from "./match-stage";
import { RoomLobby } from "./room-lobby";
import { ArrowLeft, ArrowRight, BookOpen, LogOut, Swords, Trophy, X } from "lucide-react";
import { captures, placing, targets, type Action } from "@/lib/morris";
import { browserDb, onlineConfigured } from "@/lib/browser-db";
import { roomCode, type Match, type Room } from "@/lib/rooms";
import { useMorris } from "@/lib/store";

type Modal = "rules" | "history";

function Dialog({ children, title, close }: { children: ReactNode; title: string; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog ref={dialog} onClose={close} aria-label={title} onClick={(event) => {
      if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
      }
    }}>
      <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" onClick={close} aria-label="ปิด"><X /></button></div>
      {children}
    </dialog>
  );
}

export default function MorrisClub() {
  const state = useMorris();
  const { session, room, selected, joinCode, setJoinCode, wins, matches } = state;
  const userId = session?.user.id;
  const code = room?.code;
  const side = room && (room.host_id === userId ? "mint" : "rose");
  const [modal, setModal] = useState<Modal | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState<{ emoji: string; sender: string } | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    const db = browserDb();
    const invite = new URLSearchParams(window.location.search).get("room")?.toUpperCase();
    if (invite && roomCode.test(invite)) useMorris.getState().setJoinCode(invite);
    if (!db) return;
    const { data } = db.auth.onAuthStateChange((_event, current) => useMorris.getState().setSession(current));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const db = browserDb();
    if (!db || !userId) return;
    const remembered = localStorage.getItem(`morris-room-${userId}`);
    const invite = new URLSearchParams(window.location.search).get("room")?.toUpperCase();
    if (!remembered || (invite && invite !== remembered)) return;
    let cancelled = false;
    db.from("morris_rooms").select().eq("code", remembered).maybeSingle<Room>().then(({ data }) => {
      const current = useMorris.getState();
      if (!cancelled && data && !current.room && current.session?.user.id === userId) current.openRoom(data);
    });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    const db = browserDb();
    if (!db || !code || !userId) return;
    const refresh = async () => {
      if (document.hidden) return;
      const { data } = await db.from("morris_rooms").select().eq("code", code).maybeSingle<Room>();
      if (data) useMorris.getState().syncRoom(data);
    };
    const channel = db.channel(`morris:${code}`).on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "morris_rooms", filter: `code=eq.${code}`,
    }, ({ new: updated }) => useMorris.getState().syncRoom(updated as Room))
      .subscribe((status) => { if (status === "SUBSCRIBED") void refresh(); });
    const timer = window.setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      void db.removeChannel(channel);
    };
  }, [code, userId]);

  const finished = room?.finished_at;
  useEffect(() => {
    const db = browserDb();
    if (!db || !userId) return;
    let cancelled = false;
    Promise.all([
      db.from("morris_rooms").select("code", { count: "exact", head: true }).eq("winner_id", userId),
      db.from("morris_rooms").select("code, winner_id, finished_at")
        .or(`host_id.eq.${userId},guest_id.eq.${userId}`).not("finished_at", "is", null)
        .order("finished_at", { ascending: false }).limit(12).returns<Match[]>(),
    ]).then(([total, recent]) => {
      if (!cancelled && !total.error && !recent.error) useMorris.getState().setHistory(total.count ?? 0, recent.data);
    });
    return () => { cancelled = true; };
  }, [userId, finished]);

  const roomReaction = room?.reaction;
  const reactionTime = room?.reacted_at;
  useEffect(() => {
    const remaining = reactionTime ? 3400 - (Date.now() - Date.parse(reactionTime)) : 0;
    if (!roomReaction || remaining <= 0) return;
    const show = window.setTimeout(() => setReaction(roomReaction), 0);
    const hide = window.setTimeout(() => setReaction(null), remaining);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [roomReaction, reactionTime]);

  async function send(input: Record<string, unknown>, open = false) {
    if (!session) return;
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "เชื่อมต่อไม่สำเร็จ");
      const current = useMorris.getState();
      if (current.session?.user.id !== session.user.id) return;
      if (open) {
        current.openRoom(data as Room);
        localStorage.setItem(`morris-room-${session.user.id}`, data.code);
        window.history.replaceState(null, "", "/");
        setReaction(null);
        setCopied(false);
      } else {
        current.syncRoom(data as Room);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function point(at: number) {
    if (!room || !active) return;
    const game = room.game;
    let action: Action | undefined;
    if (game.capture && captures(game).includes(at)) action = { type: "capture", at };
    else if (placing(game) && !game.board[at]) action = { type: "place", at };
    else if (!placing(game)) {
      if (game.board[at] === game.turn) { state.select(selected === at ? null : at); return; }
      if (selected !== null && targets(game, selected).includes(at)) action = { type: "move", from: selected, at };
    }
    if (!action) return;
    void send({ op: "play", code, version: room.game_revision, action });
  }

  function leaveRoom() {
    if (userId) localStorage.removeItem(`morris-room-${userId}`);
    state.exit();
    setError("");
    setReaction(null);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(code ?? "");
      setCopied(true);
    } catch {
      setError("คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกและคัดลอกรหัสห้อง");
    }
  }

  async function signOut() {
    const db = browserDb();
    if (!db) return;
    const { error } = await db.auth.signOut();
    if (error) { setError("ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง"); return; }
    leaveRoom();
  }

  const active = Boolean(room?.started_at && !pending && !room.game.winner && side === room.game.turn);

  if (!session) return <AuthScreen configured={onlineConfigured} />;

  return (
    <>
      <main className={`game-world ${room ? "stadium-world" : "menu-world"}`} key={room ? room.code : "menu"}>
        <div className="world-corner corner-left">
          {room && <button className="hud-button" onClick={leaveRoom} disabled={pending} aria-label="กลับหน้าเลือกห้อง" title="กลับหน้าเลือกห้อง"><ArrowLeft /><span className="hud-label">กลับ</span></button>}
        </div>
        <div className="world-corner corner-right">
          <button className="wins" onClick={() => setModal("history")} aria-label={`ประวัติการแข่งขัน ชนะ ${wins} ครั้ง`}><Trophy /><strong>{wins}</strong><span>ชนะ</span></button>
          <button className="hud-button" onClick={() => setModal("rules")} aria-label="วิธีเล่น" title="วิธีเล่น"><BookOpen /></button>
          {!room && <button className="hud-button" onClick={signOut} disabled={pending} aria-label="ออกจากระบบ" title="ออกจากระบบ"><LogOut /></button>}
        </div>
        {room && side ? room.started_at ? (
          <MatchStage room={room} side={side} selected={selected} pending={pending} reaction={reaction} error={error} point={point}
            react={(emoji) => void send({ op: "react", code, emoji })} />
        ) : (
          <>
            <RoomLobby room={room} seat={side === "mint" ? "host" : "guest"} pending={pending} copied={copied} copy={copy}
              send={(command) => void send({ ...command, code, revision: room.revision })} />
            {error && <p className="stage-error" role="alert">{error}</p>}
          </>
        ) : (
          <section className="entry-menu" aria-labelledby="entry-title">
            <h1 id="entry-title">Morris<br /> Club</h1>
            <p>ศึกวางหมากสองผู้เล่น</p>
            <button className="primary wide create" disabled={pending} onClick={() => send({ op: "create" }, true)}><Swords /> สร้างห้องใหม่ <ArrowRight /></button>
            <form className="join" onSubmit={(event) => { event.preventDefault(); void send({ op: "join", code: joinCode }, true); }}>
              <input aria-label="รหัสห้อง 6 ตัว" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="รหัสห้อง 6 ตัว" value={joinCode}
                required pattern="[A-Z0-9]{6}" maxLength={6} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
              <button className="outline" type="submit" disabled={pending || !roomCode.test(joinCode)}>เข้าห้อง <ArrowRight /></button>
            </form>
            {error && <p className="feedback" role="alert">{error}</p>}
          </section>
        )}
      </main>

      {modal === "rules" && <Dialog title="วิธีเล่น Morris" close={() => setModal(null)}>
        <ol className="rules">
          <li><strong>วางหมาก</strong><p>ผลัดกันวางหมากคนละ 1 ตัวลงในจุดว่าง แต่ละฝ่ายมีหมาก 9 ตัว</p></li>
          <li><strong>สร้างมิลล์และจับหมาก</strong><p>เรียงหมากสีเดียวกัน 3 ตัวตามเส้นแนวนอนหรือแนวตั้ง แล้วนำหมากคู่แข่งออก 1 ตัว หมากในมิลล์จะถูกป้องกัน เว้นแต่หมากของคู่แข่งทุกตัวอยู่ในมิลล์</p></li>
          <li><strong>เลื่อนหรือบิน</strong><p>เมื่อวางหมากครบ ให้เลื่อนหมากไปยังจุดว่างที่ติดกันตามเส้น เมื่อเหลือ 3 ตัว สามารถบินไปยังจุดว่างใดก็ได้</p></li>
          <li><strong>ชนะเกม</strong><p>หลังวางครบทั้งสองฝ่าย คุณชนะเมื่อคู่แข่งเหลือน้อยกว่า 3 ตัว หรือไม่มีตาเดินที่ถูกกติกา</p></li>
        </ol>
      </Dialog>}

      {modal === "history" && <Dialog title="ประวัติการแข่งขัน" close={() => setModal(null)}>
        <div className="history-total"><Trophy /> <strong>{wins}</strong> ชนะทั้งหมด</div>
          {matches.length ? <ul className="match-list">{matches.map((match) => <li key={match.code}>
            <div><strong>{match.code}</strong><small>{match.finished_at && new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.finished_at))}</small></div>
            <span className={match.winner_id === userId ? "won" : "lost"}>{match.winner_id === userId ? "ชนะ" : "แพ้"}</span>
          </li>)}</ul> : <p>ผลการแข่งขันออนไลน์จะแสดงที่นี่เมื่อคุณเล่นจบเกม</p>}
      </Dialog>}
    </>
  );
}
