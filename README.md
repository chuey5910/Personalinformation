# SB1 Web App — เก็บข้อมูลบน CHUEY-Server

ระบบจัดเก็บข้อมูลภาษาไทยของ Special Branch 1 (สบ.1) ครอบคลุม 17 จังหวัดภาคเหนือ
**เวอร์ชันนี้ย้ายที่เก็บข้อมูลกลางจาก Google Sheets มาอยู่บน CHUEY-Server แล้ว** — ไม่มีการส่ง/ดึงข้อมูลจาก Google Sheets อีกต่อไป

## ไฟล์ในโปรเจกต์

- `person_dashboard.html` — ตัว web app ทั้งหมด (HTML + CSS + JS ในไฟล์เดียว)
- `server.js` — backend บน CHUEY-Server (Node.js ล้วน **ไม่ต้อง npm install**) ทำหน้าที่ 2 อย่าง: เสิร์ฟหน้าเว็บ + เก็บข้อมูลกลาง
- `import_from_sheets.js` — สคริปต์ย้ายข้อมูลเก่าจาก Google Sheets เข้าเซิร์ฟเวอร์ (ใช้ครั้งเดียว)
- `data/records.json` — ไฟล์ข้อมูลจริง (สร้างอัตโนมัติเมื่อบันทึกครั้งแรก, **ถูก .gitignore ไว้ ห้าม commit**)

## วิธีติดตั้งบน CHUEY-Server

ต้องมี Node.js 18 ขึ้นไป (`node -v` เพื่อตรวจ)

```bash
git clone <repo> && cd Personalinformation
node server.js                 # เปิดที่พอร์ต 8080
# หรือกำหนดเอง:
PORT=3000 node server.js
API_TOKEN=รหัสลับ node server.js   # เปิดการยืนยันตัวตนด้วย token (แนะนำ)
```

จากนั้นเปิดเบราว์เซอร์ที่ `http://<ไอพีเซิร์ฟเวอร์>:8080/` — หน้าเว็บและข้อมูลมาจากเซิร์ฟเวอร์เดียวกัน ไม่ต้องตั้งค่าอะไรเพิ่ม

### รันค้างไว้ถาวรด้วย systemd (แนะนำ)

สร้าง `/etc/systemd/system/sb1.service`:

```ini
[Unit]
Description=SB1 Web App (CHUEY-Server)
After=network.target

[Service]
WorkingDirectory=/path/to/Personalinformation
ExecStart=/usr/bin/node server.js
Environment=PORT=8080
# Environment=API_TOKEN=รหัสลับ
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sb1
```

## สถาปัตยกรรมใหม่

```
[person_dashboard.html] --- fetch GET/POST ---> [server.js บน CHUEY-Server] ---> [data/records.json]
      (front-end)                                    (API + static)                (แหล่งข้อมูลกลาง)
   localStorage (สำเนา/แคชในเครื่อง)
```

