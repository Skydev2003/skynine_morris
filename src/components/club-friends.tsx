"use client";

import { useState, type FormEvent } from "react";
import { Check, Search, Send, UserPlus, X } from "lucide-react";
import { playerIdPattern, type SocialLookup, type SocialPlayer, type SocialState } from "@/lib/social";
import { Dialog } from "./dialog";

export type SocialCommand = { op: "request"; id: string }
  | { op: "respond"; id: string; accept: boolean }
  | { op: "invite"; id: string; code: string }
  | { op: "acceptInvite" | "declineInvite"; code: string };

type Invite = SocialState["invites"][number];

function FriendIdentity({ player }: { player: SocialPlayer }) {
  return <div className="friend-identity">
    <strong>{player.name}</strong>
    <span className="friend-code">{player.id}</span>
    <span className="friend-status" data-online={player.online}>{player.online ? "ออนไลน์" : "ออฟไลน์"}</span>
  </div>;
}

export function InviteActions({ invite, pending, run }: {
  invite: Invite;
  pending: boolean;
  run: (command: SocialCommand) => void;
}) {
  return <div className="friend-actions">
    <button className="primary" type="button" disabled={pending} onClick={() => run({ op: "acceptInvite", code: invite.code })}>เข้าห้อง</button>
    <button className="outline" type="button" disabled={pending} onClick={() => run({ op: "declineInvite", code: invite.code })}>ปฏิเสธ</button>
  </div>;
}

