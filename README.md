# SB1 Web App — เก็บข้อมูลบน CHUEY-Server (มีระบบผู้ใช้ + audit log)

ระบบจัดเก็บข้อมูลภาษาไทยของ Special Branch 1 (สบ.1) ครอบคลุม 17 จังหวัดภาคเหนือ
ข้อมูลกลางเก็บบน **CHUEY-Server** (ไม่ใช้ Google Sheets แล้ว) — เจ้าหน้าที่หลายจังหวัดใช้งานร่วมกันผ่านเบราว์เซอร์ โดยต้อง **ลงทะเบียนและได้รับอนุมัติก่อน** จึงจะเข้าใช้ได้

## กติกาสิทธิ์การใช้งาน

| ผู้ใช้ | อ่านข้อมูล | เพิ่มข้อมูลใหม่ | แก้ไข/ลบข้อมูล | อนุมัติผู้ใช้ / ดู audit log |
|---|---|---|---|---|
| ยังไม่ login | ✗ | ✗ | ✗ | ✗ |
| ลงทะเบียนแล้ว รออนุมัติ | ✗ | ✗ | ✗ | ✗ |
| เจ้าหน้าที่ (officer) | ✓ | ✓ | ✗ | ✗ |
| admin | ✓ | ✓ | ✓ | ✓ |

- **ระบบบันทึกการเข้า-ออกทุกครั้ง** (login / logout / login ไม่สำเร็จ / สมัคร / อนุมัติ / บันทึก / ลบ) ลงไฟล์ `data/audit.log` — admin เปิดดูได้ที่แท็บ "จัดการระบบ"
- ทุกรายการข้อมูลใหม่ถูกประทับชื่อผู้บันทึก (`_createdBy`)

## ไฟล์ในโปรเจกต์

- `person_dashboard.html` — ตัว web app ทั้งหมด (มีหน้า login/ลงทะเบียน + แท็บจัดการระบบสำหรับ admin ในตัว)
- `server.js` — backend บน CHUEY-Server (Node.js ล้วน **ไม่ต้อง npm install**): เสิร์ฟหน้าเว็บ + API + ระบบผู้ใช้/session + audit log
- `assets/` — ไลบรารีและฟอนต์ทั้งหมด (Chart.js, SheetJS, Tabler icons, ฟอนต์ Sarabun, ฐานข้อมูลจังหวัด/อำเภอ/ตำบล+รหัสไปรษณีย์ 77 จังหวัด) เสิร์ฟจากเซิร์ฟเวอร์เอง — **ระบบทำงานได้เต็มรูปแบบแม้เครือข่ายภายในไม่มีอินเทอร์เน็ต**
- `setup-macos-service.sh` — สคริปต์ติดตั้งเป็น service บน macOS (รันเบื้องหลัง ปิดหน้าต่าง Terminal ได้)
- `data/` — ข้อมูลจริงทั้งหมด (สร้างอัตโนมัติ, **ถูก .gitignore ไว้ ห้าม commit**)
  - `records.json` ข้อมูลบุคคล/สถานที่/คดี/กิจกรรม
  - `users.json` บัญชีผู้ใช้ (รหัสผ่านถูก hash ด้วย scrypt + salt)
  - `sessions.json` session ที่ login ค้างไว้
  - `audit.log` บันทึกการใช้งาน (JSON ต่อบรรทัด)
  - `backup-YYYYMMDD.json` สำรองข้อมูลอัตโนมัติวันละครั้ง

## วิธีติดตั้งบน CHUEY-Server

ต้องมี Node.js 18 ขึ้นไป (`node -v` เพื่อตรวจ)

```bash
git clone <repo> && cd Personalinformation

# รันครั้งแรก — สร้างบัญชี admin ไปด้วยเลย (สร้างให้เฉพาะตอนที่ยังไม่มีบัญชีชื่อนี้)
ADMIN_USER=admin ADMIN_PASS=ตั้งรหัสผ่านยาวๆ node server.js

# ครั้งถัดไปรันแค่นี้พอ
node server.js            # พอร์ตเริ่มต้น 8080 (เปลี่ยนด้วย PORT=3000)
```