- เปิดหน้าเว็บผ่านเซิร์ฟเวอร์ → front-end เรียก API แบบ same-origin อัตโนมัติ (ไม่ต้องกรอก URL)
- เปิดไฟล์ HTML ตรง ๆ (file://) ก็ยังได้ → กรอก Server URL ที่กล่อง "ตั้งค่าเซิร์ฟเวอร์ (CHUEY-Server)" ในแท็บรายชื่อ
- **รูปภาพถูก sync ขึ้นเซิร์ฟเวอร์ด้วยแล้ว** (ต่างจากเวอร์ชัน Google Sheets ที่ตัดรูปทิ้งเพราะลิมิตขนาดเซลล์)
- ดึงข้อมูลจากเซิร์ฟเวอร์อัตโนมัติ: ตอนเปิดหน้า, เปิดแท็บ Dashboard, และตอนค้นหาในแท็บรายชื่อ
- ลบรายการในหน้าเว็บ = ลบทั้งในเครื่องและบนเซิร์ฟเวอร์

## API (server.js)

| Method | Path | ทำอะไร |
|---|---|---|
| GET | `/api/health` | ตรวจสถานะ → `{ok:true, count}` |
| GET | `/api/records` | อ่านทั้งหมด → `{ok:true, records:[...]}` |
| POST | `/api/records` | body `{records:[...]}` — upsert ตาม `_id` → `{ok, added, updated, total}` |
| POST | `/api/records/delete` | body `{ids:[...]}` หรือ `{all:true}` → `{ok, deleted, total}` |

ถ้าตั้ง `API_TOKEN` ไว้ ทุก request ต้องแนบ header `x-api-token: <token>` (หรือ `?token=` ใน query) — ฝั่งหน้าเว็บมีช่องกรอก token ในกล่องตั้งค่า

## การเก็บข้อมูล / สำรองข้อมูล

- ข้อมูลทั้งหมดอยู่ในไฟล์เดียว: `data/records.json` (เขียนแบบ atomic กันไฟล์เสียหาย)
- เซิร์ฟเวอร์สำรองไฟล์อัตโนมัติวันละ 1 ครั้งเป็น `data/backup-YYYYMMDD.json` ก่อนเขียนทับครั้งแรกของวัน
- ควรตั้ง cron สำรอง `data/` ออกไปเก็บที่อื่นเพิ่ม เช่น `rsync -a data/ /backup/sb1/`
- ปุ่ม Export CSV/XLSX ในหน้าเว็บยังใช้ได้ตามเดิม

## ย้ายข้อมูลเก่าจาก Google Sheets (ทำครั้งเดียว)

มี 2 ทางเลือก:

**ทาง 1 — จากเครื่องที่เคยใช้งาน (ง่ายสุด):** ข้อมูลเต็ม (รวมรูป) อยู่ใน localStorage ของเบราว์เซอร์อยู่แล้ว
เปิดหน้าเว็บเวอร์ชันใหม่บนเครื่องนั้น → แท็บรายชื่อ → กด **"ส่งขึ้น CHUEY-Server"** จบ

**ทาง 2 — ดึงจาก Google Sheets โดยตรง** (ถ้า Apps Script เดิมยังเปิดใช้อยู่):

```bash
node server.js &   # รันเซิร์ฟเวอร์ปลายทางไว้ก่อน
node import_from_sheets.js "https://script.google.com/macros/s/xxxx/exec" "http://127.0.0.1:8080"
```

> หมายเหตุ: ข้อมูลจาก Sheets ไม่มีรูปภาพ (เวอร์ชันเก่าตัดรูปก่อนส่ง) — รูปจะถูกเติมกลับเมื่อเครื่องที่มีรูปใน localStorage กดส่งขึ้นเซิร์ฟเวอร์ (ระบบ merge จะคงรูปในเครื่องไว้)
> เมื่อย้ายเสร็จแล้ว ควรปิด deployment ของ Apps Script เดิม (Deploy → Manage deployments → Archive) และจำกัดสิทธิ์ชีตเดิม

## โครงสร้างข้อมูล (record object)

ทุก record มี field ระบบ:
- `_id` — string ไม่ซ้ำ (สร้างด้วย `uid()`) ใช้ dedup + sync
- `rtype` — ประเภท: `'watch' | 'vip' | 'place' | 'case' | 'activity'` (ค่า default = `'watch'`)
- `pv` — จังหวัด (1 ใน 17)

### 5 ประเภทข้อมูล
1. **watch (บุคคลเฝ้าระวัง)** — 15 กลุ่มเฝ้าระวัง (`grp`, `sub`), ข้อมูลส่วนตัว, ที่อยู่ 3 ชุด, สื่อออนไลน์, บุคคลเกี่ยวข้อง, รูปภาพ (`photo`), ยานพาหนะ (`cars[]`, `motos[]`), กล่องเงื่อนไขตามกลุ่ม
2. **vip (บุคคลสำคัญ/น่าสนใจ)** — ข้อมูลส่วนตัว + `cats[]`, ที่อยู่ 3 ชุด, การศึกษา, บุคคลเกี่ยวข้อง, ประวัติคดีอาญา, รูปภาพ, ยานพาหนะ
3. **place (สถานที่สำคัญ)** — ชื่อ/ที่อยู่สถานที่, ผู้ดูแล, หน่วยงาน รปภ. + หน., งานประจำปี
4. **case (คดีสำคัญ)** — เรื่อง, สถานที่/วัน/เวลาเกิดเหตุ, `suspects[]`/`deceased[]`, `vehicles[]`, `evidence[]`, อาวุธ, ผลคดี, พฤติการณ์, พนักงานสอบสวน
5. **activity (กิจกรรมสำคัญ)** — ชื่อ/วันที่/สถานที่/ผู้ร่วมงาน/รายละเอียด

## ฟังก์ชัน JS สำคัญ (ไว้ค้นในไฟล์)

- state/persist: `loadState()`, `persist()`, `uid()`, `recs[]`, `LS_KEY`, `LS_URL`, `LS_TOKEN`
- sync กับ CHUEY-Server: `apiBase()`, `apiHeaders()`, `syncServer()` (POST), `pullFromServer()` (GET), `mergeSheetRecords()` (รวมด้วย `_id`, คงรูปในเครื่อง), `serverDelete()`
- routing: `selProv()`, `chooseRtype()`, `sw()` (สลับแท็บ)
- save/clear: `saveR/clrF` (watch), `saveVIP`, `savePlace`, `saveCase`, `saveActivity`
- list/detail/export: `rList()`, `showDtl()`, `flatRec()`, `allFlat()`, `exportCSV/exportXLSX`
- dashboard: `updDash()`, `renderDashList()`, `renderUpcoming()`

## ข้อควรระวัง / ความปลอดภัย

- ข้อมูลอ่อนไหวสูง (เลขบัตร ปชช., ที่อยู่, ข้อมูลครอบครัว/การเมือง/จิตเวช/คดี, รูปภาพ) — ต้องทำตาม PDPA
- **แนะนำให้เปิด `API_TOKEN` เสมอ** ถ้าเซิร์ฟเวอร์เข้าถึงได้จากเครือข่ายที่มีคนอื่นใช้ร่วม
- จำกัดการเข้าถึงเซิร์ฟเวอร์ให้อยู่ในเครือข่ายภายใน (firewall/VPN) — อย่าเปิดพอร์ตสู่อินเทอร์เน็ตโดยไม่มี HTTPS + auth
- `data/` ถูก .gitignore ไว้แล้ว — ห้าม commit ไฟล์ข้อมูลจริงขึ้น git
- แนวทางพัฒนาต่อ: ระบบ login/บทบาทผู้ใช้, HTTPS (reverse proxy ผ่าน nginx + certbot), audit log, เข้ารหัสไฟล์ข้อมูล
