"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthScreen } from "./auth-screen";
import { MatchSearch } from "./arena-wait";
import { ClubFriends, InviteActions, type SocialCommand } from "./club-friends";
import { CoinIcon } from "./coin";
import { ClubShop } from "./club-shop";
import { QuickCharacterPicker } from "./quick-character-picker";
import { ClubPreview } from "./club-preview";
import { Dialog } from "./dialog";
import { DailyChallenge } from "./daily-challenge";
import { GameDetails } from "./game-details";
import { Leaderboard } from "./leaderboard";
import { MatchResult } from "./match-result";
import { MatchStage } from "./match-stage";
import { googleAvatar, PlayerAvatar, PlayerProfile } from "./player-profile";
import { RoomLobby } from "./room-lobby";
import { GameLottie } from "./game-lottie";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, DoorOpen, LogOut, Music2, ShoppingBag, Shuffle, Swords, Trophy, UsersRound, Volume2, VolumeX } from "lucide-react";
import { captures, placing, play, targets, type Action } from "@/lib/morris";
import { browserDb, googleInviteKey, onlineConfigured } from "@/lib/browser-db";
import { playerName, roomCode, turnSeconds, type Match, type QuickLoadout, type Room } from "@/lib/rooms";
import { useArenaAudio } from "@/lib/arena-audio";
import { DAILY_COINS, DAILY_PUZZLE_ENABLED } from "@/lib/daily-puzzle";
import { localTimeout, localTurn, opponentMove, resetOpponentMatch } from "@/lib/opponent";
import { useMatchmaking } from "@/lib/use-matchmaking";
import { socialApi, type SocialLookup } from "@/lib/social";
import { useSocial } from "@/lib/use-social";
import { useShop } from "@/lib/use-shop";
import { useMorris } from "@/lib/store";

