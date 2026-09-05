# ระบบคัดกรองเด็กนอนกรน — Supabase

หน้าเว็บหลักคือ **`index.html` ที่โฟลเดอร์ราก** รวม HTML, CSS และ JavaScript ไว้ด้วยกัน เชื่อมต่อ Supabase Edge Function โดยตรง ข้อมูลเก็บใน Supabase PostgreSQL และวิดีโอเก็บใน Supabase Storage

```text
index.html                        หน้าเว็บหลัก
app-config.js                     Project URL และ public key สำหรับหน้าเว็บ
Supabase/
  config.toml                     ตั้งค่า Edge Function
  .env.example                    ตัวอย่าง secrets ฝั่ง backend
  migrations/                     SQL ฐานข้อมูลและ private video bucket
  functions/snoring-api/
    index.ts                      จุดเริ่มต้น Edge Function
    handler.js                    HTTP, CORS และ API ที่อนุญาต
    app.js                        ลงทะเบียน เข้าสู่ระบบ แบบประเมิน และวิดีโอ
  README.md                       คู่มือติดตั้ง
scripts/                          เปิดหน้าเว็บและตรวจไฟล์
tests/                            ทดสอบระบบ Supabase
```

## เริ่มใช้งาน

1. ติดตั้งฐานข้อมูลและ Deploy Edge Function ตาม [คู่มือ Supabase](Supabase/README.md)
2. ใส่ Project URL และ publishable key ใน `app-config.js` ห้ามใส่ secret key
3. เปิดหน้าเว็บด้วย Node.js 22 ขึ้นไป:

```powershell
npm ci
npm start
```

เปิด `http://localhost:5173` หากขึ้น hosting ให้อัปโหลดเฉพาะ `index.html` และ `app-config.js` และเพิ่มโดเมนใน `APP_ALLOWED_ORIGINS` ของ Edge Function

## ทดสอบ

```powershell
npm run verify
```

ชุดทดสอบรัน SQL บน PostgreSQL ผ่าน PGlite และตรวจ Edge handler / workflow โดยจำลอง REST transport และ Storage ยังต้องทดสอบกับ Supabase cloud ของคุณหลังตั้งค่า โดยเฉพาะการอัปโหลดวิดีโอ

ระบบเข้าสู่ระบบใช้บัญชีและ session ของแอปในฐานข้อมูล Supabase ไม่ได้ใช้ Supabase Auth ผู้ปกครองใช้ข้อมูลเด็กตามแบบฟอร์ม ส่วนบัญชีเจ้าหน้าที่หลักกำหนดใน Edge Function secrets
