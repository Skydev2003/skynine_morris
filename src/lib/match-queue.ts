import { randomInt } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { createGame } from "./morris";
import { alternatePieceColor, turnSeconds, type Character, type PieceColor, type QuickLoadout, type Room } from "./rooms";

export const queueActions = ["queue", "queue_status", "queue_cancel"] as const;
export type QueueAction = typeof queueActions[number];
export type QueueReply =
  | { status: "paired"; room: Room }
  | { status: "waiting"; retryIn: number }
  | { status: "fallback" | "cancelled" };

const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const makeRoomCode = () => Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");

type Ticket = { user_id: string; ticket: string; display_name: string; selected_character: Character | null; selected_color: PieceColor | null; room_code: string | null; ms: number };

async function resolveTicket(db: PoolClient, existing: Ticket, action: QueueAction): Promise<QueueReply> {
  if (existing.room_code) {
    const result = await db.query<Room>("select * from public.morris_rooms where code=$1", [existing.room_code]);
    if (result.rows[0]) return { status: "paired", room: result.rows[0] };
  }
  if (action === "queue_cancel" || existing.ms <= 0) {
    await db.query("delete from public.morris_match_queue where user_id=$1 and ticket=$2", [existing.user_id, existing.ticket]);
    return { status: action === "queue_cancel" ? "cancelled" : "fallback" };
  }
  return { status: "waiting", retryIn: Math.min(350, existing.ms) };
}

export async function matchQueue(pool: Pool, action: QueueAction, userId: string, ticket: string, name: string, loadout: Partial<QuickLoadout>): Promise<QueueReply> {
  const db = await pool.connect();
  try {
    await db.query("begin");
    // Serialize joining, cancelling, and expiry so a ticket cannot match after falling back.
    await db.query("select pg_advisory_xact_lock(34580923)");
    const { rows: [existing] } = await db.query<Ticket>(`select *, ceil(extract(epoch from (deadline - clock_timestamp()))*1000)::int as ms
      from public.morris_match_queue where user_id=$1 and ticket=$2`, [userId, ticket]);
    let result: QueueReply;
    if (existing) {
      result = await resolveTicket(db, existing, action);
    } else if (action !== "queue") {
      result = { status: action === "queue_cancel" ? "cancelled" : "fallback" };
    } else {
      const { rows: [peer] } = await db.query<Ticket>(`select * from public.morris_match_queue
        where user_id <> $1 and room_code is null and deadline > clock_timestamp()
        order by deadline limit 1`, [userId]);

      const { rows: [room] } = peer ? await createPairedRoom(db, peer, userId, name, loadout) : { rows: [] };
      await db.query(`insert into public.morris_match_queue (user_id,ticket,display_name,deadline,room_code,selected_character,selected_color)
        values ($1,$2,$3,clock_timestamp()+interval '3 seconds',$4,$5,$6)
        on conflict (user_id) do update set ticket=excluded.ticket, display_name=excluded.display_name,
          deadline=excluded.deadline, room_code=excluded.room_code, selected_character=excluded.selected_character, selected_color=excluded.selected_color`,
        [userId, ticket, name, room?.code ?? null, loadout.character ?? null, loadout.color ?? null]);

      if (peer && room) {
        await db.query("update public.morris_match_queue set room_code=$1 where user_id=$2", [room.code, peer.user_id]);
        result = { status: "paired", room };
      } else {
        result = { status: "waiting", retryIn: 350 };
      }
      await db.query("delete from public.morris_match_queue where deadline < clock_timestamp()-interval '5 minutes'");
    }
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback").catch(() => {});
    throw error;
  } finally {
    db.release();
  }
}

async function createPairedRoom(db: PoolClient, peer: Ticket, userId: string, name: string, loadout: Partial<QuickLoadout>) {
  let hostColor = peer.selected_color ?? "mint";
  let guestColor = loadout.color ?? "rose";
  if (hostColor === guestColor) {
    if (!peer.selected_color && loadout.color) hostColor = alternatePieceColor(guestColor);
    else guestColor = alternatePieceColor(hostColor);
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = await db.query<Room>(`insert into public.morris_rooms
      (code, host_id, host_name, guest_id, guest_name, game, started_at, turn_deadline, host_character, guest_character, host_color, guest_color)
      values ($1,$2,$3,$4,$5,$6,clock_timestamp(),clock_timestamp()+$7::int * interval '1 second',$8,$9,$10,$11)
      on conflict (code) do nothing returning *`,
    [makeRoomCode(), peer.user_id, peer.display_name, userId, name, createGame(), turnSeconds, peer.selected_character ?? "kai", loadout.character ?? "momo", hostColor, guestColor]);
    if (result.rows.length) return result;
  }
  throw new Error("Room code exhausted");
}
