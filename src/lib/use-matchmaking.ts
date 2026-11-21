import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { QueueAction, QueueReply } from "./match-queue";
import { createOpponentMatch } from "./opponent";
import type { Room } from "./rooms";

type Search = { ticket: string; token: string; cancelled: boolean; controller: AbortController };

async function ask(search: Search, op: QueueAction): Promise<QueueReply> {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${search.token}` },
    body: JSON.stringify({ op, ticket: search.ticket }),
    signal: AbortSignal.any([search.controller.signal, AbortSignal.timeout(8000)]),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error);
  return payload;
}

export function useMatchmaking(session: Session | null, name: string, openRoom: (room: Room) => void) {
  const active = useRef<Search | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => () => active.current?.controller.abort(), []);

  async function start() {
    if (!session || !name || active.current) return;
    const search: Search = { ticket: crypto.randomUUID(), token: session.access_token, cancelled: false, controller: new AbortController() };
    active.current = search;
    setSearching(true);
    setError("");
    try {
      let result = await ask(search, "queue");
      while (result.status === "waiting") {
        if (search.cancelled) { result = await ask(search, "queue_cancel"); break; }
        const retryIn = result.retryIn;
        await new Promise((resolve) => window.setTimeout(resolve, Math.max(25, retryIn)));
        result = await ask(search, search.cancelled ? "queue_cancel" : "queue_status");
      }
      if (search.controller.signal.aborted) return;
      if (result.status === "paired") openRoom(result.room);
      else if (result.status === "fallback" && !search.cancelled) openRoom(createOpponentMatch(session.user.id, name));
    } catch {
      if (!search.controller.signal.aborted && !search.cancelled) setError("ค้นหาคู่แข่งไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      if (active.current === search) {
        active.current = null;
        if (!search.controller.signal.aborted) setSearching(false);
      }
    }
  }

  return { searching, error, start, cancel: () => { if (active.current) active.current.cancelled = true; } };
}
