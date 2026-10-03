# SB1 Web App — image สำหรับรันบน NAS (UGREEN DXP4800 Plus / UGOS Pro) หรือเครื่องใดก็ได้ที่มี Docker
# แอปเป็น Node.js ล้วน ไม่มี dependency ภายนอก จึงใช้ base image เล็ก ๆ พอ
FROM node:22-alpine

# ใช้ผู้ใช้ที่ไม่ใช่ root เพื่อความปลอดภัย (node มีอยู่แล้วใน image)
WORKDIR /app

# คัดลอกเฉพาะไฟล์โปรแกรม (data/ ถูกกันไว้ใน .dockerignore — ข้อมูลจริงอยู่ที่ volume)
COPY server.js package.json ./
COPY person_dashboard.html ./
COPY assets ./assets

# โฟลเดอร์ข้อมูล: ผูกกับ volume จากภายนอก (ดู docker-compose.yml)
RUN mkdir -p /data && chown -R node:node /app /data
ENV DATA_DIR=/data
ENV PORT=8081

USER node
EXPOSE 8081

# ตรวจสุขภาพ: ถ้า API ไม่ตอบ Docker จะรีสตาร์ทให้เอง
HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||8081)+'/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