เปิดเบราว์เซอร์ที่ `http://<ไอพีเซิร์ฟเวอร์>:8080/` → จะพบหน้า **เข้าสู่ระบบ** ก่อนเสมอ

### ขั้นตอนสำหรับเจ้าหน้าที่แต่ละจังหวัด
1. เปิดหน้าเว็บ → กด **"ลงทะเบียนเจ้าหน้าที่"** → กรอกชื่อ-สกุล, จังหวัด, ชื่อผู้ใช้, รหัสผ่าน
2. แจ้ง admin ให้เข้าแท็บ **"จัดการระบบ"** → กด **อนุมัติ**
3. เจ้าหน้าที่ login แล้วใช้งานได้: เพิ่มข้อมูล + ดู Dashboard/รายชื่อ/สรุป ได้ทุกจังหวัด (ข้อมูลซิงก์ขึ้นเซิร์ฟเวอร์อัตโนมัติเมื่อบันทึก รวมรูปภาพ)
4. การแก้ไข/ลบข้อมูล ทำได้เฉพาะ admin (ปุ่มลบอยู่ท้ายหน้ารายละเอียดของแต่ละรายการ)

### รันค้างถาวรบน macOS (เช่น Mac mini) — ปิดหน้าต่าง Terminal ได้

ถ้ายังไม่มี Node.js: เปิดเบราว์เซอร์ไป https://nodejs.org → ดาวน์โหลดตัว **LTS (.pkg)** → ดับเบิลคลิกติดตั้ง → ปิด-เปิด Terminal ใหม่ (หรือถ้ามี Homebrew: `brew install node`)

```bash
# รันครั้งแรกเพื่อสร้าง admin ก่อน (กด Ctrl+C หยุดหลังเห็นข้อความ "สร้างบัญชี admin แล้ว")
ADMIN_USER=admin ADMIN_PASS=รหัสผ่านของคุณ node server.js

# ติดตั้งเป็น service — รันเบื้องหลัง ปิดหน้าต่างได้ รีสตาร์ทเครื่องแล้วรันเอง
./setup-macos-service.sh

# คำสั่งอื่น
./setup-macos-service.sh status      # ดูสถานะ
./setup-macos-service.sh restart     # รีสตาร์ท
./setup-macos-service.sh uninstall   # ถอนออก (ข้อมูลไม่ถูกลบ)
```

**เปลี่ยนรหัสผ่าน:** ทุกคนเปลี่ยนของตัวเองได้ในหน้าเว็บ (ปุ่ม "เปลี่ยนรหัสผ่าน" มุมขวาบน) — ถ้า **admin ลืมรหัสผ่าน** ให้รีเซ็ตที่เครื่องเซิร์ฟเวอร์: หยุด service ชั่วคราวแล้วรัน `ADMIN_USER=admin ADMIN_PASS=รหัสใหม่ node server.js` หนึ่งครั้ง (ระบบจะรีเซ็ตรหัสให้และบันทึกเหตุการณ์ลง audit log) แล้วติดตั้ง service กลับ

> Mac mini ที่ใช้เป็นเซิร์ฟเวอร์ควรเปิด auto-login (System Settings → Users & Groups) และปิดโหมด sleep (Energy Saver) เพื่อให้เครื่องอื่นเข้าถึงได้ตลอด

### รันค้างไว้ถาวรบน Linux ด้วย systemd

สร้าง `/etc/systemd/system/sb1.service`:

```ini
[Unit]
Description=SB1 Web App (CHUEY-Server)
After=network.target

[Service]
WorkingDirectory=/path/to/Personalinformation
ExecStart=/usr/bin/node server.js
Environment=PORT=8080
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now sb1
```

## สถาปัตยกรรม

```
[เบราว์เซอร์เจ้าหน้าที่ 17 จังหวัด] -- login (cookie session) --> [server.js บน CHUEY-Server]
        person_dashboard.html            fetch GET/POST                 |-- data/records.json
        (ไม่เก็บข้อมูลใน localStorage)                                  |-- data/users.json
                                                                        |-- data/audit.log
```

