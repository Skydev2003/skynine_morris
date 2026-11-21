"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AuthScreen } from "./auth-screen";
import { Leaderboard } from "./leaderboard";
import { MatchResult } from "./match-result";
import { MatchStage } from "./match-stage";
import { PlayerAvatar, PlayerProfile } from "./player-profile";
import { RoomLobby } from "./room-lobby";
import { GameLottie } from "./game-lottie";
import { ArrowLeft, ArrowRight, BookOpen, LogOut, Shuffle, Swords, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { captures, placing, play, targets, type Action } from "@/lib/morris";
import { browserDb, googleInviteKey, onlineConfigured } from "@/lib/browser-db";
import { playerName, roomCode, turnSeconds, type Match, type Room } from "@/lib/rooms";
import { useArenaAudio } from "@/lib/arena-audio";
import { localTimeout, localTurn, opponentMove, resetOpponentMatch } from "@/lib/opponent";
import { useMatchmaking } from "@/lib/use-matchmaking";
import { useMorris } from "@/lib/store";

type Modal = "rules" | "history" | "leaderboard";

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
  const { session, room, selected, joinCode, setJoinCode, wins, matches, optimistic } = state;
  const userId = session?.user.id;
  const name = playerName(session?.user.user_metadata.player_name);
  const [editingName, setEditingName] = useState(false);
  const [showJoin, setShowJoin] = useState<boolean | null>(null);
  const joinInput = useRef<HTMLInputElement>(null);
  const joinButton = useRef<HTMLButtonElement>(null);
  const [nameInput, setNameInput] = useState("");
  const [authReady, setAuthReady] = useState(!onlineConfigured);
  const code = room?.code;
  const side = room && (room.host_id === userId ? "mint" : "rose");
  const [modal, setModal] = useState<Modal | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState<{ emoji: string; sender: string } | null>(null);
  const busy = useRef(false);
  const sound = useArenaAudio(Boolean(room?.started_at && !room.finished_at));
  const matchmaking = useMatchmaking(session, name, openMatch);

  function openMatch(next: Room) {
    const current = useMorris.getState();
    if (current.session?.user.id !== userId) return;
    current.openRoom(next);
    if (userId && !next.local_match) localStorage.setItem(`morris-room-${userId}`, next.code);
    current.setJoinCode("");
    setShowJoin(null);
    setModal(null);
    window.history.replaceState(null, "", "/");
    setReaction(null);
    setCopied(false);
  }

  useEffect(() => {
    if (!room?.local_match || room.game.winner || room.game.turn !== "rose") return;
    const timer = window.setTimeout(() => {
      const current = useMorris.getState().room;
      if (!current || current.code !== room.code || current.game_revision !== room.game_revision) return;
      const timed = localTimeout(current);
      if (timed !== current) { useMorris.getState().syncRoom(timed); return; }
      const action = opponentMove(current.game);
      if (action) useMorris.getState().syncRoom(localTurn(current, play(current.game, "rose", action)));
    }, 700 + Math.random() * 400);
    return () => window.clearTimeout(timer);
  }, [room]);

  useEffect(() => {
    if (!room?.local_match || !room.finished_at || !room.host_rematch) return;
    const timer = window.setTimeout(() => {
      const current = useMorris.getState().room;
      if (current?.code === room.code && current.game_revision === room.game_revision) {
        useMorris.getState().syncRoom(resetOpponentMatch(current));
      }
    }, 850);
    return () => window.clearTimeout(timer);
  }, [room]);

  useEffect(() => {
    const db = browserDb();
    const invite = new URLSearchParams(window.location.search).get("room")?.toUpperCase();
    if (invite && roomCode.test(invite)) useMorris.getState().setJoinCode(invite);
    if (!db) return;
    const { data } = db.auth.onAuthStateChange((_event, current) => {
      if (current) {
        const oauthInvite = sessionStorage.getItem(googleInviteKey);
        sessionStorage.removeItem(googleInviteKey);
        if (!invite && oauthInvite && roomCode.test(oauthInvite)) useMorris.getState().setJoinCode(oauthInvite);
      }
      useMorris.getState().setSession(current);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const db = browserDb();
    if (!db || !userId) return;
    const remembered = localStorage.getItem(`morris-room-${userId}`);
    const invite = useMorris.getState().joinCode;
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
    if (!db || !code || !userId || code.startsWith("local-")) return;
    const refresh = async () => {
      if (document.hidden) return;
      const { data } = await db.from("morris_rooms").select().eq("code", code).maybeSingle<Room>();
      if (data) useMorris.getState().syncRoom(data);
    };
    let connected = false;
    let lastSync = 0;
    const channel = db.channel(`morris:${code}`).on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "morris_rooms", filter: `code=eq.${code}`,
    }, ({ new: updated }) => {
      lastSync = Date.now();
      useMorris.getState().syncRoom(updated as Room);
    }).subscribe((status) => {
      connected = status === "SUBSCRIBED";
      if (connected) { lastSync = Date.now(); void refresh(); }
    });
    const timer = window.setInterval(() => {
      if (connected && Date.now() - lastSync < 5400) return;
      lastSync = Date.now();
      void refresh();
    }, 1350);
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
      db.from("morris_results").select("room_code", { count: "exact", head: true }).eq("winner_id", userId),
      db.from("morris_results").select("room_code, game_revision, winner_id, finished_at")
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
    if (room?.local_match) {
      if (input.op === "end") leaveRoom();
      else if (input.op === "rematch") state.syncRoom({ ...room, host_rematch: true, revision: room.revision + 1 });
      else if (input.op === "timeout") state.syncRoom(localTimeout(room));
      else if (input.op === "react" && typeof input.emoji === "string") {
        state.syncRoom({ ...room, reaction: { emoji: input.emoji, sender: room.host_id }, reacted_at: new Date().toISOString(), revision: room.revision + 1 });
      }
      return;
    }
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(12_000),
      });
      const data = await response.json();
      if (!response.ok) {
        if (input.op === "timeout" && response.status === 409) return;
        throw new Error(data.error ?? "เชื่อมต่อไม่สำเร็จ");
      }
      const current = useMorris.getState();
      if (current.session?.user.id !== session.user.id) return;
      if (open) {
        openMatch(data as Room);
      } else if (input.op === "end") {
        leaveRoom();
      } else {
        current.syncRoom(data as Room);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ");
    } finally {
      if (input.op === "play") useMorris.getState().previewMove(null);
      busy.current = false;
      setPending(false);
    }
  }

  function point(at: number) {
    if (!room || !side || !active || busy.current) return;
    if (room.turn_deadline && Date.now() >= Date.parse(room.turn_deadline)) return;
    const game = room.game;
    let action: Action | undefined;
    if (game.capture) {
      if (captures(game).includes(at)) action = { type: "capture", at };
    } else if (placing(game) && !game.board[at]) action = { type: "place", at };
    else if (!placing(game)) {
      if (game.board[at] === game.turn) { state.select(selected === at ? null : at); return; }
      if (selected !== null && targets(game, selected).includes(at)) action = { type: "move", from: selected, at };
    }
    if (!action) return;
    const preview = play(game, side, action);
    if (room.local_match) { state.syncRoom(localTurn(room, preview)); return; }
    const deadline = preview.winner ? null : preview.turn === game.turn ? room.turn_deadline
      : new Date(Date.now() + turnSeconds * 1000).toISOString();
    state.previewMove({ code: room.code, version: room.game_revision, game: preview, deadline });
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
    setEditingName(false);
    setNameInput("");
  }

  const active = Boolean(room?.started_at && !pending && !room.game.winner && side === room.game.turn);
  const prediction = optimistic && optimistic.code === room?.code && optimistic.version === room.game_revision ? optimistic : null;
  const shownRoom = room && prediction ? { ...room, game: prediction.game, game_revision: room.game_revision + 1,
    turn_deadline: prediction.deadline } : room;

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = browserDb();
    const next = playerName(nameInput);
    if (!db || pending) return;
    if (!next) { setError("ชื่อผู้เล่นต้องมี 2–24 ตัวอักษร"); return; }
    setPending(true);
    setError("");
    try {
      const updated = await db.auth.updateUser({ data: { player_name: next } });
      if (updated.error) throw updated.error;
      const refreshed = await db.auth.refreshSession();
      if (refreshed.error || !refreshed.data.session) throw new Error("refresh");
      state.setSession(refreshed.data.session);
      setEditingName(false);
    } catch {
      setError("บันทึกชื่อไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  if (!authReady) return <main className="game-loading" role="status"><GameLottie kind="loading" /><span>กำลังเข้าสู่สนาม</span></main>;
  if (!session) return <AuthScreen configured={onlineConfigured} />;

  const titleScreen = !room && Boolean(name) && !editingName;
  const joinOpen = showJoin ?? Boolean(joinCode);

  return (
    <>
      <main className={`game-world ${room ? "stadium-world" : "menu-world title-world"}`} key={room ? room.code : "menu"}>
        {room && <GameLottie kind="ambient" />}
        {pending && !room && <div className="loading-badge" role="status"><GameLottie kind="loading" /><span>กำลังโหลด</span></div>}
        <div className="world-corner corner-left">
          {room && <button className="hud-button" onClick={leaveRoom} disabled={pending} aria-label="กลับหน้าเลือกห้อง" title="กลับหน้าเลือกห้อง"><ArrowLeft /><span className="hud-label">กลับ</span></button>}
          {titleScreen && <button className="title-profile" type="button" disabled={pending || matchmaking.searching} onClick={() => {
            setNameInput(name);
            setEditingName(true);
            setError("");
          }}><PlayerAvatar user={session.user} /><span>โปรไฟล์</span></button>}
          {!room && editingName && name && <button className="hud-button profile-return" type="button" disabled={pending} onClick={() => {
            setEditingName(false);
            setError("");
          }}><ArrowLeft aria-hidden="true" /><span>กลับเมนู</span></button>}
        </div>
        <div className="world-corner corner-right">
          <button className="hud-button sound-toggle" onClick={sound.toggle} aria-label={sound.muted ? "เปิดเสียง" : "ปิดเสียง"} title={sound.muted ? "เปิดเสียง" : "ปิดเสียง"}>
            {sound.muted ? <VolumeX /> : <Volume2 />}
          </button>
          <button className="wins" onClick={() => setModal("history")} aria-label={`ประวัติการแข่งขัน ชนะ ${wins} ครั้ง`}><Trophy /><strong>{wins}</strong><span>ชนะ</span></button>
          {!titleScreen && <button className="hud-button" onClick={() => setModal("rules")} aria-label="วิธีเล่น" title="วิธีเล่น"><BookOpen /></button>}
          {!room && <button className="hud-button" onClick={signOut} disabled={pending || matchmaking.searching} aria-label="ออกจากระบบ" title="ออกจากระบบ"><LogOut /></button>}
        </div>
        {!room && (!name || editingName) ? (
          <PlayerProfile user={session.user} wins={wins} name={nameInput} pending={pending} error={error}
            setName={setNameInput} saveName={saveName} />
        ) : shownRoom && room && side ? room.started_at ? (
          <MatchStage key={room.started_at} room={shownRoom} confirmed={room} cue={sound.cue} side={side} selected={selected} pending={pending} reaction={room.reaction ? reaction : null} error={error} point={point}
            expired={() => {
              if (!prediction && room.turn_deadline && !room.game.winner) void send({ op: "timeout", code, version: room.game_revision });
            }}
            react={(emoji) => void send({ op: "react", code, emoji })} />
        ) : (
          <>
            <RoomLobby room={room} seat={side === "mint" ? "host" : "guest"} pending={pending} copied={copied} copy={copy}
              send={(command) => void send({ ...command, code, revision: room.revision })} />
            {error && <p className="stage-error" role="alert">{error}</p>}
          </>
        ) : (
          <section className="title-menu" aria-labelledby="entry-title">
            <h1 id="entry-title"><span>Morris</span> <span>Club</span></h1>
            <div className="title-actions" role="group" aria-label="เมนูหลัก">
              {matchmaking.searching ? (
                <div className="queue-status" role="status"><GameLottie kind="loading" /><span>กำลังหาคู่แข่ง</span>
                  <button className="outline" type="button" onClick={matchmaking.cancel}>ยกเลิก</button>
                </div>
              ) : <button className="title-option title-play" type="button" disabled={pending} onClick={matchmaking.start}>
                <Shuffle aria-hidden="true" /> สุ่มเล่นออนไลน์
              </button>}
              <button className="title-option" type="button" disabled={pending || matchmaking.searching} onClick={() => send({ op: "create" }, true)}>
                <Swords aria-hidden="true" /> สร้างห้องใหม่
              </button>
              <button ref={joinButton} className="title-option" type="button" aria-expanded={joinOpen} aria-controls="title-join" disabled={pending || matchmaking.searching}
                onClick={() => {
                  setShowJoin(!joinOpen);
                  setError("");
                  if (!joinOpen) window.requestAnimationFrame(() => joinInput.current?.focus());
                }}>เข้าร่วมห้อง</button>
              <form id="title-join" className="join title-join" hidden={!joinOpen}
                onSubmit={(event) => { event.preventDefault(); void send({ op: "join", code: joinCode }, true); }}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !pending) {
                    setShowJoin(false);
                    setError("");
                    joinButton.current?.focus();
                  }
                }}>
                <input ref={joinInput} aria-label="รหัสห้อง 6 ตัว" autoComplete="off" autoCapitalize="characters" spellCheck={false}
                  placeholder="รหัสห้อง 6 ตัว" value={joinCode} required pattern="[A-Z0-9]{6}" maxLength={6}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
                <button className="outline" type="submit" disabled={pending || matchmaking.searching || !roomCode.test(joinCode)}>เข้าห้อง <ArrowRight aria-hidden="true" /></button>
              </form>
              <button className="title-option" type="button" onClick={() => setModal("leaderboard")}><Trophy aria-hidden="true" /> อันดับโลก</button>
              <button className="title-option" type="button" onClick={() => setModal("rules")}>วิธีเล่น</button>
            </div>
            {(error || matchmaking.error) && <p className="title-error" role="alert">{error || matchmaking.error}</p>}
          </section>
        )}
      </main>

      {room?.finished_at && side && <MatchResult key={`${room.code}:${room.game_revision}`} room={room} side={side} pending={pending} error={error}
        rematch={() => void send({ op: "rematch", code, version: room.game_revision })}
        end={() => room.rematch_closed ? leaveRoom() : void send({ op: "end", code, version: room.game_revision })} />}

      {modal === "leaderboard" && <Dialog title="อันดับโลก" close={() => setModal(null)}><Leaderboard /></Dialog>}

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
          {matches.length ? <ul className="match-list">{matches.map((match) => <li key={`${match.room_code}:${match.game_revision}`}>
            <div><strong>{match.room_code}</strong><small>{match.finished_at && new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(match.finished_at))}</small></div>
            <span className={match.winner_id === userId ? "won" : "lost"}>{match.winner_id === userId ? "ชนะ" : "แพ้"}</span>
          </li>)}</ul> : <p>ผลการแข่งขันออนไลน์จะแสดงที่นี่เมื่อคุณเล่นจบเกม</p>}
      </Dialog>}
    </>
  );
}
