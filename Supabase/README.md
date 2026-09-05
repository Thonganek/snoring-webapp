# ติดตั้ง Supabase

## 1. สร้างฐานข้อมูลและ Storage

เปิด Supabase Dashboard → SQL Editor แล้วรันตามลำดับ:

1. `migrations/202609050001_initial_schema.sql`
2. `migrations/202609050002_storage.sql`

SQL เปิด RLS และให้ backend ใช้ service role อ่านเขียนตาราง Bucket `screening-videos` เป็น private รองรับ MP4, WebM, MOV สูงสุด 50 MB ไม่มี public policy

ฐานเดิมรัน migration ที่สองเพื่อเพิ่ม `storage_path` ได้ ข้อมูลเก่าไม่ถูกลบ วิดีโอเดิมไม่ได้ถูกย้ายอัตโนมัติ ตาราง `auth_otps` เก็บไว้เพื่อเข้ากันกับฐานเดิม แต่หน้าเว็บปัจจุบันไม่ได้ใช้ OTP

## 2. ตั้งค่า Edge Function secrets

ตั้งที่ Dashboard → Edge Functions → Secrets ตาม `.env.example`:

| ชื่อ | ค่า |
| --- | --- |
| `APP_SUPABASE_SECRET_KEY` | Supabase secret key `sb_secret_...` |
| `APP_SECRET` | ค่าสุ่มอย่างน้อย 32 ตัวอักษร; ถ้าใช้ฐานเดิมให้คงค่าเดิม |
| `ADMIN_USERNAME` | ชื่อบัญชีเจ้าหน้าที่หลัก |
| `ADMIN_PASSWORD` | รหัสผ่านเจ้าหน้าที่หลัก |
| `APP_ALLOWED_ORIGINS` | origin คั่น comma เช่น `http://localhost:5173,https://example.org` ไม่มี slash ปิดท้าย |

`SUPABASE_URL` และ legacy `SUPABASE_SERVICE_ROLE_KEY` มีให้ใน hosted runtime อยู่แล้ว ถ้าไม่ตั้ง `APP_SUPABASE_SECRET_KEY` จะใช้ key ของ runtime แทน Secret key ต้องอยู่เฉพาะ backend ตาม [เอกสาร API keys](https://supabase.com/docs/guides/getting-started/api-keys)

## 3. Deploy API

บน Windows รันจากโฟลเดอร์ราก:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npm run deploy:api
```

CLI อ่าน `Supabase/config.toml` บน Windows หากย้ายไปใช้ระบบไฟล์ที่แยกตัวพิมพ์ใหญ่เล็ก ต้องเปลี่ยนชื่อโฟลเดอร์เป็น `supabase` และแก้ path อ้างอิงก่อนใช้ CLI

Function ชื่อ `snoring-api` ใช้ `verify_jwt = false` เพื่อรับการลงทะเบียนและเข้าสู่ระบบสาธารณะ ส่วน API ข้อมูลตรวจ app session และ role ภายใน ดู [การตั้งค่า Edge Functions](https://supabase.com/docs/guides/functions/function-configuration)

Deploy ผ่าน Dashboard ได้โดยเพิ่ม `index.ts`, `handler.js`, `app.js` จาก `functions/snoring-api/` และปิด Verify JWT ตาม config

## 4. เปิดหน้าเว็บ

ใส่ Project URL และ publishable key ใน `../app-config.js` จากนั้น `npm start` ที่โฟลเดอร์รากและเปิด `http://localhost:5173` ห้ามใส่ secret/service_role key ในหน้าเว็บ

ทดสอบลงทะเบียนเด็ก ทำแบบประเมิน กลับมาเข้าสู่ระบบ และให้เจ้าหน้าที่บันทึกการทบทวน ทดสอบอัปโหลดคลิปและตรวจไฟล์ใน private bucket ด้วยข้อมูลทดสอบก่อนใช้งาน

Browser อัปโหลดเข้า Storage ผ่าน signed upload URL โดยตรง Backend ตรวจว่าไฟล์ครบแล้วจึงบันทึกสถานะ uploaded ลิงก์อ่านมีอายุ 10 นาทีและออกให้หลังตรวจสิทธิ์ ปัจจุบันวิดีโอรอเจ้าหน้าที่ทบทวน ไม่มีบริการ AI ภายนอก