- เปิดหน้าเว็บผ่านเซิร์ฟเวอร์เท่านั้น (same-origin) — ไม่ต้องตั้งค่า URL ใด ๆ ในหน้าเว็บ
- บันทึกข้อมูลแล้ว **ซิงก์ขึ้นเซิร์ฟเวอร์อัตโนมัติ** (รวมรูปภาพ) และดึงข้อมูลล่าสุดอัตโนมัติตอนเปิดหน้า/เปิด Dashboard/ค้นหา
- session หมดอายุเมื่อไม่ใช้งาน 12 ชั่วโมง (ปรับด้วย `SESSION_HOURS=…`)

## API (server.js)

| Method | Path | สิทธิ์ | ทำอะไร |
|---|---|---|---|
| GET | `/api/health` | สาธารณะ | ตรวจสถานะ |
| POST | `/api/register` | สาธารณะ | สมัครบัญชี (สถานะ "รออนุมัติ") |
| POST | `/api/login` | สาธารณะ | เข้าสู่ระบบ → ได้ cookie session |
| POST | `/api/logout` | login แล้ว | ออกจากระบบ |
| GET | `/api/me` | login แล้ว | ข้อมูลผู้ใช้ปัจจุบัน |
| POST | `/api/password` | login แล้ว | `{oldPassword,newPassword}` เปลี่ยนรหัสผ่านตัวเอง |
| GET | `/api/records` | login แล้ว | อ่านข้อมูลทั้งหมด |
| POST | `/api/records` | login แล้ว | `{records:[...]}` — officer: เพิ่มใหม่เท่านั้น (แก้ของเดิมถูกข้าม) / admin: เพิ่ม+แก้ |
| POST | `/api/records/delete` | **admin** | `{ids:[...]}` หรือ `{all:true}` |
| GET | `/api/users` | **admin** | รายชื่อผู้ใช้ |
| POST | `/api/users/approve` | **admin** | `{id, role:'officer'|'admin'}` อนุมัติ |
| POST | `/api/users/reject` | **admin** | `{id}` ลบ/ปฏิเสธบัญชี |
| GET | `/api/audit?limit=300` | **admin** | บันทึกการใช้งานล่าสุด |

## การสำรองข้อมูล

- เซิร์ฟเวอร์สำรอง `records.json` อัตโนมัติวันละครั้งเป็น `data/backup-YYYYMMDD.json`
- ควรตั้ง cron สำรองทั้งโฟลเดอร์ `data/` ออกไปเก็บที่อื่น เช่น `rsync -a data/ /backup/sb1/`
- ปุ่ม Export CSV/XLSX ในหน้าเว็บใช้ได้ตามเดิม (เฉพาะผู้ที่ login แล้ว)

## ข้อควรระวัง / ความปลอดภัย

- ข้อมูลอ่อนไหวสูง (เลขบัตร ปชช., ที่อยู่, ข้อมูลครอบครัว/การเมือง/จิตเวช/คดี, รูปภาพ) — ต้องทำตาม PDPA และจำกัดผู้มีสิทธิ์เข้าถึงตามความจำเป็น
- จำกัดเซิร์ฟเวอร์ให้เข้าถึงได้เฉพาะเครือข่ายภายใน (firewall/VPN) — **อย่าเปิดพอร์ตสู่อินเทอร์เน็ตโดยไม่มี HTTPS**; ถ้าจำเป็นให้ตั้ง reverse proxy (nginx + certbot) ครอบ
- ตั้งรหัสผ่าน admin ให้ยาวและเดายาก; บัญชีที่ไม่ใช้แล้วให้ admin ลบออก
- `data/` ถูก .gitignore ไว้แล้ว — ห้าม commit ไฟล์ข้อมูลจริง/ไฟล์ผู้ใช้ขึ้น git
- แนวทางพัฒนาต่อ: เข้ารหัสไฟล์ข้อมูลที่พัก (at-rest), 2FA, แยกสิทธิ์อ่านตามจังหวัด, หน้ารายงาน audit แบบกรอง/ค้นหา