type Modal = "rules" | "history" | "leaderboard" | "friends" | "invite" | "shop" | "quick-character" | "daily";

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
  const [quickChoice, setQuickChoice] = useState<{ userId: string; loadout: QuickLoadout }>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reaction, setReaction] = useState<{ emoji: string; sender: string } | null>(null);
  const [socialPending, setSocialPending] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const busy = useRef(false);
  const socialBusy = useRef(false);
  const sound = useArenaAudio(room ? (room.finished_at ? null : "arena") : name && !editingName ? "club" : null);
  const matchmaking = useMatchmaking(session, name, (matched) => {
    sound.cue("matched");
    openMatch(matched);
  });
  const social = useSocial(userId);
  const shop = useShop(userId, room?.finished_at);
  const coinCount = shop.state?.coins.toLocaleString("th-TH");

  function openMatch(next: Room) {
    const current = useMorris.getState();
    if (current.session?.user.id !== userId) return;
    current.openRoom(next);
    if (userId && !next.local_match) localStorage.setItem(`morris-room-${userId}`, next.code);
    current.setJoinCode("");
    setShowJoin(null);
    setModal(null);
    setInviteError("");
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
    if (!session || socialBusy.current) return;
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
    if (session && room && !room.started_at && room.host_id === session.user.id) {
      void socialApi(session.access_token, { op: "closeLobby", code: room.code }, AbortSignal.timeout(8000)).catch(() => {});
    }
    if (userId) localStorage.removeItem(`morris-room-${userId}`);
    state.exit();
    setError("");
    setReaction(null);
    setModal(null);
  }

  function openShop() {
    setModal("shop");
    void shop.request({ op: "state" }).catch(() => {});
  }

  async function socialAction(command: SocialCommand) {
    if (!session || socialBusy.current || busy.current) throw new Error("กำลังทำรายการ กรุณารอสักครู่");
    if (command.op === "acceptInvite" && (useMorris.getState().room || matchmaking.searching)) {
      throw new Error("กลับหน้าเมนูเพื่อรับคำเชิญเข้าห้อง");
    }
    socialBusy.current = true;
    setSocialPending(true);
    setInviteError("");
    try {
      const result = await socialApi<{ room: Room } | { ok: true }>(session.access_token, command, AbortSignal.timeout(10_000));
      if ("room" in result) openMatch(result.room);
    } finally {
      socialBusy.current = false;
      setSocialPending(false);
      void social.refresh();
    }
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
  const waitingHost = room && !room.started_at && !room.guest_id && side === "mint" ? room.code : undefined;
  const canJoinInvite = Boolean(!room && name && !matchmaking.searching && !pending);
  const nextInvite = titleScreen && canJoinInvite ? social.state?.invites[0] : undefined;
  const socialNotices = (social.state?.incoming.length ?? 0) + (social.state?.invites.length ?? 0);
  const menuBusy = pending || matchmaking.searching || socialPending;

  return (
    <>
      <main className={`game-world ${room ? "stadium-world" : titleScreen ? "club-world" : "menu-world title-world"}`} key={room ? room.code : "menu"}>
        {room && <GameLottie kind="ambient" />}
        {pending && !room && <div className="loading-badge" role="status"><GameLottie kind="loading" /><span>กำลังโหลด</span></div>}
        <div className="world-corner corner-left">
          {room && <button className="hud-button" onClick={leaveRoom} disabled={pending} aria-label="กลับหน้าเลือกห้อง" title="กลับหน้าเลือกห้อง"><ArrowLeft /><span className="hud-label">กลับ</span></button>}
          {titleScreen && <button className="title-profile" type="button" disabled={pending || matchmaking.searching} onClick={() => {
            setNameInput(name);
            setEditingName(true);
            setError("");
          }}><PlayerAvatar user={session.user} frame={shop.state?.equippedFrame} /><span>โปรไฟล์</span></button>}
          {!room && editingName && name && <button className="hud-button profile-return" type="button" disabled={pending} onClick={() => {
            setEditingName(false);
            setError("");
          }}><ArrowLeft aria-hidden="true" /><span>กลับเมนู</span></button>}
        </div>
        <div className="world-corner corner-right">
          {titleScreen ? (
            <button className="club-audio" type="button" data-sound-control data-playing={sound.playing}
              onClick={sound.toggle} aria-label="เสียงเกม" aria-pressed={sound.playing}
              title={sound.playing ? "ปิดเสียงเกม" : "เปิดเพลงและเสียงเกม"}>
              {sound.playing ? <Music2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
              <span className="club-audio-meter" aria-hidden="true"><i /><i /><i /></span>
            </button>
          ) : (
            <button className="hud-button sound-toggle" type="button" data-sound-control onClick={sound.toggle}
              aria-label={sound.enabled ? "ปิดเสียง" : "เปิดเสียง"} title={sound.enabled ? "ปิดเสียง" : "เปิดเสียง"}>
              {sound.enabled ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
            </button>
          )}
          <button className="wins" onClick={() => setModal("history")} aria-label={`ประวัติการแข่งขัน ชนะ ${wins} ครั้ง`}><Trophy /><strong>{wins}</strong><span>ชนะ</span></button>
          {!titleScreen && <button className="hud-button" onClick={() => setModal("rules")} aria-label="วิธีเล่น" title="วิธีเล่น"><BookOpen /></button>}
          {!room && <button className="hud-button" onClick={signOut} disabled={pending || matchmaking.searching} aria-label="ออกจากระบบ" title="ออกจากระบบ"><LogOut /></button>}
        </div>
        {nextInvite && <aside className="friend-invite-banner" aria-label="คำเชิญเข้าห้อง">
          <div><strong>{nextInvite.name} ชวนคุณเข้าห้อง</strong><span>ห้อง {nextInvite.code}</span>
            {inviteError && <p className="feature-error" role="alert">{inviteError}</p>}
          </div>
          <InviteActions invite={nextInvite} pending={socialPending} run={(command) => {
            void socialAction(command).catch((error) => setInviteError(error instanceof Error ? error.message : "รับคำเชิญไม่สำเร็จ"));
          }} />
        </aside>}
        {!room && (!name || editingName) ? (
          <PlayerProfile user={session.user} wins={wins} coins={shop.state?.coins} name={nameInput} pending={pending} error={error}
            playerId={social.state?.playerId} frame={shop.state?.equippedFrame} setName={setNameInput} saveName={saveName} />
        ) : shownRoom && room && side ? room.started_at ? (
          <MatchStage key={room.started_at} room={shownRoom} confirmed={room} cue={sound.cue} side={side} accessToken={session.access_token}
            ownProfile={{ photo: googleAvatar(session.user), frame: shop.state?.equippedFrame ?? null }} selected={selected} pending={pending} reaction={room.reaction ? reaction : null} error={error} point={point}
            expired={() => {
              if (!prediction && room.turn_deadline && !room.game.winner) void send({ op: "timeout", code, version: room.game_revision });
            }}
            react={(emoji) => void send({ op: "react", code, emoji })} />
        ) : (
          <>
            <RoomLobby room={room} seat={side === "mint" ? "host" : "guest"} pending={pending} copied={copied} copy={copy}
              inventory={shop.state} openShop={openShop} invite={() => { setModal("invite"); void social.refresh(); }}
              send={(command) => void send({ ...command, code, revision: room.revision })} />
            {error && <p className="stage-error" role="alert">{error}</p>}
          </>
        ) : matchmaking.searching ? (
          <MatchSearch cancel={matchmaking.cancel} />
        ) : (
          <section className="club-home" aria-labelledby="entry-title">
            <div className="club-home-menu">
              <h1 id="entry-title" className="club-home-title">Morris <span>Club</span></h1>
              <p className="club-greeting">สวัสดี <strong>{name}</strong></p>
              <button className="club-quick-play" type="button" aria-haspopup="dialog" disabled={menuBusy} onClick={() => setModal("quick-character")}>
                <span className="club-quick-icon"><Shuffle aria-hidden="true" /></span>
                สุ่มเล่นออนไลน์ <ArrowRight className="club-quick-arrow" aria-hidden="true" />
              </button>
              <div className="club-room-actions" role="group" aria-label="เล่นกับเพื่อน">
                <button type="button" disabled={menuBusy} onClick={() => send({ op: "create" }, true)}>
                  <Swords aria-hidden="true" /> สร้างห้องใหม่
                </button>
                <button ref={joinButton} type="button" aria-expanded={joinOpen} aria-controls="title-join" disabled={menuBusy}
                  onClick={() => {
                    setShowJoin(!joinOpen);
                    setError("");
                    if (!joinOpen) window.requestAnimationFrame(() => joinInput.current?.focus());
                  }}><DoorOpen aria-hidden="true" /> เข้าร่วมห้อง</button>
              </div>
              {DAILY_PUZZLE_ENABLED && <button className="club-daily" type="button" aria-haspopup="dialog" disabled={menuBusy} onClick={() => setModal("daily")}>
                <CalendarDays aria-hidden="true" /> ด่านประจำวัน
                <small><CoinIcon /> {DAILY_COINS} เหรียญ</small>
              </button>}
              <form id="title-join" className="title-join" hidden={!joinOpen}
                onSubmit={(event) => { event.preventDefault(); void send({ op: "join", code: joinCode }, true); }}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && !pending) {
                    setShowJoin(false);
                    setError("");
                    joinButton.current?.focus();
                  }
                }}>
                <label htmlFor="title-room-code">กรอกรหัสห้อง 6 ตัว</label>
                <input ref={joinInput} id="title-room-code" autoComplete="off" autoCapitalize="characters" spellCheck={false}
                  placeholder="เช่น AB12CD" value={joinCode} required pattern="[A-Z0-9]{6}" maxLength={6}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
                <button type="submit" disabled={menuBusy || !roomCode.test(joinCode)}>เข้าห้อง <ArrowRight aria-hidden="true" /></button>
              </form>
              {(error || matchmaking.error) && <p className="title-error" role="alert">{error || matchmaking.error}</p>}
            </div>
            <ClubPreview />
            <nav className="club-home-nav" aria-label="เมนูสโมสร">
              <button type="button" aria-haspopup="dialog" disabled={menuBusy} onClick={() => { setModal("friends"); void social.refresh(); }}>
                <UsersRound aria-hidden="true" /> เพื่อน
                {socialNotices > 0 && <small aria-label={`${socialNotices} รายการใหม่`}>{socialNotices}</small>}
              </button>
              <button type="button" aria-haspopup="dialog" aria-label={coinCount === undefined ? undefined : `ร้านค้า ${coinCount} เหรียญ`}
                disabled={menuBusy} onClick={openShop}>
                <ShoppingBag aria-hidden="true" /> ร้านค้า
                {coinCount !== undefined && <small className="club-shop-count"><CoinIcon />{coinCount}</small>}
              </button>
              <button type="button" aria-haspopup="dialog" onClick={() => setModal("leaderboard")}><Trophy aria-hidden="true" /> อันดับโลก</button>
              <button type="button" aria-haspopup="dialog" onClick={() => setModal("rules")}><BookOpen aria-hidden="true" /> วิธีเล่น</button>
            </nav>
          </section>
        )}
      </main>

      {room?.finished_at && side && <MatchResult key={`${room.code}:${room.game_revision}`} room={room} side={side} pending={pending} error={error}
        rematch={() => void send({ op: "rematch", code, version: room.game_revision })}
        end={() => room.rematch_closed ? leaveRoom() : void send({ op: "end", code, version: room.game_revision })} />}

      {modal === "leaderboard" && <Dialog title="อันดับโลก" close={() => setModal(null)}><Leaderboard /></Dialog>}

      {DAILY_PUZZLE_ENABLED && modal === "daily" && <DailyChallenge token={session.access_token} close={() => setModal(null)} rewarded={(coins) => {
        sound.cue("win");
        if (coins) void shop.request({ op: "state" }).catch(() => {});
      }} />}

      {modal === "rules" && <GameDetails title="วิธีเล่น Morris" close={() => setModal(null)} />}

      {(modal === "friends" || modal === "invite") && <ClubFriends key={modal} mode={modal}
        state={social.state} error={social.error} pending={socialPending} inviteCode={modal === "invite" ? waitingHost : undefined}
        canJoin={canJoinInvite} close={() => setModal(null)} retry={() => void social.refresh()}
        search={async (id) => (await socialApi<{ player: SocialLookup | null }>(session.access_token, { op: "search", playerId: id })).player}
        act={socialAction} />}

      {modal === "quick-character" && titleScreen && <QuickCharacterPicker inventory={shop.state}
        previous={quickChoice?.userId === session.user.id ? quickChoice.loadout : undefined}
        close={() => setModal(null)} start={(loadout) => {
          setQuickChoice({ userId: session.user.id, loadout });
          setModal(null);
          sound.cue("search");
          void matchmaking.start(loadout);
        }} />}

      {modal === "shop" && <ClubShop token={session.access_token} state={shop.state} error={shop.error} close={() => setModal(null)}
        retry={() => void shop.request({ op: "state" }).catch(() => {})}
        buy={({ kind, id }) => shop.request({ op: "buy", kind, id })}
        equip={(id) => shop.request({ op: "equip", id })} />}

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
