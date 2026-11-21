"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { browserDb } from "./browser-db";
import { socialApi, type SocialState } from "./social";
import { useMorris } from "./store";

export function useSocial(userId: string | undefined) {
  const [snapshot, setSnapshot] = useState<{ userId: string; state?: SocialState; error?: string }>();
  const loadVersion = useRef(0);

  const refresh = useCallback(async () => {
    const session = useMorris.getState().session;
    if (!userId || session?.user.id !== userId) return;
    const version = ++loadVersion.current;
    const current = () => version === loadVersion.current && useMorris.getState().session?.user.id === userId;
    try {
      const state = await socialApi<SocialState>(session.access_token, { op: "state" }, AbortSignal.timeout(10_000));
      if (current()) setSnapshot({ userId, state });
    } catch (error) {
      if (current()) {
        const message = error instanceof Error ? error.message : "โหลดรายชื่อเพื่อนไม่สำเร็จ";
        setSnapshot((old) => ({ userId, state: old?.userId === userId ? old.state : undefined, error: message }));
      }
    }
  }, [userId]);

  useEffect(() => {
    const db = browserDb();
    if (!userId || !db) return;
    let connected = false;
    let lastRefresh = 0;
    const update = () => {
      if (document.hidden) return;
      lastRefresh = Date.now();
      void refresh();
    };
    update();
    const channel = db.channel(`morris-social:${userId}`).on("postgres_changes", {
      event: "*", schema: "public", table: "morris_social_events", filter: `user_id=eq.${userId}`,
    }, update).subscribe((status) => {
      connected = status === "SUBSCRIBED";
      if (connected && Date.now() - lastRefresh > 1000) update();
    });
    const timer = window.setInterval(() => {
      if (Date.now() - lastRefresh >= (connected ? 15_000 : 4_000)) update();
    }, 4_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
      void db.removeChannel(channel);
    };
  }, [refresh, userId]);

  return { state: snapshot?.userId === userId ? snapshot?.state : undefined,
    error: snapshot?.userId === userId ? snapshot?.error : undefined, refresh };
}
