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

เปิด [localhost:3000](http://localhost:3000) แล้วสมัครหรือเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน ผู้เล่นคนแรกสร้างห้องเป็นโฮสต์และส่งรหัส 6 ตัวให้เพื่อนกรอกในหน้าเข้าร่วม ทั้งสองฝ่ายเลือกตัวละครและสีหมากในล็อบบี้แล้วกดพร้อม จากนั้นโฮสต์กดเริ่มเกม สถิติชนะและผลล่าสุด 12 เกมแสดงจากปุ่มถ้วยบนแถบด้านบน

เซิร์ฟเวอร์ตรวจสมาชิกห้อง ตาเดิน การจับหมาก และเวอร์ชันก่อนบันทึก Supabase Realtime ส่งข้อมูลให้เฉพาะสมาชิกห้องผ่าน RLS ผลเกมอยู่ในแถวเดียวกับห้องจึงนับชัยชนะได้ครั้งเดียวต่อเกม

## Deploy บน Vercel

เลือก Next.js และ Node.js 24 แล้วใส่ `DATABASE_URL` เป็น Secret และตัวแปร `NEXT_PUBLIC_SUPABASE_*` ทั้งสองค่าใน Environment Variables ก่อน deploy ด้วย `vercel deploy --prod`

## ตรวจงาน

```sh
npm test
npm run lint
npm run build
```
