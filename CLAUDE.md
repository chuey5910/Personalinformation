# ข้อควรจำสำหรับโปรเจกต์นี้

## การ deploy ขึ้น NAS (ห้ามให้คำสั่งผิดอีก)
- โค้ดรันบน NAS UGREEN ที่ `/volume1/docker/sb1/app` (Docker, พอร์ต 8081) — **NAS ไม่มี git**
- เครื่องที่ใช้ deploy: **MacBook M5** (ผู้ใช้ย้ายมาใช้เครื่องนี้แล้ว, clone ไว้ที่ `~/Personalinformation`, ต่อ NAS ผ่าน Tailscale `100.86.87.94` ได้) — Mac mini M4 ก็มี repo ที่ path เดียวกัน
- ขั้นตอนถูกต้อง (ผู้ใช้ยืนยันแล้ว ให้ใช้แบบนี้ทุกครั้ง) = รันบน Mac 2 บรรทัด:
  1. `cd ~/Personalinformation && git pull`
  2. `./deploy-to-nas.sh`  (ถามรหัส NAS 2 ครั้ง / ทำ tar ส่งไป NAS → `docker compose up -d --build` → ตรวจ md5 → ต้องขึ้น ✓ สำเร็จ)
  แล้วเปิดเว็บ http://100.86.87.94:8081 กด Cmd+Shift+R
- Claude เข้าถึง NAS/Mac ไม่ได้ (อยู่ใน Tailscale ของผู้ใช้) — อัปเดต NAS แทนผู้ใช้ไม่ได้ ห้ามพูดว่า "อัปเดต NAS ให้แล้ว"
- ทุกครั้งที่ push โค้ดใหม่ ให้จบข้อความด้วย 2 บรรทัดข้างบนเสมอ
- `docker compose restart` **ไม่ทำให้โค้ดใหม่ทำงาน** เพราะไฟล์ถูก COPY เข้า image ต้อง `--build` เท่านั้น
- ผู้ใช้ NAS: `Chuey5910@100.86.87.94` (Tailscale) — ห้ามแนะนำ port forwarding
- `scp`/SFTP ถูกจำกัดบน NAS ให้ใช้ `cat file | ssh host "tar -xzf - -C dir"`; sudo ต้องใช้ `ssh -t`

## วิธีคุยกับผู้ใช้
- บอกทีละ 2–3 ขั้น ระบุทุกครั้งว่าขั้นไหนทำบน terminal (บน Mac)
- zsh: ส่งทีละบรรทัด ห้ามใช้ `!` ในคำสั่ง
- ห้ามใส่ชื่อโมเดลใน commit/PR
