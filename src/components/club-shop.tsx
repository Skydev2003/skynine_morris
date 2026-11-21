"use client";

import { useState } from "react";
import { Check, Coins, Sparkles } from "lucide-react";
import { characters, colors } from "@/lib/rooms";
import { SHOP_ITEMS, type ShopState, WIN_COINS } from "@/lib/shop";
import { Dialog } from "./dialog";

type ShopItem = (typeof SHOP_ITEMS)[number];

const pieceNames = { ...colors, sky: "ฟ้าออโรรา", gold: "ทองประกาย" };

export function ClubShop({ state, error, close, buy, retry }: {
  state?: ShopState;
  error?: string;
  close: () => void;
  buy: (item: ShopItem) => Promise<void>;
  retry: () => void;
}) {
  const [category, setCategory] = useState<ShopItem["kind"]>("character");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  async function purchase(item: ShopItem, label: string) {
    if (pending) return;
    setPending(true);
    setMessage(undefined);
    try {
      await buy(item);
      setMessage({ text: `ปลดล็อก${label}แล้ว เลือกใช้ได้ในล็อบบี้` });
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "ซื้อไม่สำเร็จ กรุณาลองอีกครั้ง" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title="ร้านค้า Morris" className="feature-dialog shop-dialog" close={close}>
      <div className="shop-balance"><Coins aria-hidden="true" /><strong>{state?.coins.toLocaleString("th-TH") ?? "–"}</strong> เหรียญ</div>
      <p className="feature-intro">ชนะผู้เล่นออนไลน์ รับ {WIN_COINS} เหรียญต่อตา ของที่ซื้อจะเลือกใช้ได้ในล็อบบี้</p>
      {error && <p className="feature-error" role="alert">{error} <button type="button" className="outline" onClick={retry}>ลองใหม่</button></p>}
      {!state && !error && <p className="feature-empty" role="status">กำลังเปิดร้านค้า…</p>}
      <div className="shop-tabs" role="group" aria-label="หมวดสินค้า">
        <button type="button" aria-pressed={category === "character"} onClick={() => setCategory("character")}>ตัวละคร</button>
        <button type="button" aria-pressed={category === "color"} onClick={() => setCategory("color")}>หมาก</button>
      </div>
      {message && <p className={message.error ? "feature-error" : "feature-status"} role={message.error ? "alert" : "status"}>{message.text}</p>}
      <ul className="shop-grid">
        {SHOP_ITEMS.filter((item) => item.kind === category).map((item) => {
          const label = item.kind === "character" ? characters[item.id] : pieceNames[item.id];
          const owned = item.kind === "character" ? state?.ownedCharacters.includes(item.id) : state?.ownedColors.includes(item.id);
          const affordable = state !== undefined && state.coins >= item.price;
          return (
            <li className={`shop-card${item.kind === "color" ? ` color-${item.id}` : ""}`} key={item.id}>
              {item.kind === "character"
                ? <div className={`shop-art picker-portrait portrait-${item.id}`} aria-hidden="true" />
                : <div className="shop-art shop-piece-art" aria-hidden="true"><span className="shop-token"><Sparkles /></span></div>}
              <h3>{label}</h3>
              {owned ? <span className="shop-owned"><Check aria-hidden="true" /> มีแล้ว</span>
                : <button className="primary shop-action" type="button" disabled={!affordable || pending}
                    aria-label={`ซื้อ${label} ${item.price} เหรียญ`} onClick={() => void purchase(item, label)}>
                    <Coins aria-hidden="true" /> {item.price} เหรียญ
                  </button>}
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
