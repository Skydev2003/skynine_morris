"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles } from "lucide-react";
import { COIN_PACKS, type TopUpState } from "@/lib/top-up";
import { CoinBalance, CoinIcon } from "./coin";

async function requestTopUp<T>(token: string, body: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch("/api/top-up", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data;
}

const orderLabels = { pending: "รอตรวจยอด", approved: "เติมเหรียญแล้ว", rejected: "ไม่ผ่านการตรวจสอบ" };

export function CoinTopUpPreview({ coins, token, back, refreshWallet }: {
  coins?: number; token: string; back: () => void; refreshWallet: () => void;
}) {
  const [selected, setSelected] = useState<number>(250);
  const [review, setReview] = useState(false);
  const pack = COIN_PACKS.find((option) => option.coins === selected) ?? COIN_PACKS[1];
  const [state, setState] = useState<TopUpState>();
  const [notice, setNotice] = useState<{ text: string; error?: boolean }>();
  const [pending, setPending] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [showReview, setShowReview] = useState(false);

  async function reload() {
    setState(await requestTopUp<TopUpState>(token, { op: "state" }));
  }

  useEffect(() => {
    const controller = new AbortController();
    void requestTopUp<TopUpState>(token, { op: "state" }, controller.signal).then((next) => {
      if (!controller.signal.aborted) setState(next);
    }).catch(() => {});
    return () => controller.abort();
  }, [token]);

  async function perform(body: object, success: string) {
    if (pending) return;
    setPending(true);
    setNotice(undefined);
    try {
      await requestTopUp(token, body);
      setNotice({ text: success });
      void reload().catch(() => {});
      refreshWallet();
      if ("op" in body && body.op === "submit") setReview(false);
    } catch (failure) {
      setNotice({ text: failure instanceof Error ? failure.message : "ทำรายการไม่สำเร็จ", error: true });
    } finally {
      setPending(false);
    }
  }

  function report(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void perform({ op: "submit", id: requestId, coins: pack.coins, transferRef: fields.get("transferRef"),
      payerName: fields.get("payerName") }, "ส่งแจ้งโอนแล้ว ตรวจสถานะได้ด้านล่าง");
  }

  function approve(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    void perform({ op: "approve", id, confirmedRef: fields.get("confirmedRef"), confirmedBaht: Number(fields.get("confirmedBaht")),
      confirmedPayer: fields.get("confirmedPayer") }, "ยืนยันและเติมเหรียญแล้ว");
  }


  return (
    <section className="top-up-preview" aria-labelledby="top-up-title">
      <div className="top-up-toolbar">
        <button type="button" className="outline" onClick={review ? () => setReview(false) : back}>
          <ArrowLeft aria-hidden="true" /> {review ? "กลับไปเลือกแพ็ก" : "กลับร้านค้า"}
        </button>
        <CoinBalance coins={coins} />
        {state?.canReview && <button type="button" className="outline" aria-pressed={showReview} onClick={() => {
          setShowReview(!showReview);
          void reload().catch(() => {});
        }}>ตรวจรายการโอน</button>}
      </div>
      {notice && <p className={notice.error ? "feature-error" : "feature-status"} role={notice.error ? "alert" : "status"}>{notice.text}</p>}
      {showReview && state?.canReview && (
        <div className="top-up-summary">
          <h3>รายการรอตรวจยอดธนาคาร</h3>
          {!state.pending.length && <p>ไม่มีรายการรอตรวจ</p>}
          {state.pending.map((order) => (
            <form className="top-up-report" key={order.id} onSubmit={(event) => approve(event, order.id)}>
              <h4>{order.player_id || "ผู้เล่น"} · {order.baht} บาท · {order.coins} เหรียญ</h4>
              <p>{order.payer_name} · {order.transfer_ref} · {new Date(order.submitted_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
              <label>เลขอ้างอิงจากธนาคาร<input name="confirmedRef" required maxLength={64} /></label>
              <label>ยอดเงินเข้าจริง (บาท)<input name="confirmedBaht" type="number" required min="1" step="1" /></label>
              <label>ชื่อผู้โอนจากธนาคาร<input name="confirmedPayer" required maxLength={100} /></label>
              <button type="submit" className="primary" disabled={pending}>ยืนยันเงินเข้าและเติมเหรียญ</button>
              <button type="button" className="outline" disabled={pending} onClick={() => void perform({ op: "reject", id: order.id }, "ปฏิเสธรายการแล้ว")}>ปฏิเสธรายการ</button>
            </form>
          ))}
        </div>
      )}
      <div className="top-up-hero">
        <div>
          <h3 id="top-up-title">{review ? "สรุปแพ็กเหรียญ" : "เติมเหรียญ Morris"}</h3>
          <p>{review ? pack.example : "เลือกเหรียญไว้แต่งหมากและกรอบโปรไฟล์ก่อนลงสนาม"}</p>
        </div>
        <span className="top-up-emblem"><CoinIcon /><Sparkles aria-hidden="true" /></span>
      </div>
      {review ? (
        <div className="top-up-summary" aria-live="polite">
          <h4>{pack.name}</h4>
          <dl>
            <div><dt>เหรียญที่จะได้รับ</dt><dd><CoinIcon /> {pack.coins} เหรียญ</dd></div>
            <div><dt>ยอดชำระ</dt><dd>{pack.baht} บาท</dd></div>
          </dl>
          {state?.payment ? (
            <form className="top-up-report" onSubmit={report}>
              <p>สแกน PromptPay แล้วตรวจชื่อผู้รับ <strong>{state.payment.recipient}</strong> และยอด <strong>{pack.baht} บาท</strong> ก่อนโอน</p>
              {/* eslint-disable-next-line @next/next/no-img-element -- Render the exact bank-issued QR without optimization. */}
              <img className="top-up-qr" src={state.payment.qrPath} alt="QR พร้อมเพย์สำหรับโอนเงิน" />
              <p>เหรียญจะเข้าเมื่อผู้ดูแลตรวจยอดเงินเข้าจริงแล้ว</p>
              <label>ชื่อผู้โอนตามรายการธนาคาร<input name="payerName" required minLength={2} maxLength={100} /></label>
              <label>เลขอ้างอิงจากรายการโอน<input name="transferRef" required pattern={"[A-Za-z0-9\\-]{6,64}"} maxLength={64} autoComplete="off" /></label>
              <button className="primary" type="submit" disabled={pending}>ส่งแจ้งโอน</button>
            </form>
          ) : <p>ตัวอย่างขั้นตอน PromptPay · ยังไม่เปิดรับชำระเงินจริง</p>}
        </div>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); setRequestId(crypto.randomUUID()); setReview(true); }}>
          <fieldset className="top-up-packs" aria-label="แพ็กเหรียญ">
            {COIN_PACKS.map((option) => (
              <label className="top-up-pack" key={option.coins}>
                <input type="radio" name="coin-pack" value={option.coins} checked={selected === option.coins}
                  onChange={() => setSelected(option.coins)} />
                <Check className="top-up-check" aria-hidden="true" />
                <span className="top-up-pack-name">{option.name}</span>
                <strong><CoinIcon /> {option.coins} เหรียญ</strong>
                <span className="top-up-example">{option.example}</span>
                <span className="top-up-price">{option.baht} บาท</span>
              </label>
            ))}
          </fieldset>
          <div className="top-up-footer">
            <p>{state?.payment ? "จ่ายผ่าน PromptPay · รับเหรียญหลังตรวจยอด" : "หน้าพรีวิว · ยังไม่เปิดรับชำระเงินจริง"}</p>
            <button type="submit" className="club-quick-play">ดูสรุปแพ็ก <ArrowRight aria-hidden="true" /></button>
          </div>
        </form>
      )}
      {state && state.orders.length > 0 && (
        <div className="top-up-summary top-up-orders">
          <div className="top-up-toolbar">
            <h4>รายการเติมเหรียญของฉัน</h4>
            <button type="button" className="outline" onClick={() => { void reload().catch(() => {}); refreshWallet(); }}>อัปเดตสถานะ</button>
          </div>
          <ul>{state.orders.map(order => (
            <li key={order.id}><strong>{order.coins} เหรียญ · {order.baht} บาท</strong> {orderLabels[order.status]}</li>
          ))}</ul>
        </div>
      )}
    </section>
  );
}
