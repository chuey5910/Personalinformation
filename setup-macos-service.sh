#!/bin/bash
# ==========================================================================
# ติดตั้ง SB1 Web App ให้รันเป็น service บน macOS (CHUEY-Server)
# → ปิดหน้าต่าง Terminal ได้ / รีสตาร์ทเครื่องแล้วรันเองอัตโนมัติ / ตายแล้วเกิดใหม่เอง
#
# ใช้:   ./setup-macos-service.sh              ติดตั้ง + เริ่มทำงานทันที
#        ./setup-macos-service.sh status       ดูสถานะ
#        ./setup-macos-service.sh restart      รีสตาร์ท service
#        ./setup-macos-service.sh uninstall    หยุดและถอนการติดตั้ง service
#
# เปลี่ยนพอร์ต: PORT=3000 ./setup-macos-service.sh
# ==========================================================================
set -e

LABEL="com.chuey.sb1"
DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PORT="${PORT:-8080}"

case "${1:-install}" in
  status)
    launchctl list | grep "$LABEL" && echo "✓ service กำลังทำงาน" || echo "✗ service ไม่ได้ทำงาน"
    curl -s "http://127.0.0.1:$PORT/api/health" && echo || echo "เรียก API ไม่ได้ — ดู log ที่ $DIR/data/server.err.log"
    exit 0;;
  restart)
    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load "$PLIST"
    echo "✓ รีสตาร์ทแล้ว"; exit 0;;
  uninstall)
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "✓ ถอน service แล้ว (ข้อมูลใน data/ ยังอยู่ครบ ไม่ถูกลบ)"; exit 0;;
esac

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "✗ ยังไม่ได้ติดตั้ง Node.js"
  echo "  ติดตั้งก่อน: เปิดเบราว์เซอร์ไป https://nodejs.org → ดาวน์โหลด LTS (.pkg) → ดับเบิลคลิกติดตั้ง"
  echo "  (หรือถ้ามี Homebrew: brew install node)"
  echo "  เสร็จแล้วปิด-เปิด Terminal ใหม่ แล้วรันสคริปต์นี้อีกครั้ง"
  exit 1
fi

mkdir -p "$HOME/Library/LaunchAgents" "$DIR/data"

cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>$DIR/server.js</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key><dict><key>PORT</key><string>$PORT</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DIR/data/server.out.log</string>
  <key>StandardErrorPath</key><string>$DIR/data/server.err.log</string>
</dict></plist>
PLISTEOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
sleep 1

echo "=============================================="
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '<ไอพีเครื่องนี้>')"
echo "✓ ติดตั้งเสร็จ — SB1 ทำงานอยู่เบื้องหลังแล้ว ปิดหน้าต่าง Terminal ได้เลย"
echo ""
echo "  เปิดที่เครื่องนี้:  http://localhost:$PORT/"
echo "  จากเครื่องอื่น:    http://$IP:$PORT/"
echo "  ดูสถานะ:      ./setup-macos-service.sh status"
echo "  ดู log:        tail -f data/server.err.log"
echo "  ถอนออก:       ./setup-macos-service.sh uninstall"
echo ""
echo "หมายเหตุ: service ทำงานเมื่อผู้ใช้ ($USER) ล็อกอินเครื่องอยู่ —"
echo "Mac mini ที่เป็นเซิร์ฟเวอร์ควรตั้ง System Settings → Users & Groups → เปิด auto-login"
echo "และ Energy Saver → ปิดโหมด sleep เพื่อให้เครื่องอื่นเข้าถึงได้ตลอด"
echo "=============================================="
