import { createClient } from "@supabase/supabase-js";
import { DAILY_COINS, dailyPuzzle, solveDailyPuzzle } from "@/lib/daily-puzzle";
import { roomDb } from "@/lib/room-db";

const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const reply = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const database = process.env.DATABASE_URL;
  if (!url || !key || !database) return reply("ด่านประจำวันยังไม่พร้อม", 503);

  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return reply("กรุณาเข้าสู่ระบบก่อน", 401);
  const { data, error } = await createClient(url, key, { auth }).auth.getClaims(token);
  const userId = data?.claims.sub;
  if (error || !userId || data.claims.role !== "authenticated") return reply("กรุณาเข้าสู่ระบบอีกครั้ง", 401);

  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object") return reply("คำขอไม่ถูกต้อง", 400);

  const puzzle = dailyPuzzle();
  try {
    const db = roomDb(database);
    if (input.op === "state") {
      const { rowCount } = await db.query(
        "select 1 from public.morris_daily_puzzle_rewards where user_id = $1 and puzzle_day = $2",
        [userId, puzzle.day],
      );
      return Response.json({ puzzle, completed: Boolean(rowCount), reward: DAILY_COINS });
    }
    if (input.op !== "solve") return reply("คำขอด่านประจำวันไม่ถูกต้อง", 400);
    if (input.day !== puzzle.day) return reply("ด่านใหม่มาแล้ว กดโหลดด่านใหม่แล้วลองอีกครั้ง", 409);

    const game = solveDailyPuzzle(puzzle, input.action);
    if (!game) return Response.json({ correct: false });

    const { rowCount } = await db.query(
      `with claimed as (
         insert into public.morris_daily_puzzle_rewards (user_id, puzzle_day)
         values ($1, $2) on conflict do nothing returning user_id
       )
       insert into public.morris_wallets as wallet (user_id, coins)
       select user_id, $3 from claimed
       on conflict (user_id) do update set coins = wallet.coins + excluded.coins`,
      [userId, puzzle.day, DAILY_COINS],
    );
    return Response.json({ correct: true, earned: rowCount ? DAILY_COINS : 0, game });
  } catch (error) {
    console.error("Morris daily puzzle database request failed", error && typeof error === "object" && "code" in error ? error.code : "");
    return reply("เปิดด่านประจำวันไม่สำเร็จ กรุณาลองอีกครั้ง", 500);
  }
}
