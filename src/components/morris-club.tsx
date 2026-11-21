"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { AuthScreen } from "./auth-screen";
import { Logo } from "./logo";
import { ArrowLeft, ArrowRight, BookOpen, Copy, DoorOpen, History, LogIn, LogOut, Plus, Smile, Trophy, X } from "lucide-react";
import { captures, count, placing, targets, type Action } from "@/lib/morris";
import { browserDb, onlineConfigured } from "@/lib/browser-db";
import { emojis, roomCode, type Match, type Room } from "@/lib/rooms";
import { useMorris } from "@/lib/store";
import { Board, Player, sideName } from "./morris-board";

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

  const game = room?.game;
  const waiting = Boolean(room && !room.guest_id);
  const active = Boolean(game && !pending && !game.winner && room?.guest_id && side === game.turn);
  const phase = !game || placing(game) ? "วางหมาก" : count(game, game.turn) === 3 ? "บิน" : "เลื่อนหมาก";
  const boardTitle = !game ? "" : waiting ? "รอเพื่อนเข้าห้อง" : game.winner ? `ทีม${sideName[game.winner]}ชนะ!`
    : game.turn === side ? "ตาของคุณ" : "ตาของคู่แข่ง";
  const boardHint = !game ? "" : waiting ? "ส่งรหัสห้องให้เพื่อนเพื่อเริ่มเกม"
    : game.winner ? "จบการแข่งขัน" : game.capture ? "สร้างมิลล์แล้ว เลือกหมากคู่แข่ง 1 ตัว"
    : phase === "วางหมาก" ? "เลือกจุดว่างเพื่อวางหมาก" : phase === "บิน" ? "เลือกหมากแล้วบินไปยังจุดว่างใดก็ได้" : "เลือกหมากแล้วเลื่อนไปยังจุดว่างที่ติดกัน";

  if (!session) return <AuthScreen configured={onlineConfigured} />;

  return (
    <>
      <header className="site-header">
        <div className="shell header-inner">
          <Link className="brand" href="/" aria-label="Morris Club หน้าหลัก"><Logo /><span>MORRIS<span className="brand-accent"> CLUB</span></span></Link>
          <div className="account">
            <button className="wins" onClick={() => setModal("history")} aria-label={`ประวัติการแข่งขัน ชนะ ${wins} ครั้ง`}><Trophy /><strong>{wins}</strong><span>ชนะ</span></button>
            <button className="outline login" onClick={signOut} disabled={pending} aria-label="ออกจากระบบ"><LogOut /><span>ออกจากระบบ</span></button>
          </div>
        </div>
      </header>

      <main className="shell screen" key={room ? room.code : "lobby"}>
        {!room || !game ? (
          <div className="lobby">
            <div className="lobby-hero">
              <div className="lobby-copy">
                <span className="eyebrow"><i /> MORRIS CLUB</span>
                <h1>เจอกัน<br />ที่สนาม!</h1>
                <p>ชวนเพื่อนมาดวล Nine Men’s Morris</p>
              </div>
              <div className="lobby-art" aria-hidden="true" />
            </div>
            <div className="lobby-options">
              <section className="panel room-panel">
                <span className="panel-icon mint-icon"><DoorOpen /></span>
                <h2>สร้างห้อง</h2><p>เป็นโฮสต์แล้วส่งรหัสห้องให้เพื่อน</p>
                <button className="primary wide create" disabled={pending} onClick={() => send({ op: "create" }, true)}><Plus /> สร้างห้องใหม่ <ArrowRight /></button>
              </section>
              <section className="panel room-panel">
                <span className="panel-icon rose-icon"><LogIn /></span>
                <h2>เข้าร่วม</h2><p>กรอกรหัส 6 ตัวที่ได้รับจากโฮสต์</p>
                <form className="join" onSubmit={(event) => { event.preventDefault(); void send({ op: "join", code: joinCode }, true); }}>
                  <input aria-label="รหัสห้อง 6 ตัว" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="รหัส 6 ตัว" value={joinCode}
                    required pattern="[A-Z0-9]{6}" maxLength={6} onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
                  <button className="outline" type="submit" disabled={pending || !roomCode.test(joinCode)}>เข้าห้อง <ArrowRight /></button>
                </form>
              </section>
            </div>
            {error && <p className="feedback" role="alert">{error}</p>}
            <button className="text-button lobby-rules" onClick={() => setModal("rules")}><BookOpen /> วิธีเล่น</button>
          </div>
        ) : (
          <>
            <div className="match-top"><button className="text-button" onClick={leaveRoom} disabled={pending}><ArrowLeft /> กลับหน้าเลือกห้อง</button><button className="text-button" onClick={() => setModal("rules")}><BookOpen /> วิธีเล่น</button></div>
            <div className="arena-grid">
              <section className="arena" aria-label="สนามเล่น">
                <div className="arena-head">
                  <div className="arena-status" aria-live="polite"><span className={`status-gem ${game.turn}`} /><div><h2>{boardTitle}</h2><p>{boardHint}</p></div></div>
                  <span className="phase">{waiting ? "รอผู้เล่น" : game.winner ? "จบเกม" : phase}</span>
                </div>
                <div className="board-wrap">
                  <Board game={game} active={active} selected={selected} onPoint={point} />
                  {reaction && <div className={`reaction-pop ${reaction.sender === userId ? "mine" : ""}`} role="status">{reaction.emoji}<small>{reaction.sender === userId ? "คุณ" : "คู่แข่ง"}</small></div>}
                </div>
                <div className="players">
                  <Player side="mint" game={game} current={!waiting && !game.winner && game.turn === "mint"} you={side === "mint"} />
                  <span className="versus">VS</span>
                  <Player side="rose" game={game} current={!waiting && !game.winner && game.turn === "rose"} you={side === "rose"} waiting={waiting} />
                </div>
              </section>

              <aside className="sidebar" aria-label="ห้องและปฏิกิริยา">
                <section className="panel room-panel">
                  <span className="panel-icon mint-icon"><DoorOpen /></span>
                  <h2>{side === "mint" ? "คุณเป็นโฮสต์" : "คุณเป็นผู้เล่น"}</h2>
                  <p>{waiting ? "ส่งรหัสห้องนี้ให้เพื่อน" : "รหัสห้องของคุณ"}</p>
                  <div className="room-code"><strong>{code}</strong><button className="icon-button" onClick={copy} aria-label="คัดลอกรหัสห้อง"><Copy /></button></div>
                  <p className="room-note" role="status">{copied ? "คัดลอกรหัสแล้ว" : waiting ? "รอผู้เล่นคนที่ 2" : "ผู้เล่นครบ 2 คน"}</p>
                  {error && <p className="feedback" role="alert">{error}</p>}
                </section>
                <section className="panel emoji-panel">
                  <div className="emoji-heading"><span className="panel-icon rose-icon"><Smile /></span><div><h2>ส่งอิโมจิ</h2><p>{waiting ? "ส่งหาเพื่อนได้เมื่อเข้าห้องครบ" : "แตะอิโมจิเพื่อส่งให้คู่แข่ง"}</p></div></div>
                  <div className="emojis">{emojis.map((emoji, i) =>
                    <button key={emoji} title={["ทักทาย", "ไฟลุก", "ประหลาดใจ", "ปรบมือ", "เท่มาก", "เกมดี"][i]} disabled={waiting || pending}
                      onClick={() => send({ op: "react", code, emoji })}>{emoji}</button>)}</div>
                </section>
                <button className="history-link" onClick={() => setModal("history")}><History /> ประวัติการแข่งขัน <ArrowRight /></button>
              </aside>
            </div>
          </>
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
