import { createClient } from "@supabase/supabase-js";
import { roomDb } from "@/lib/room-db";
import { COIN_PACKS, type TopUpOrder, type TopUpState } from "@/lib/top-up";

const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const error = (message: string, status: number) => Response.json({ error: message }, { status });
const columns = "id, baht, coins, transfer_ref, payer_name, status, submitted_at";
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const database = process.env.DATABASE_URL;
  const adminPlayer = process.env.MORRIS_TOPUP_ADMIN_PLAYER_ID;
  if (!url || !key || !database || !adminPlayer) return error("ระบบเติมเหรียญยังไม่เปิดรับรายการ", 503);

  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return error("กรุณาเข้าสู่ระบบก่อน", 401);
  const { data, error: authError } = await createClient(url, key, { auth }).auth.getClaims(token);
  const userId = data?.claims.sub;
  if (authError || !userId || data.claims.role !== "authenticated") return error("กรุณาเข้าสู่ระบบอีกครั้ง", 401);

  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object") return error("คำขอไม่ถูกต้อง", 400);

  try {
    const db = roomDb(database);
    const { rows: [admin] } = await db.query<{ user_id: string }>(
      "select user_id from public.morris_players where player_id = $1", [adminPlayer],
    );
    const canReview = admin?.user_id === userId;
    const qrPath = process.env.MORRIS_TOPUP_QR_PATH;
    const recipient = process.env.MORRIS_TOPUP_RECIPIENT?.trim();
    const payment = process.env.MORRIS_TOPUP_ACCEPTING === "true" && admin && recipient &&
      qrPath && /^\/[a-zA-Z0-9_/-]+\.(png|jpg|webp)$/.test(qrPath) && !qrPath.startsWith("//")
      ? { qrPath, recipient } : null;

    if (input.op === "state") {
      const { rows: orders } = await db.query<TopUpOrder>(
        `select ${columns} from public.morris_top_up_orders where user_id = $1 order by submitted_at desc limit 20`, [userId],
      );
      const pending = canReview ? (await db.query<TopUpOrder>(
        `select ${columns}, (select player_id from public.morris_players where user_id = orders.user_id) as player_id
         from public.morris_top_up_orders as orders where status = 'pending' order by submitted_at limit 50`,
      )).rows : [];
      return Response.json({ payment, canReview, orders, pending } satisfies TopUpState);
    }

    if (input.op === "submit") {
      if (!payment) return error("ระบบเติมเหรียญยังไม่เปิดรับรายการ", 503);
      const pack = COIN_PACKS.find(({ coins }) => coins === input.coins);
      const ref = typeof input.transferRef === "string" ? input.transferRef.trim().toUpperCase() : "";
      const payer = typeof input.payerName === "string" ? input.payerName.trim() : "";
      if (!pack || typeof input.id !== "string" || !idPattern.test(input.id) || !/^[A-Z0-9-]{6,64}$/.test(ref) ||
        payer.length < 2 || payer.length > 100 || /[\p{Cc}\p{Cf}]/u.test(payer)) {
        return error("ตรวจสอบชื่อผู้โอนและเลขอ้างอิงจากรายการโอน", 400);
      }
      const { rows: [order] } = await db.query<TopUpOrder>(
        `insert into public.morris_top_up_orders as orders (id, user_id, baht, coins, transfer_ref, payer_name)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (id) do update set id = excluded.id
         where orders.user_id = excluded.user_id and orders.coins = excluded.coins
           and orders.transfer_ref = excluded.transfer_ref and orders.payer_name = excluded.payer_name
         returning ${columns}`, [input.id, userId, pack.baht, pack.coins, ref, payer],
      );
      return order ? Response.json(order) : error("รายการแจ้งโอนนี้ถูกส่งไปแล้ว", 409);
    }

    if (input.op !== "approve" && input.op !== "reject") return error("คำขอเติมเหรียญไม่ถูกต้อง", 400);
    if (!canReview) return error("เฉพาะผู้ดูแลที่ตรวจรายการโอนได้", 403);
    if (typeof input.id !== "string" || !idPattern.test(input.id)) return error("รหัสรายการไม่ถูกต้อง", 400);

    if (input.op === "reject") {
      const result = await db.query(
        `update public.morris_top_up_orders set status = 'rejected', reviewed_at = clock_timestamp(), reviewed_by = $2
         where id = $1 and status = 'pending'`, [input.id, userId],
      );
      return result.rowCount ? Response.json({ ok: true }) : error("รายการถูกตรวจไปแล้ว", 409);
    }

    if (typeof input.confirmedRef !== "string" || typeof input.confirmedPayer !== "string" || typeof input.confirmedBaht !== "number" || !Number.isSafeInteger(input.confirmedBaht)) {
      return error("กรอกยอดและเลขอ้างอิงจากรายการเงินเข้าของธนาคาร", 400);
    }
    const { rowCount } = await db.query(
      `with approved as (
         update public.morris_top_up_orders set status = 'approved', reviewed_at = clock_timestamp(), reviewed_by = $2
         where id = $1 and status = 'pending' and transfer_ref = $3 and baht = $4 and payer_name = $5 returning user_id, coins
       )
       insert into public.morris_wallets as wallet (user_id, coins)
       select user_id, coins from approved
       on conflict (user_id) do update set coins = wallet.coins + excluded.coins`,
      [input.id, userId, input.confirmedRef.trim().toUpperCase(), input.confirmedBaht, input.confirmedPayer.trim()],
    );
    return rowCount ? Response.json({ ok: true }) : error("ยอด เลขอ้างอิง หรือชื่อผู้โอนไม่ตรง หรือรายการถูกตรวจไปแล้ว", 409);
  } catch (failure) {
    const code = failure && typeof failure === "object" && "code" in failure ? failure.code : "";
    if (code === "23505") return error("เลขอ้างอิงนี้เคยเติมเหรียญแล้ว", 409);
    console.error("Morris top-up request failed", code);
    return error("ทำรายการเติมเหรียญไม่สำเร็จ กรุณาลองอีกครั้ง", 500);
  }
}
