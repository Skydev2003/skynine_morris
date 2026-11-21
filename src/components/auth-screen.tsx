"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Eye, EyeOff, Mail } from "lucide-react";
import { browserDb, googleInviteKey, googleSignInEnabled } from "@/lib/browser-db";
import { useMorris } from "@/lib/store";
import { GameLottie } from "./game-lottie";
import { GameDetails } from "./game-details";

export function AuthScreen({ configured }: { configured: boolean }) {
  const [emailOpen, setEmailOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState<boolean | null>(null);
  const [googlePending, setGooglePending] = useState(false);
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(() => {
    if (typeof window === "undefined") return null;
    const callbackFailed = [window.location.search, window.location.hash.slice(1)]
      .some((value) => new URLSearchParams(value).has("error"));
    return callbackFailed ? { error: true, text: "เข้าสู่ระบบไม่สำเร็จ ลองอีกครั้งหรือใช้อีเมล" } : null;
  });

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    void googleSignInEnabled(controller.signal).then((enabled) => {
      if (!controller.signal.aborted) setGoogleEnabled(enabled);
    }).catch(() => {});
    return () => controller.abort();
  }, [configured]);

  async function signInWithGoogle() {
    const db = browserDb();
    if (!db || pending || googlePending) return;
    setGooglePending(true);
    setFeedback(null);
    try {
      const { data, error } = await db.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: new URL("/", window.location.origin).toString(), skipBrowserRedirect: true },
      });
      if (error || !data.url) throw error ?? new Error("Missing OAuth URL");
      const code = useMorris.getState().joinCode;
      if (code) sessionStorage.setItem(googleInviteKey, code);
      else sessionStorage.removeItem(googleInviteKey);
      window.location.assign(data.url);
    } catch {
      setFeedback({ error: true, text: "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้งหรือใช้อีเมล" });
      setGooglePending(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = browserDb();
    if (!db || pending || googlePending) return;
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
    <main className="game-world menu-world title-world access-world">
      <div className="world-corner corner-right">
        <button className="hud-button game-details-button" type="button" aria-haspopup="dialog" onClick={() => setDetailsOpen(true)}>
          <BookOpen aria-hidden="true" /> รายละเอียดเกม
        </button>
      </div>
      <section className="title-menu access-menu" aria-labelledby="access-title">
        <h1 id="access-title"><span>Morris</span> <span>Club</span></h1>
        {!emailOpen ? <div className="title-actions access-actions" role="group" aria-label="เมนูหน้าเข้าเกม">
          <button className="title-option title-play" type="button"
            disabled={!configured || googleEnabled === false || googlePending}
            aria-busy={googlePending} onClick={() => void signInWithGoogle()}>
            <span className="google-signin-mark" aria-hidden="true" /> เข้าสู่ระบบด้วย Google
          </button>
          <button className="title-option" type="button"
            disabled={googlePending} onClick={() => { setEmailOpen(true); setFeedback(null); }}>
            <Mail aria-hidden="true" /> เล่นด้วยอีเมล
          </button>
        </div> : <div className="game-ticket access-ticket">
          <div className="ticket-heading">
            <button className="outline ticket-back" type="button" aria-label="กลับไปเลือกวิธีเข้าสู่ระบบ" disabled={pending}
              onClick={() => { setEmailOpen(false); switchMode(false); }}><ArrowLeft aria-hidden="true" /></button>
            <h2>เข้าสู่สนาม</h2>
          </div>
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
            <button className="primary wide auth-cta" disabled={pending || googlePending || !configured}>{pending ? <><GameLottie kind="loading" /> กำลังดำเนินการ</> : <>{signup ? "สร้างบัญชี" : "เข้าสู่สนาม"}<ArrowRight /></>}</button>
          </form>
          {feedback && <p className={feedback.error ? "feedback" : "success"} role={feedback.error ? "alert" : "status"}>{feedback.text}</p>}
        </div>}
        {configured && googleEnabled === false && <p className="access-note" role="status">Google ยังไม่เปิดให้ใช้งาน</p>}
        {googlePending && <p className="access-note" role="status">กำลังเปิด Google</p>}
        {!configured && <p className="title-error" role="status">ยังไม่ได้ตั้งค่าระบบเข้าสู่เกม</p>}
        {!emailOpen && feedback && <p className="title-error" role="alert">{feedback.text}</p>}
      </section>
      {detailsOpen && <GameDetails close={() => setDetailsOpen(false)} />}
    </main>
  );
}
