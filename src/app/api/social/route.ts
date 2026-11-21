import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Pool, PoolClient } from "pg";
import { roomDb } from "@/lib/room-db";
import { playerName, roomCode, type Room } from "@/lib/rooms";
import {
  playerIdPattern,
  type SocialInvite, type SocialLookup, type SocialPlayer, type SocialRelationship, type SocialState,
} from "@/lib/social";

const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const reply = (error: string, status: number) => Response.json({ error }, { status });
const ok = () => Response.json({ ok: true });
const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const fresh = "clock_timestamp() - interval '45 seconds'";
const displayName = "coalesce(nullif(left(btrim(u.raw_user_meta_data->>'player_name'), 24), ''), 'ผู้เล่น')";

type PlayerRow = { user_id: string; player_id: string };
type RelationshipRow = SocialPlayer & { relationship: Exclude<SocialRelationship, "none"> };
type Database = Pool | PoolClient;

function normalizePlayerId(value: unknown) {
  return typeof value === "string" && playerIdPattern.test(value.trim().toUpperCase()) ? value.trim().toUpperCase() : null;
}

async function ensurePlayer(db: Pool, userId: string) {
  const params = [userId];
  for (let attempt = 0; attempt < 5; attempt++) {
    const { rows: [existing] } = await db.query<PlayerRow>(
      "select user_id, player_id from public.morris_players where user_id = $1", params,
    );
    if (existing) return existing;
    const id = Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join("");
    const { rows: [created] } = await db.query<PlayerRow>(
      "insert into public.morris_players (user_id, player_id) values ($1, $2) on conflict do nothing returning user_id, player_id",
      [userId, id],
    );
    if (created) return created;
  }
  throw new Error("Player ID allocation failed");
}

async function state(db: Pool, player: PlayerRow): Promise<SocialState> {
  const userId = player.user_id;
  await db.query(`update public.morris_players set last_seen_at = clock_timestamp()
    where user_id = $1 and (last_seen_at is null or last_seen_at < clock_timestamp() - interval '8 seconds')`, [userId]);
  const [relationships, pendingInvites] = await Promise.all([
    db.query<RelationshipRow>(`
      select p.player_id as id, ${displayName} as name,
        coalesce(f.accepted_at is not null and p.last_seen_at > ${fresh}, false) as online,
        case when f.accepted_at is not null then 'friend'
             when f.recipient_id = $1 then 'incoming' else 'outgoing' end as relationship
      from public.morris_friendships f
      join public.morris_players p on p.user_id = case when f.sender_id = $1 then f.recipient_id else f.sender_id end
      join auth.users u on u.id = p.user_id
      where $1 in (f.sender_id, f.recipient_id)
      order by online desc, name, id`, [userId]),
    db.query<SocialInvite>(`
      select i.code, p.player_id as "from", ${displayName} as name
      from public.morris_invites i
      join public.morris_players p on p.user_id = i.sender_id
      join auth.users u on u.id = i.sender_id
      join public.morris_rooms r on r.code = i.code and r.host_id = i.sender_id
      where i.recipient_id = $1 and i.expires_at > clock_timestamp()
        and p.last_seen_at > ${fresh} and r.guest_id is null and r.started_at is null
      order by i.expires_at desc`, [userId]),
  ]);
  const result: SocialState = { playerId: player.player_id, friends: [], incoming: [], outgoing: [], invites: pendingInvites.rows };
  for (const { relationship, ...peer } of relationships.rows) {
    result[relationship === "friend" ? "friends" : relationship].push(peer);
  }
  return result;
}

