import { randomInt } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createGame, isAction, play } from "@/lib/morris";
import { roomDb } from "@/lib/room-db";
import { emojis, roomCode, type Room } from "@/lib/rooms";

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
  const { data: { user }, error: authError } = await createClient(url, key, { auth }).auth.getUser(token);
  if (authError || !user) return reply("กรุณาเข้าสู่ระบบอีกครั้ง", 401);

  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object") return reply("คำขอไม่ถูกต้อง", 400);

  try {
    const db = roomDb(database);
    if (input.op === "create") {
      for (let attempt = 0; attempt < 4; attempt++) {
        const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
        const { rows: [room] } = await db.query<Room>(
          "insert into public.morris_rooms (code, host_id, game) values ($1, $2, $3) on conflict (code) do nothing returning *",
          [code, user.id, createGame()],
        );
        if (room) return Response.json(room);
      }
      return reply("สร้างรหัสห้องไม่สำเร็จ กรุณาลองอีกครั้ง", 500);
    }

    if (typeof input.code !== "string" || !roomCode.test(input.code)) return reply("กรอกรหัสห้อง 6 ตัว", 400);
    const { rows: [room] } = await db.query<Room>("select * from public.morris_rooms where code = $1", [input.code]);
    if (!room) return reply("ไม่พบห้องนี้ ตรวจสอบรหัสแล้วลองอีกครั้ง", 404);

    const side = room.host_id === user.id ? "mint" : room.guest_id === user.id ? "rose" : null;
    if (input.op === "join") {
      if (side) return Response.json(room);
      if (room.guest_id) return reply("ห้องนี้มีผู้เล่นครบแล้ว", 409);
      const { rows: [joined] } = await db.query<Room>(
        "update public.morris_rooms set guest_id = $1 where code = $2 and guest_id is null returning *",
        [user.id, room.code],
      );
      return joined ? Response.json(joined) : conflict();
    }

    if (!side) return reply("คุณยังไม่ได้เข้าห้องนี้", 403);
    if (!room.guest_id) return reply("รอเพื่อนเข้าห้องก่อน", 409);

    if (input.op === "react") {
      if (!emojis.includes(input.emoji)) return reply("เลือกอิโมจิจากรายการ", 400);
      const { rows: [updated] } = await db.query<Room>(
        `update public.morris_rooms set reaction = $1, reacted_at = clock_timestamp()
         where code = $2 and (reacted_at is null or reacted_at < clock_timestamp() - interval '650 milliseconds')
         returning *`,
        [{ emoji: input.emoji, sender: user.id }, room.code],
      );
      return updated ? Response.json(updated) : reply("รอสักครู่ก่อนส่งอีกครั้ง", 429);
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
           finished_at = case when $2::uuid is null then null else clock_timestamp() end
       where code = $3 and game_revision = $4 returning *`,
      [game, winner, room.code, room.game_revision],
    );
    return updated ? Response.json(updated) : conflict();
  } catch (error) {
    console.error("Morris room database request failed", error && typeof error === "object" && "code" in error ? error.code : "");
    return reply("เชื่อมต่อห้องไม่สำเร็จ กรุณาลองอีกครั้ง", 500);
  }
}
