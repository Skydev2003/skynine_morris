"use client";

import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Check, Copy, Trophy, UserRound } from "lucide-react";

import { CoinBalance } from "./coin";
import { googleAvatarUrl } from "@/lib/avatar";
import type { ProfileFrame } from "@/lib/shop";

export function googleAvatar(user: User) {
  const identity = user.identities?.find(({ provider }) => provider === "google");
  const metadata = user.app_metadata.provider === "google" ? user.user_metadata : undefined;
  const photos = [identity?.identity_data?.picture, identity?.identity_data?.avatar_url, metadata?.picture, metadata?.avatar_url];
  return photos.map(googleAvatarUrl).find(Boolean);
}

export function PlayerAvatar({ user, frame }: { user: User; frame?: ProfileFrame | null }) {
  return <ProfileAvatar photo={googleAvatar(user)} frame={frame} />;
}

export function ProfileAvatar({ photo, frame }: { photo?: string; frame?: ProfileFrame | null }) {
  const [failedPhoto, setFailedPhoto] = useState<string>();
  return <span className={`player-avatar${frame ? ` avatar-frame frame-${frame}` : ""}`} aria-hidden="true">
    {photo && failedPhoto !== photo
      // eslint-disable-next-line @next/next/no-img-element -- Load the profile image directly from Google without proxying it.
      ? <img src={photo} alt="" referrerPolicy="no-referrer" onError={() => setFailedPhoto(photo)} />
      : <UserRound />}
  </span>;
}

type ProfileProps = {
  user: User;
  wins: number;
  coins?: number;
  name: string;
  pending: boolean;
  error: string;
  playerId?: string;
  frame?: ProfileFrame | null;
  setName: (name: string) => void;
  saveName: (event: FormEvent<HTMLFormElement>) => void;
};

export function PlayerProfile({ user, wins, coins, name, pending, error, playerId, frame, setName, saveName }: ProfileProps) {
  const [copyStatus, setCopyStatus] = useState("");

  async function copyId() {
    if (!playerId) return;
    try {
      await navigator.clipboard.writeText(playerId);
      setCopyStatus("คัดลอกไอดีแล้ว");
    } catch {
      setCopyStatus("เลือกข้อความไอดีเพื่อคัดลอก");
    }
  }

  return (
    <section className="game-ticket player-profile" aria-labelledby="profile-title">
      <h1 id="profile-title">โปรไฟล์ผู้เล่น</h1>
      <PlayerAvatar user={user} frame={frame} />
      <div className="profile-stats">
        <div className="wins"><Trophy aria-hidden="true" /><strong>{wins}</strong> ชนะ</div>
        <CoinBalance coins={coins} />
      </div>
      <div className="profile-player-id">
        <span>ไอดีเกม</span><strong>{playerId ?? "–"}</strong>
        <button className="outline" type="button" aria-label="คัดลอกไอดีเกม" disabled={!playerId} onClick={() => void copyId()}><Copy aria-hidden="true" /></button>
      </div>
      {copyStatus && <p className="feature-status" role="status">{copyStatus}</p>}
      <form className="login-form" onSubmit={saveName}>
        <label htmlFor="player-name">ชื่อที่ใช้เล่น</label>
        <input id="player-name" value={name} onChange={(event) => setName(event.target.value)}
          autoComplete="off" minLength={2} maxLength={24} placeholder="เช่น มะลิ" required />
        <button className="primary wide" disabled={pending}><Check aria-hidden="true" /> บันทึกชื่อ</button>
      </form>
      {error && <p className="feedback" role="alert">{error}</p>}
    </section>
  );
}
