import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createGame, isAction, other, play } from "@/lib/morris";
import { roomDb } from "@/lib/room-db";
import { emojis, isCharacter, isPieceColor, playerName, roomCode, turnSeconds, type Room } from "@/lib/rooms";

const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const reply = (error: string, status: number) => Response.json({ error }, { status });
const conflict = () => reply("ห้องเพิ่งอัปเดต กรุณาลองอีกครั้ง", 409);
const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const database = process.env.DATABASE_URL;
  if (!url || !key || !database) return reply("เซิร์ฟเวอร์ยังไม่ได้ตั้งค่าเล่นออนไลน์", 503);

  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return reply("กรุณาเข้าสู่ระบบก่อน", 401);
  const { data, error: authError } = await createClient(url, key, { auth }).auth.getClaims(token);
  const userId = data?.claims.sub;
  if (authError || !userId || data.claims.role !== "authenticated") return reply("กรุณาเข้าสู่ระบบอีกครั้ง", 401);
  const name = playerName(data.claims.user_metadata?.player_name);

  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object") return reply("คำขอไม่ถูกต้อง", 400);

  try {
    const db = roomDb(database);
    if (input.op === "create") {
      if (!name) return reply("ตั้งชื่อผู้เล่นก่อนสร้างห้อง", 422);
      for (let attempt = 0; attempt < 4; attempt++) {
        const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
        const { rows: [room] } = await db.query<Room>(
          "insert into public.morris_rooms (code, host_id, host_name, game) values ($1, $2, $3, $4) on conflict (code) do nothing returning *",
          [code, userId, name, createGame()],
        );
        if (room) return Response.json(room);
      }
      return reply("สร้างรหัสห้องไม่สำเร็จ กรุณาลองอีกครั้ง", 500);
    }

    if (typeof input.code !== "string" || !roomCode.test(input.code)) return reply("กรอกรหัสห้อง 6 ตัว", 400);
    const { rows: [room] } = await db.query<Room>("select * from public.morris_rooms where code = $1", [input.code]);
    if (!room) return reply("ไม่พบห้องนี้ ตรวจสอบรหัสแล้วลองอีกครั้ง", 404);

    const side = room.host_id === userId ? "mint" : room.guest_id === userId ? "rose" : null;
    if (input.op === "join") {
      if (side) return Response.json(room);
      if (room.guest_id) return reply("ห้องนี้มีผู้เล่นครบแล้ว", 409);
      if (!name) return reply("ตั้งชื่อผู้เล่นก่อนเข้าห้อง", 422);
      const { rows: [joined] } = await db.query<Room>(
        "update public.morris_rooms set guest_id = $1, guest_name = $2 where code = $3 and guest_id is null returning *",
        [userId, name, room.code],
      );
      return joined ? Response.json(joined) : conflict();
    }

    if (!side) return reply("คุณยังไม่ได้เข้าห้องนี้", 403);
    if (input.op === "loadout" || input.op === "ready" || input.op === "start") {
      if (room.started_at || input.revision !== room.revision) return conflict();

      if (input.op === "start") {
        if (side !== "mint") return reply("โฮสต์เป็นคนเริ่มเกม", 403);
        if (!room.guest_id || !room.guest_ready) return reply("รอให้ผู้เข้าร่วมกดพร้อม", 409);
        const { rows: [started] } = await db.query<Room>(
          "update public.morris_rooms set started_at = clock_timestamp(), turn_deadline = clock_timestamp() + $3::int * interval '1 second' where code = $1 and revision = $2 and started_at is null returning *",
          [room.code, room.revision, turnSeconds],
        );
        return started ? Response.json(started) : conflict();
      }

      if (input.op === "ready" && side === "mint") return reply("โฮสต์เริ่มเกมได้เมื่อเพื่อนพร้อม", 422);
      const seat = side === "mint" ? "host" : "guest";
      const character = input.op === "loadout" ? input.character : room[`${seat}_character`];
      const color = input.op === "loadout" ? input.color : room[`${seat}_color`];
      const ready = input.op === "ready" ? input.ready : false;
      if (!isCharacter(character) || !isPieceColor(color) || typeof ready !== "boolean") return reply("การตั้งค่าผู้เล่นไม่ถูกต้อง", 400);
      if (color === (seat === "host" ? room.guest_color : room.host_color)) return reply("สีนี้ถูกจองอยู่ เลือกสีอื่นได้เลย", 409);
      const { rows: [updated] } = await db.query<Room>(
        `update public.morris_rooms set ${seat}_character = $1, ${seat}_color = $2, ${seat}_ready = $3
         where code = $4 and revision = $5 and started_at is null returning *`,
        [character, color, ready, room.code, room.revision],
      );
      return updated ? Response.json(updated) : conflict();
    }

    if (!room.guest_id) return reply("รอเพื่อนเข้าห้องก่อน", 409);
    if (!room.started_at) return reply("การแข่งขันยังไม่เริ่ม", 409);

    if (input.op === "react") {
      if (!emojis.includes(input.emoji)) return reply("เลือกอิโมจิจากรายการ", 400);
      const { rows: [updated] } = await db.query<Room>(
        `update public.morris_rooms set reaction = $1, reacted_at = clock_timestamp()
         where code = $2 and (reacted_at is null or reacted_at < clock_timestamp() - interval '650 milliseconds')
         returning *`,
        [{ emoji: input.emoji, sender: userId }, room.code],
      );
      return updated ? Response.json(updated) : reply("รอสักครู่ก่อนส่งอีกครั้ง", 429);
    }

    if (input.op === "timeout") {
      if (input.version !== room.game_revision || !room.turn_deadline || room.game.winner) return conflict();
      const winner = other(room.game.turn);
      const { rows: [updated] } = await db.query<Room>(
        `update public.morris_rooms set game = $1, winner_id = $2, finished_at = clock_timestamp(),
               game_revision = game_revision + 1, turn_deadline = null, finish_reason = 'timeout'
         where code = $3 and game_revision = $4 and winner_id is null and turn_deadline <= clock_timestamp()
         returning *`,
        [{ ...room.game, winner, capture: false, last: null }, winner === "mint" ? room.host_id : room.guest_id, room.code, room.game_revision],
      );
      return updated ? Response.json(updated) : conflict();
    }

    if (input.op !== "play" || !isAction(input.action)) return reply("คำสั่งเดินหมากไม่ถูกต้อง", 400);
    if (input.version !== room.game_revision) return conflict();

    let game;
    try {
      game = play(room.game, side, input.action);
    } catch (error) {
      return reply(error instanceof Error ? error.message : "เดินหมากไม่ได้", 422);
    }

    const winner = game.winner === "mint" ? room.host_id : game.winner === "rose" ? room.guest_id : null;
    const { rows: [updated] } = await db.query<Room>(
      `update public.morris_rooms
       set game = $1, game_revision = game_revision + 1, winner_id = $2,
           finished_at = case when $2::uuid is null then null else clock_timestamp() end,
           turn_deadline = case when $2::uuid is not null then null
                                when $5 or turn_deadline is null then clock_timestamp() + $6::int * interval '1 second'
                                else turn_deadline end
       where code = $3 and game_revision = $4 and (turn_deadline is null or turn_deadline > clock_timestamp())
       returning *`,
      [game, winner, room.code, room.game_revision, game.turn !== room.game.turn, turnSeconds],
    );
    return updated ? Response.json(updated) : conflict();
  } catch (error) {
    console.error("Morris room database request failed", error && typeof error === "object" && "code" in error ? error.code : "");
    return reply("เชื่อมต่อห้องไม่สำเร็จ กรุณาลองอีกครั้ง", 500);
  }
}