export function ClubFriends({ state, error, pending, mode, inviteCode, canJoin, search, act, retry, close }: {
  state?: SocialState;
  error?: string;
  pending: boolean;
  mode: "friends" | "invite";
  inviteCode?: string;
  canJoin: boolean;
  search: (id: string) => Promise<SocialLookup | null>;
  act: (command: SocialCommand) => Promise<void>;
  retry: () => void;
  close: () => void;
}) {
  const [query, setQuery] = useState("");
  const [lookup, setLookup] = useState<SocialLookup | null>();
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const [sentInvites, setSentInvites] = useState<string[]>([]);
  const inviteMode = mode === "invite";

  async function find(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!playerIdPattern.test(query) || searching) return;
    setSearching(true);
    setLookup(undefined);
    setMessage(undefined);
    try {
      setLookup(await search(query));
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "ค้นหาไม่สำเร็จ กรุณาลองอีกครั้ง" });
    } finally {
      setSearching(false);
    }
  }

  async function run(command: SocialCommand) {
    if (pending) return;
    setMessage(undefined);
    try {
      await act(command);
      if (command.op === "request") {
        setLookup((player) => player?.id === command.id ? { ...player, relationship: "outgoing" } : player);
        setMessage({ text: "ส่งคำขอเป็นเพื่อนแล้ว" });
      }
      if (command.op === "respond") {
        setLookup((player) => player?.id === command.id ? { ...player, relationship: command.accept ? "friend" : "none" } : player);
        setMessage({ text: command.accept ? "เพิ่มเพื่อนแล้ว" : "ปฏิเสธคำขอแล้ว" });
      }
      if (command.op === "invite") {
        setSentInvites((ids) => [...ids, command.id]);
        setMessage({ text: "ส่งคำเชิญเข้าห้องแล้ว" });
      }
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง" });
    }
  }

  const friends = state?.friends.filter((player) => !inviteMode || player.online) ?? [];
  const relationship = lookup && (state?.friends.some(({ id }) => id === lookup.id) ? "friend"
    : state?.incoming.some(({ id }) => id === lookup.id) ? "incoming"
    : state?.outgoing.some(({ id }) => id === lookup.id) ? "outgoing" : lookup.relationship);
  const inviteUnavailable = inviteMode && !inviteCode;

  return (
    <Dialog title={inviteMode ? "ชวนเพื่อนเข้าห้อง" : "เพื่อนในเกม"} className="feature-dialog friends-dialog" close={close}>
      {!inviteMode && <>
        <p className="feature-intro">ใช้ไอดีผู้เล่น 8 ตัวเพื่อค้นหาและเพิ่มเพื่อน</p>
        <form className="friend-search" onSubmit={find}>
          <input aria-label="ไอดีผู้เล่น 8 ตัว" placeholder="ไอดีผู้เล่น 8 ตัว" autoComplete="off" autoCapitalize="characters"
            spellCheck={false} value={query} disabled={searching} maxLength={8} required pattern="[A-Z0-9]{8}"
            onChange={(event) => {
              setQuery(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
              setLookup(undefined);
            }} />
          <button className="primary" type="submit" disabled={!playerIdPattern.test(query) || searching}><Search aria-hidden="true" /> ค้นหา</button>
        </form>
      </>}
      {inviteMode && <p className="feature-intro">{inviteUnavailable ? "ห้องนี้มีผู้เล่นครบแล้ว" : "ส่งคำเชิญให้เพื่อนที่ออนไลน์ เพื่อนกดรับแล้วเข้าล็อบบี้ได้ทันที"}</p>}
      {error && <p className="feature-error" role="alert">{error} <button className="outline" type="button" onClick={retry}>ลองใหม่</button></p>}
      {!state && !error && <p className="feature-empty" role="status">กำลังโหลดรายชื่อ…</p>}
      {searching && <p className="feature-empty" role="status">กำลังค้นหา…</p>}
      {message && <p className={message.error ? "feature-error" : "feature-status"} role={message.error ? "alert" : "status"}>{message.text}</p>}
      {lookup === null && <p className="feature-empty" role="status">ไม่พบผู้เล่นที่ใช้ไอดีนี้</p>}
      {lookup && <div className="friend-row friend-search-result">
        <FriendIdentity player={lookup} />
        <div className="friend-actions">
          {relationship === "none" && <button className="primary" type="button" disabled={pending}
            onClick={() => void run({ op: "request", id: lookup.id })}><UserPlus aria-hidden="true" /> เพิ่มเพื่อน</button>}
          {relationship === "friend" && <span>เป็นเพื่อนแล้ว</span>}
          {relationship === "outgoing" && <span>รออีกฝ่ายตอบรับ</span>}
          {relationship === "incoming" && <button className="primary" type="button" disabled={pending}
            onClick={() => void run({ op: "respond", id: lookup.id, accept: true })}>รับเพื่อน</button>}
        </div>
      </div>}
      {!inviteMode && !!state?.incoming.length && <section className="friend-section">
        <h3>คำขอเป็นเพื่อน</h3>
        <ul className="friend-list">{state.incoming.map((player) => <li className="friend-row" key={player.id}>
          <FriendIdentity player={player} />
          <div className="friend-actions">
            <button className="primary" type="button" disabled={pending} onClick={() => void run({ op: "respond", id: player.id, accept: true })}><Check aria-hidden="true" /> รับเพื่อน</button>
            <button className="outline" type="button" aria-label={`ปฏิเสธคำขอจาก ${player.name}`} disabled={pending} onClick={() => void run({ op: "respond", id: player.id, accept: false })}><X aria-hidden="true" /></button>
          </div>
        </li>)}</ul>
      </section>}
      {!inviteMode && !!state?.invites.length && <section className="friend-section">
        <h3>คำเชิญเข้าห้อง</h3>
        <ul className="friend-list">{state.invites.map((invite) => <li className="friend-row" key={invite.code}>
          <div className="friend-identity"><strong>{invite.name}</strong><span>ห้อง {invite.code}</span></div>
          <InviteActions invite={invite} pending={pending || !canJoin} run={(command) => void run(command)} />
        </li>)}</ul>
      </section>}
      <section className="friend-section">
        <h3>{inviteMode ? "เพื่อนที่ออนไลน์" : "รายชื่อเพื่อน"}</h3>
        {state && !friends.length && <p className="feature-empty">{inviteMode ? "ยังไม่มีเพื่อนออนไลน์" : "ยังไม่มีเพื่อน ลองค้นหาด้วยไอดีผู้เล่น"}</p>}
        <ul className="friend-list">{friends.map((player) => <li className="friend-row" key={player.id}>
          <FriendIdentity player={player} />
          {inviteCode && <div className="friend-actions">
            <button className="primary" type="button" disabled={pending || sentInvites.includes(player.id)}
              onClick={() => void run({ op: "invite", id: player.id, code: inviteCode })}>
              <Send aria-hidden="true" /> {sentInvites.includes(player.id) ? "ส่งแล้ว" : "ส่งคำเชิญ"}
            </button>
          </div>}
        </li>)}</ul>
      </section>
      {!inviteMode && !!state?.outgoing.length && <section className="friend-section">
        <h3>คำขอที่ส่งแล้ว</h3>
        <ul className="friend-list">{state.outgoing.map((player) => <li className="friend-row" key={player.id}>
          <FriendIdentity player={player} /><span>รอตอบรับ</span>
        </li>)}</ul>
      </section>}
    </Dialog>
  );
}
