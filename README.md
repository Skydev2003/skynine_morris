# Morris Club

เว็บเกม Nine Men’s Morris ภาษาไทยสำหรับสองคน ใช้ Next.js, Zustand และ Supabase

## ตั้งค่าในเครื่อง

ใช้ Node.js 24 คัดลอก `.env.example` เป็น `.env` แล้วกำหนดค่าจากโปรเจกต์ Supabase

| ตัวแปร | การใช้งาน |
| --- | --- |
| `DATABASE_URL` | PostgreSQL pooler สำหรับเซิร์ฟเวอร์ Next.js |
| `DIRECT_URL` | การเชื่อมต่อสำหรับรัน migration |
| `NEXT_PUBLIC_SUPABASE_URL` | URL ของ Supabase สำหรับ Auth และ Realtime |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key สำหรับเบราว์เซอร์ |
| `CRON_SECRET` | สำรองสำหรับงานตามเวลา |

รันไฟล์ใน [supabase/migrations](supabase/migrations) ผ่าน SQL Editor หรือใช้ `DIRECT_URL` กับเครื่องมือ migration ที่รองรับ จากนั้นเปิด Email Provider ใน Supabase Auth หากเปิดการยืนยันอีเมล ให้ตั้ง Site URL, Redirect URLs และ [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp) สำหรับส่งอีเมลให้ผู้เล่นทั่วไป

```sh
npm ci
npm run dev
```

เปิด [localhost:3000](http://localhost:3000) แล้วสมัครหรือเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน ผู้เล่นคนแรกสร้างห้องเป็นโฮสต์และส่งรหัส 6 ตัวให้เพื่อนกรอกในหน้าเข้าร่วม ทั้งสองฝ่ายเลือกตัวละครและสีหมากในล็อบบี้ ผู้เข้าร่วมกดพร้อม จากนั้นโฮสต์กดเริ่มเกม สถิติชนะและผลล่าสุด 12 เกมแสดงจากปุ่มถ้วยบนแถบด้านบน

เซิร์ฟเวอร์ตรวจสมาชิกห้อง ตาเดิน การจับหมาก และเวอร์ชันก่อนบันทึก Supabase Realtime ส่งข้อมูลให้เฉพาะสมาชิกห้องผ่าน RLS ผลแต่ละรอบถูกเก็บแยกจากสถานะห้องเพื่อเก็บสถิติครบเมื่อรีแมตช์ในห้องเดิม

## Deploy บน Vercel

เลือก Next.js และ Node.js 24 แล้วใส่ `DATABASE_URL` เป็น Secret และตัวแปร `NEXT_PUBLIC_SUPABASE_*` ทั้งสองค่าใน Environment Variables ก่อน deploy ด้วย `vercel deploy --prod`

## เปิด Google Login

1. สร้าง OAuth Client ประเภท **Web application** ใน Google Cloud เพิ่ม origin ของเกม และใส่ callback URL ที่หน้า Google provider ของ Supabase แสดงไว้ใน **Authorized redirect URIs**
2. เปิด Google provider ใน Supabase Auth แล้วบันทึก Client ID และ Client Secret ในหน้าเดียวกัน
3. ตั้ง Site URL ของ Supabase เป็น URL หน้าแรกของเกม และเพิ่ม URL หน้าแรกของสภาพแวดล้อมอื่นที่ต้องการใช้ใน Redirect URLs เช่น `http://localhost:3000/` เกมใช้ URL นี้หลังเข้าสู่ระบบและแสดงรูป Google ในหน้าโปรไฟล์

[คู่มือ Google Sign-In ของ Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) · [การตั้งค่า Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

## ตรวจงาน

```sh
npm test
npm run lint
npm run build
```

แต่ละตาใช้เวลา 60 วินาทีรวมช่วงจับหมาก ถ้าหมดเวลาอีกฝ่ายชนะ

โหมดสุ่มค้นหาผู้เล่นที่กำลังค้นหาเหมือนกันเป็นเวลา 3 วินาที เกมกับคู่แข่งอัตโนมัติเล่นในเครื่อง และอันดับโลกนับเฉพาะชัยชนะในการแข่งขันระหว่างผู้เล่นจริง
