"use client";

import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { Check, Trophy, UserRound } from "lucide-react";

function googleAvatar(user: User) {
  const identity = user.identities?.find(({ provider }) => provider === "google");
  const metadata = user.app_metadata.provider === "google" ? user.user_metadata : undefined;
  const photos = [identity?.identity_data?.picture, identity?.identity_data?.avatar_url, metadata?.picture, metadata?.avatar_url];
  for (const photo of photos) {
    if (typeof photo !== "string") continue;
    try {
      const url = new URL(photo);
      if (url.protocol === "https:" && /(^|\.)googleusercontent\.com$/.test(url.hostname) &&
        !url.username && !url.password && !url.port) return url.href;
    } catch {
      continue;
    }
  }
}

export function PlayerAvatar({ user }: { user: User }) {
  const photo = googleAvatar(user);
  const [failedPhoto, setFailedPhoto] = useState<string>();
  return <span className="player-avatar" aria-hidden="true">
    {photo && failedPhoto !== photo
      // eslint-disable-next-line @next/next/no-img-element -- Load the profile image directly from Google without proxying it.
      ? <img src={photo} alt="" referrerPolicy="no-referrer" onError={() => setFailedPhoto(photo)} />
      : <UserRound />}
  </span>;
}

type ProfileProps = {
  user: User;
  wins: number;
  name: string;
  pending: boolean;
  error: string;
  setName: (name: string) => void;
  saveName: (event: FormEvent<HTMLFormElement>) => void;
};

export function PlayerProfile({ user, wins, name, pending, error, setName, saveName }: ProfileProps) {
  return (
    <section className="game-ticket player-profile" aria-labelledby="profile-title">
      <h1 id="profile-title">โปรไฟล์ผู้เล่น</h1>
      <PlayerAvatar user={user} />
      <div className="wins"><Trophy aria-hidden="true" /><strong>{wins}</strong> ชนะ</div>
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
