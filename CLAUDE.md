# ข้อควรจำสำหรับโปรเจกต์นี้

## การ deploy ขึ้น NAS (ห้ามให้คำสั่งผิดอีก)
- โค้ดรันบน NAS UGREEN ที่ `/volume1/docker/sb1/app` (Docker, พอร์ต 8081) — **NAS ไม่มี git**
- Mac mini มี repo ที่ `~/Personalinformation` และเป็นเครื่องเดียวที่ `git pull` ได้
- ขั้นตอนถูกต้อง = รันบน Mac: `cd ~/Personalinformation && ./deploy-to-nas.sh`
  (สคริปต์ทำ git pull → tar ส่งไป NAS → `docker compose up -d --build` → ตรวจ md5)
- `docker compose restart` **ไม่ทำให้โค้ดใหม่ทำงาน** เพราะไฟล์ถูก COPY เข้า image ต้อง `--build` เท่านั้น
- ผู้ใช้ NAS: `Chuey5910@100.86.87.94` (Tailscale) — ห้ามแนะนำ port forwarding
- `scp`/SFTP ถูกจำกัดบน NAS ให้ใช้ `cat file | ssh host "tar -xzf - -C dir"`; sudo ต้องใช้ `ssh -t`

## วิธีคุยกับผู้ใช้
- บอกทีละ 2–3 ขั้น ระบุทุกครั้งว่าขั้นไหนทำบน terminal (บน Mac)
- zsh: ส่งทีละบรรทัด ห้ามใช้ `!` ในคำสั่ง
- ห้ามใส่ชื่อโมเดลใน commit/PR