async function lookup(db: Pool, userId: string, id: string) {
  const { rows: [player] } = await db.query<SocialLookup>(`
    select p.player_id as id, ${displayName} as name,
      coalesce(f.accepted_at is not null and p.last_seen_at > ${fresh}, false) as online,
      case when f.accepted_at is not null then 'friend' when f.sender_id = $1 then 'outgoing'
           when f.recipient_id = $1 then 'incoming' else 'none' end as relationship
    from public.morris_players p
    join auth.users u on u.id = p.user_id
    left join public.morris_friendships f
      on least(f.sender_id, f.recipient_id) = least($1, p.user_id)
      and greatest(f.sender_id, f.recipient_id) = greatest($1, p.user_id)
    where p.player_id = $2 and p.user_id <> $1`, [userId, id]);
  return player ?? null;
}

async function notify(db: Database, users: string[]) {
  if (!users.length) return;
  await db.query(`
    insert into public.morris_social_events (user_id)
    select user_id from (select distinct unnest($1::uuid[]) as user_id) users order by user_id
    on conflict (user_id) do update set changed_at = clock_timestamp()`, [users]);
}

async function transaction(db: Pool, run: (client: PoolClient) => Promise<Response>) {
  const client = await db.connect();
  try {
    await client.query("begin");
    const response = await run(client);
    await client.query("commit");
    return response;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function friendAction(db: Pool, userId: string, target: string, input: Record<string, unknown>) {
  return transaction(db, async (client) => {
    let changed;
    if (input.op === "request") {
      changed = await client.query(
        "insert into public.morris_friendships (sender_id, recipient_id) values ($1, $2) on conflict do nothing",
        [userId, target],
      );
      if (!changed.rowCount) return reply("มีคำขอเป็นเพื่อนหรือเป็นเพื่อนกันอยู่แล้ว", 409);
    } else if (input.accept === true) {
      changed = await client.query(`update public.morris_friendships set accepted_at = clock_timestamp()
        where sender_id = $2 and recipient_id = $1 and accepted_at is null`, [userId, target]);
    } else {
      changed = await client.query(`delete from public.morris_friendships
        where sender_id = $2 and recipient_id = $1 and accepted_at is null`, [userId, target]);
    }
    if (!changed.rowCount) return reply("คำขอนี้ถูกตอบไปแล้วหรือหมดอายุ", 409);
    await notify(client, [userId, target]);
    return ok();
  });
}

async function invite(db: Pool, userId: string, target: string, code: string) {
  return transaction(db, async (client) => {
    const { rowCount } = await client.query(`
      insert into public.morris_invites (code, sender_id, recipient_id, expires_at)
      select r.code, r.host_id, p.user_id, clock_timestamp() + interval '2 minutes'
      from public.morris_rooms r
      join public.morris_players p on p.user_id = $3
      join public.morris_friendships f on least(f.sender_id, f.recipient_id) = least(r.host_id, p.user_id)
        and greatest(f.sender_id, f.recipient_id) = greatest(r.host_id, p.user_id)
      where r.code = $1 and r.host_id = $2 and r.guest_id is null and r.started_at is null
        and f.accepted_at is not null and p.last_seen_at > ${fresh}
      on conflict (code, recipient_id) do update set expires_at = excluded.expires_at
        where morris_invites.expires_at < clock_timestamp() + interval '110 seconds'`, [code, userId, target]);
    if (!rowCount) return reply("ส่งคำเชิญไม่ได้ เพื่อนอาจออฟไลน์ ห้องอาจเต็ม หรือเพิ่งส่งไปแล้ว", 409);
    await client.query("delete from public.morris_invites where recipient_id = $1 and expires_at < clock_timestamp()", [target]);
    await notify(client, [target]);
    return ok();
  });
}

async function inviteAction(db: Pool, userId: string, name: string, code: string, op: string) {
  return transaction(db, async (client) => {
    if (op === "acceptInvite") {
      const { rows: [room] } = await client.query<Room>(`
        with ticket as materialized (
          select i.sender_id from public.morris_invites i join public.morris_players p on p.user_id = i.sender_id
          where i.code = $1 and i.recipient_id = $2 and i.expires_at > clock_timestamp()
            and p.last_seen_at > ${fresh} for update of i
        )
        update public.morris_rooms r set guest_id = $2, guest_name = $3
        from ticket t where r.code = $1 and r.host_id = t.sender_id
          and r.guest_id is null and r.started_at is null returning r.*`, [code, userId, name]);
      if (room) {
        const { rows } = await client.query<{ recipient_id: string }>(
          "select recipient_id from public.morris_invites where code = $1 and expires_at > clock_timestamp()", [code],
        );
        await notify(client, rows.map(({ recipient_id }) => recipient_id));
        return Response.json({ room });
      }

      // Return the room on a retried acceptance after the first response was lost.
      const { rows: [existing] } = await client.query<Room>(
        "select * from public.morris_rooms where code = $1 and guest_id = $2", [code, userId],
      );
      return existing ? Response.json({ room: existing }) : reply("คำเชิญหมดอายุหรือห้องนี้มีผู้เล่นครบแล้ว", 409);
    }

    const condition = op === "closeLobby" ? "sender_id" : "recipient_id";
    const { rows } = await client.query<{ recipient_id: string }>(
      `delete from public.morris_invites where code = $1 and ${condition} = $2 returning recipient_id`, [code, userId],
    );
    await notify(client, rows.map(({ recipient_id }) => recipient_id));
    return ok();
  });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const database = process.env.DATABASE_URL;
  if (!url || !key || !database) return reply("ระบบเพื่อนยังไม่พร้อมใช้งาน", 503);
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return reply("กรุณาเข้าสู่ระบบก่อน", 401);
  const { data, error } = await createClient(url, key, { auth }).auth.getClaims(token);
  const userId = data?.claims.sub;
  if (error || !userId || data.claims.role !== "authenticated") return reply("กรุณาเข้าสู่ระบบอีกครั้ง", 401);
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object" || Array.isArray(input)) return reply("คำขอไม่ถูกต้อง", 400);

  try {
    const db = roomDb(database);
    if (input.op === "state") return Response.json(await state(db, await ensurePlayer(db, userId)));
    if (input.op === "search") {
      const id = normalizePlayerId(input.playerId);
      if (!id) return reply("กรอกไอดีผู้เล่น 8 ตัว", 400);
      return Response.json({ player: await lookup(db, userId, id) });
    }

    const name = playerName(data.claims.user_metadata?.player_name);
    if (!name) return reply("ตั้งชื่อผู้เล่นก่อนใช้งานระบบเพื่อน", 422);
    if (["acceptInvite", "declineInvite", "closeLobby"].includes(input.op)) {
      if (typeof input.code !== "string" || !roomCode.test(input.code)) return reply("รหัสห้องไม่ถูกต้อง", 400);
      return await inviteAction(db, userId, name, input.code, input.op);
    }
    if (!["request", "respond", "invite"].includes(input.op)) return reply("คำขอไม่ถูกต้อง", 400);
    if (input.op === "respond" && typeof input.accept !== "boolean") return reply("คำขอไม่ถูกต้อง", 400);
    const id = normalizePlayerId(input.id);
    if (!id) return reply("กรอกไอดีผู้เล่น 8 ตัว", 400);
    const { rows: [target] } = await db.query<PlayerRow>(
      "select user_id, player_id from public.morris_players where player_id = $1 and user_id <> $2", [id, userId],
    );
    if (!target) return reply("ไม่พบผู้เล่นตามไอดีนี้", 404);
    if (input.op === "invite") {
      if (typeof input.code !== "string" || !roomCode.test(input.code)) return reply("รหัสห้องไม่ถูกต้อง", 400);
      return await invite(db, userId, target.user_id, input.code);
    }
    await ensurePlayer(db, userId);
    return await friendAction(db, userId, target.user_id, input);
  } catch (error) {
    console.error("Morris social request failed", error && typeof error === "object" && "code" in error ? error.code : "");
    return reply("เชื่อมต่อระบบเพื่อนไม่สำเร็จ กรุณาลองอีกครั้ง", 500);
  }
}
