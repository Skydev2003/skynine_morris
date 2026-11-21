import { createClient } from "@supabase/supabase-js";
import { roomDb } from "@/lib/room-db";
import { isProfileFrame, SHOP_ITEMS } from "@/lib/shop";
import { buyShopItem, equipProfileFrame, getShopState } from "@/lib/shop-db";

const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const reply = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const database = process.env.DATABASE_URL;
  if (!url || !key || !database) return reply("ร้านค้ายังไม่พร้อมใช้งาน", 503);

  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return reply("กรุณาเข้าสู่ระบบก่อน", 401);
  const { data, error: authError } = await createClient(url, key, { auth }).auth.getClaims(token);
  const userId = data?.claims.sub;
  if (authError || !userId || data.claims.role !== "authenticated") return reply("กรุณาเข้าสู่ระบบอีกครั้ง", 401);

  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object") return reply("คำขอไม่ถูกต้อง", 400);

  try {
    const db = roomDb(database);
    if (input.op === "state") return Response.json(await getShopState(db, userId));
    if (input.op === "equip") {
      if (input.id !== null && !isProfileFrame(input.id)) return reply("ไม่พบกรอบนี้ในร้านค้า", 404);
      const state = await equipProfileFrame(db, userId, input.id);
      return state ? Response.json(state) : reply("ปลดล็อกกรอบนี้ก่อนสวมใส่", 403);
    }
    if (input.op !== "buy") return reply("คำขอร้านค้าไม่ถูกต้อง", 400);
    const item = SHOP_ITEMS.find(({ kind, id }) => kind === input.kind && id === input.id);
    if (!item) return reply("ไม่พบไอเทมนี้ในร้านค้า", 404);

    const purchased = await buyShopItem(db, userId, item);
    if (purchased) return Response.json(purchased);
    const state = await getShopState(db, userId);
    const owned = item.kind === "character" ? state.ownedCharacters.includes(item.id) : item.kind === "color" ? state.ownedColors.includes(item.id) : state.ownedFrames.includes(item.id);
    return owned ? reply("คุณมีไอเทมนี้แล้ว", 409) : reply("เหรียญไม่พอสำหรับไอเทมนี้", 409);
  } catch (error) {
    console.error("Morris shop database request failed", error && typeof error === "object" && "code" in error ? error.code : "");
    return reply("เชื่อมต่อร้านค้าไม่สำเร็จ กรุณาลองอีกครั้ง", 500);
  }
}
