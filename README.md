# ระบบคัดกรองเด็กนอนกรน — Supabase

หน้าเว็บหลักคือ **`index.html` ที่โฟลเดอร์ราก** รวม HTML, CSS และ JavaScript ไว้ด้วยกัน เรียก API ผ่าน `/api` บนเซิร์ฟเวอร์ของเว็บไซต์ ซึ่งส่งต่อไปยัง Supabase Edge Function ข้อมูลเก็บใน Supabase PostgreSQL และวิดีโอเก็บใน Supabase Storage

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

เปิด `http://localhost:5173` หรือ `http://127.0.0.1:5173` ห้ามเปิดด้วยการดับเบิลคลิกไฟล์ `index.html` เพราะ API ต้องทำงานผ่านเซิร์ฟเวอร์

เว็บไซต์ผ่าน GitHub Pages: https://thonganek.github.io/snoring-webapp/

เว็บไซต์ผ่าน Sites: https://snoring-child-screening.jarunyoo.chatgpt.site

สำหรับ GitHub Pages ให้รัน `npm run build:pages` แล้วนำเฉพาะ 3 ไฟล์ใน `dist-pages/` ไปไว้ที่รากของ branch `gh-pages` ตั้งค่า Pages ให้เผยแพร่จาก branch นี้ `/` ตัว build จะตั้งให้เรียก Supabase Edge Function โดยตรง และต้องเพิ่ม `https://thonganek.github.io` ใน `APP_ALLOWED_ORIGINS` ของ Supabase ส่วนฐานข้อมูลและวิดีโอยังคงอยู่ใน Supabase พร้อมตรวจสิทธิ์ตามเดิม ห้ามนำไฟล์รหัสผ่านหรือ `.env` ไปใส่ใน branch นี้

สำหรับ Sites ให้รัน `npm run build:site` แล้วเผยแพร่ผลลัพธ์ใน `dist/` พร้อม Worker ที่ `dist/server/index.js` ซึ่งให้บริการ `/api` ด้วย การอัปโหลดเฉพาะไฟล์ HTML ไปยัง static hosting จะไม่เพียงพอ เซิร์ฟเวอร์ส่งต่อเฉพาะ JSON และ public key ไปยัง Supabase โดยไม่ส่ง cookie หรือรหัสอนุญาตของเว็บไซต์

## ทดสอบ

```powershell
npm run verify
```

ชุดทดสอบรัน SQL บน PostgreSQL ผ่าน PGlite และตรวจ Edge handler / workflow โดยจำลอง REST transport และ Storage ยังต้องทดสอบกับ Supabase cloud ของคุณหลังตั้งค่า โดยเฉพาะการอัปโหลดวิดีโอ

ระบบเข้าสู่ระบบใช้บัญชีและ session ของแอปในฐานข้อมูล Supabase ไม่ได้ใช้ Supabase Auth ผู้ปกครองใช้ข้อมูลเด็กตามแบบฟอร์ม ส่วนบัญชีเจ้าหน้าที่หลักกำหนดใน Edge Function secrets
