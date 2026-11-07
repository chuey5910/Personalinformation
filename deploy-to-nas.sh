#!/bin/bash
# ==========================================================================
# อัปเดตเว็บบน NAS ด้วยคำสั่งเดียว — รันบน Mac:   ./deploy-to-nas.sh
#
# ทำให้อัตโนมัติ: git pull ที่ Mac → ส่งโค้ดไป NAS → docker compose up -d --build
#                → ตรวจว่าเว็บที่ NAS เสิร์ฟเป็นไฟล์เดียวกับใน Mac จริง
# (NAS ไม่มี git จึงต้องดึงโค้ดที่ Mac แล้วส่งไฟล์ไป; จะถามรหัส NAS 2 ครั้ง)
# ==========================================================================
set -e
NAS="${NAS:-Chuey5910@100.86.87.94}"
NAS_DIR="${NAS_DIR:-/volume1/docker/sb1/app}"
URL="http://${NAS#*@}:8081/"
cd "$(dirname "$0")"

echo "== 1/4 ดึงโค้ดล่าสุดที่ Mac =="
git pull
echo "    โค้ด: $(git log --oneline -1)"

echo "== 2/4 ส่งโค้ดไป NAS (ใส่รหัส NAS ครั้งที่ 1) =="
tar --exclude=./data --exclude=./.git --exclude=./secrets --exclude=./backups -czf /tmp/sb1-app.tar.gz .
cat /tmp/sb1-app.tar.gz | ssh "$NAS" "tar -xzf - -C $NAS_DIR"

echo "== 3/4 build ใหม่บน NAS (ใส่รหัส NAS ครั้งที่ 2) =="
ssh -t "$NAS" "cd $NAS_DIR && sudo docker compose up -d --build"

echo "== 4/4 ตรวจว่าเว็บบน NAS เป็นโค้ดใหม่ =="
sleep 4
LOCAL="$(md5 -q person_dashboard.html 2>/dev/null || md5sum person_dashboard.html | cut -d' ' -f1)"
REMOTE="$(curl -s "$URL" | (md5 -q 2>/dev/null || md5sum | cut -d' ' -f1))"
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "✓ สำเร็จ — เว็บบน NAS เป็นโค้ดใหม่แล้ว เปิด $URL แล้วกด Cmd+Shift+R"
else
  echo "✗ เว็บบน NAS ยังไม่ตรงกับโค้ดใหม่ — ส่งภาพหน้าจอนี้ทั้งหมดให้ Claude ดู"
  exit 1
fi
