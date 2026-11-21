"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfileFrame, ShopItem, ShopState } from "./shop";
import { useMorris } from "./store";

export function useShop(userId: string | undefined, finished: string | null | undefined) {
  const [snapshot, setSnapshot] = useState<{ userId: string; state?: ShopState; error?: string }>();
  const version = useRef(0);

  const request = useCallback(async (command: { op: "state" } | { op: "buy"; kind: ShopItem["kind"]; id: string } | { op: "equip"; id: ProfileFrame | null }) => {
    const session = useMorris.getState().session;
    if (!userId || session?.user.id !== userId) throw new Error("กรุณาเข้าสู่ระบบก่อน");
    const revision = ++version.current;
    try {
      const response = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(command),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "เปิดร้านค้าไม่สำเร็จ");
      if ((command.op !== "state" || revision === version.current) && useMorris.getState().session?.user.id === userId) {
        if (command.op !== "state") version.current++;
        setSnapshot({ userId, state: data as ShopState });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "เปิดร้านค้าไม่สำเร็จ";
      if (command.op === "state" && revision === version.current && useMorris.getState().session?.user.id === userId) {
        setSnapshot((old) => ({ userId, state: old?.userId === userId ? old.state : undefined, error: message }));
      }
      throw new Error(message);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) void request({ op: "state" }).catch(() => {});
  }, [userId, finished, request]);

  return { state: snapshot?.userId === userId ? snapshot?.state : undefined,
    error: snapshot?.userId === userId ? snapshot?.error : undefined, request };
}
