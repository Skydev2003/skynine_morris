"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { characters, colors } from "@/lib/rooms";
import { frames, SHOP_ITEMS, type ProfileFrame, type ShopState, WIN_COINS } from "@/lib/shop";
import { CoinBalance, CoinIcon } from "./coin";
import { Dialog } from "./dialog";
import { ProfileAvatar } from "./player-profile";

type ShopItem = (typeof SHOP_ITEMS)[number];

const pieceNames = { ...colors, sky: "ฟ้าออโรรา", gold: "ทองประกาย" };

export function ClubShop({ state, error, close, buy, equip, retry }: {
  state?: ShopState;
  error?: string;
  close: () => void;
  buy: (item: ShopItem) => Promise<void>;
  equip: (frame: ProfileFrame | null) => Promise<void>;
  retry: () => void;
}) {
  const [category, setCategory] = useState<ShopItem["kind"]>("character");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  async function perform(action: () => Promise<void>, success: string) {
    if (pending) return;
    setPending(true);
    setMessage(undefined);
    try {
      await action();
      setMessage({ text: success });
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : "ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog title="ร้านค้า Morris" className="feature-dialog shop-dialog" close={close}>
      <CoinBalance coins={state?.coins} />
      <p className="feature-intro">ชนะผู้เล่นออนไลน์ รับ {WIN_COINS} เหรียญต่อตา</p>
      {error && <p className="feature-error" role="alert">{error} <button type="button" className="outline" onClick={retry}>ลองใหม่</button></p>}
      {!state && !error && <p className="feature-empty" role="status">กำลังเปิดร้านค้า…</p>}
      <div className="shop-tabs" role="group" aria-label="หมวดสินค้า">
        <button type="button" aria-pressed={category === "character"} onClick={() => setCategory("character")}>ตัวละคร</button>
        <button type="button" aria-pressed={category === "color"} onClick={() => setCategory("color")}>หมาก</button>
        <button type="button" aria-pressed={category === "frame"} onClick={() => setCategory("frame")}>กรอบโปรไฟล์</button>
      </div>
      {message && <p className={message.error ? "feature-error" : "feature-status"} role={message.error ? "alert" : "status"}>{message.text}</p>}
      <ul className="shop-grid">
        {SHOP_ITEMS.filter((item) => item.kind === category).map((item) => {
          const label = item.kind === "character" ? characters[item.id] : item.kind === "color" ? pieceNames[item.id] : frames[item.id];
          const owned = item.kind === "character" ? state?.ownedCharacters.includes(item.id) : item.kind === "color" ? state?.ownedColors.includes(item.id) : state?.ownedFrames?.includes(item.id);
          const equipped = item.kind === "frame" && state?.equippedFrame === item.id;
          const affordable = state !== undefined && state.coins >= item.price;
          return (
            <li className={`shop-card${item.kind === "color" ? ` color-${item.id}` : ""}`} key={item.id}>
              {item.kind === "character"
                ? <div className={`shop-art picker-portrait portrait-${item.id}`} aria-hidden="true" />
                : item.kind === "frame"
                ? <div className="shop-art shop-frame-art" aria-hidden="true"><ProfileAvatar frame={item.id} /></div>
                : <div className="shop-art shop-piece-art" aria-hidden="true"><span className="shop-token"><Sparkles /></span></div>}
              <h3>{label}</h3>
              {owned && item.kind === "frame" ? (
                <button type="button" className="outline shop-action" disabled={pending}
                  aria-label={equipped ? `ถอดกรอบ${label}` : `สวมกรอบ${label}`}
                  onClick={() => void perform(() => equip(equipped ? null : item.id), equipped ? "ถอดกรอบแล้ว" : `สวมกรอบ${label}แล้ว`)}>
                  {equipped ? "ถอดกรอบ" : "สวมกรอบ"}
                </button>
              ) : owned ? <span className="shop-owned"><Check aria-hidden="true" /> มีแล้ว</span>
                : <button className="primary shop-action" type="button" disabled={!affordable || pending}
                    aria-label={`ซื้อ${label} ${item.price} เหรียญ`} onClick={() => void perform(() => buy(item), item.kind === "frame" ? `ปลดล็อกกรอบ${label}แล้ว` : `ปลดล็อก${label}แล้ว เลือกใช้ได้ในล็อบบี้`)}>
                    <CoinIcon /> {item.price} เหรียญ
                  </button>}
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
