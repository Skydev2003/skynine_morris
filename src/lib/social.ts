import type { Room } from "./rooms";

export const playerIdPattern = /^[A-Z0-9]{8}$/;

export type SocialPlayer = { id: string; name: string; online: boolean };
export type SocialRelationship = "none" | "friend" | "incoming" | "outgoing";
export type SocialLookup = SocialPlayer & { relationship: SocialRelationship };
export type SocialInvite = { code: string; name: string; from: string };
export type SocialState = {
  playerId: string;
  friends: SocialPlayer[];
  incoming: SocialPlayer[];
  outgoing: SocialPlayer[];
  invites: SocialInvite[];
};

export type SocialCommand =
  | { op: "state" }
  | { op: "search"; playerId: string }
  | { op: "request"; id: string }
  | { op: "respond"; id: string; accept: boolean }
  | { op: "invite"; id: string; code: string }
  | { op: "acceptInvite" | "declineInvite" | "closeLobby"; code: string };

export type SocialReply = SocialState | { player: SocialLookup | null } | { room: Room } | { ok: true };

export async function socialApi<T extends SocialReply>(token: string, command: SocialCommand, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/social", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(command),
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง");
  return result as T;
}
