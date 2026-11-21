"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Mail } from "lucide-react";
import { browserDb } from "@/lib/browser-db";
import { useMorris } from "@/lib/store";
import { Logo } from "./logo";

export function AuthScreen({ configured }: { configured: boolean }) {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = browserDb();
    if (!db || pending) return;
    setFeedback(null);
    setPending(true);
    try {
      const redirect = new URL("/", window.location.origin);
      const code = useMorris.getState().joinCode;
      if (code) redirect.searchParams.set("room", code);
      const credentials = { email: email.trim(), password };
      const result = signup
        ? await db.auth.signUp({ ...credentials, options: { emailRedirectTo: redirect.toString() } })
        : await db.auth.signInWithPassword(credentials);
      if (result.error) {
        const code = result.error.code;
        const text = code === "invalid_credentials" ? "อีเมลหรือรหัสผ่านไม่ถูกต้อง"
          : code === "email_not_confirmed" ? "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ"
          : code === "over_email_send_rate_limit" || code === "over_request_rate_limit" ? "ลองใหม่อีกครั้งในอีกสักครู่"
          : code === "weak_password" ? "กรุณาตั้งรหัสผ่านที่เดายากขึ้น"
          : signup ? "สร้างบัญชีไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่" : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่";
        setFeedback({ error: true, text });
      } else if (result.data.session) {
        useMorris.getState().setSession(result.data.session);
      } else if (signup) {
        setFeedback({ error: false, text: "ตรวจกล่องอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ" });
      }
    } catch {
      setFeedback({ error: true, text: "เชื่อมต่อไม่ได้ กรุณาลองอีกครั้ง" });
    } finally {
      setPending(false);
    }
  }

  function switchMode(next: boolean) {
    setSignup(next);
    setPassword("");
    setVisible(false);
    setFeedback(null);
  }

  return (
    <main className="auth-screen screen">
      <div className="auth-art" role="img" aria-label="นักกีฬาการ์ตูนสองคนในสนามกีฬาพาสเทล" />
      <section className="auth-panel" aria-label="บัญชีผู้เล่น">
        <div className="brand"><Logo /><span>MORRIS<span className="brand-accent"> CLUB</span></span></div>
        <div className="auth-copy"><h1>Nine Men’s<br /><em>Morris</em></h1><p>วางหมาก เรียงสาม แล้วดวลกับเพื่อน</p></div>
        <div className="auth-modes" role="group" aria-label="เลือกการเข้าสู่ระบบ">
          <button type="button" aria-pressed={!signup} disabled={pending} onClick={() => switchMode(false)}>เข้าสู่ระบบ</button>
          <button type="button" aria-pressed={signup} disabled={pending} onClick={() => switchMode(true)}>สร้างบัญชี</button>
        </div>
        <form className="login-form" onSubmit={submit}>
          <label htmlFor="email">อีเมล</label>
          <div className="input-icon"><Mail aria-hidden="true" /><input id="email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <label htmlFor="password">รหัสผ่าน</label>
          <div className="password-field">
            <input id="password" type={visible ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : undefined}
              placeholder={signup ? "อย่างน้อย 8 ตัวอักษร" : "กรอกรหัสผ่าน"} value={password} onChange={(event) => setPassword(event.target.value)} />
            <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}>{visible ? <EyeOff /> : <Eye />}</button>
          </div>
          <button className="primary wide auth-cta" disabled={pending || !configured}>{pending ? "กำลังดำเนินการ…" : signup ? "สร้างบัญชี" : "เข้าสู่สนาม"}<ArrowRight /></button>
        </form>
        {!configured && <p className="feedback" role="status">ยังไม่ได้ตั้งค่า Supabase สำหรับเข้าสู่ระบบ</p>}
        {feedback && <p className={feedback.error ? "feedback" : "success"} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
      </section>
    </main>
  );
}
