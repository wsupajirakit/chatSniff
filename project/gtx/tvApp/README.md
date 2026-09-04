# tvApp — ระบบดูทีวีสด

สองส่วน แยกกันชัดเจน

| โฟลเดอร์ | คืออะไร | เทคโนโลยี |
|---|---|---|
| [`backend/`](backend/) | API จัดการช่อง (เพิ่ม/ลบ/แก้ผ่าน Postman) | Hono + Node — ไม่ใช้ Express |
| [`app/`](app/) | แอปดูทีวีบน Android TV / Apple TV | Expo SDK 57 + react-native-tvos + expo-video |

## เริ่มยังไง

**1. เปิด backend**

```bash
cd backend
npm install
cp .env.example .env
npm run genkey          # เอาคีย์ที่ได้ไปใส่ API_KEY ใน .env
npm run dev
```

**2. เพิ่มช่องผ่าน Postman**

Import `backend/postman_collection.json` ตั้ง `baseUrl` กับ `apiKey` แล้วยิงได้เลย

```bash
curl -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" -H "X-API-Key: <คีย์>" \
  -d '{"name":"ช่อง 7HD","url":"https://.../live.m3u8","group":"ฟรีทีวี"}'
```

ไม่ใส่ `logo` ก็ได้ ระบบวาด avatar ตัวอักษรแรกให้เอง

**3. ลงแอปบนทีวี**

```bash
cd app
npm install
cp .env.example .env    # แก้ EXPO_PUBLIC_API_URL ให้ชี้มาที่ backend
npm run android
```

ต้อง build เป็นแอปจริง — Expo Go ใช้ไม่ได้ เพราะ TV ต้องใช้ native fork

## ใช้งานบนรีโมต

| ปุ่ม | ทำอะไร |
|---|---|
| ▲ ▼ | ไล่ช่องในแถบซ้าย หยุดค้างสักครู่ก็เปลี่ยนไปช่องนั้น |
| OK | เล่นทันที แล้วเก็บแถบให้เลย |
| CH+ / CH- | เปลี่ยนช่องตรงๆ ไม่ต้องเรียกแถบ |
| ปุ่มอื่น | เรียกแถบช่องกลับมา |

ไม่กดอะไร 6 วินาที แถบซ่อนเอง เหลือป้ายบอกช่องมุมล่างซ้าย

## ขึ้น Coolify

```bash
cd backend
```

Coolify → New Resource → **Docker Compose** → ชี้มาที่ `backend/docker-compose.yml`
(หรือเลือก **Dockerfile** แล้วชี้ที่ `backend/Dockerfile` ก็ได้)

ต้องตั้งสองอย่างในหน้า Coolify:

1. **Environment Variable** — `API_KEY` = คีย์ที่ `npm run genkey` ให้มา (อย่า commit ลง git)
2. **Persistent Storage** — mount volume ที่ `/data`

`docker-compose.yml` ประกาศ volume `tv-channel-data:/data` ไว้แล้ว ถ้า deploy แบบ Dockerfile ให้เพิ่ม storage mount ที่ `/data` ในหน้า Coolify เอง

ข้อมูลช่องเก็บที่ `/data/channels.json` — อยู่คนละที่กับโค้ด redeploy กี่รอบก็ไม่หาย

พอ deploy เสร็จ แก้ `EXPO_PUBLIC_API_URL` ใน `app/.env` เป็นโดเมนจริง แล้ว build แอปใหม่

## รายละเอียดเพิ่มเติม

- API ทุก endpoint + วิธียิง Postman → [`backend/README.md`](backend/README.md)
- โครงแอป ปุ่มรีโมต และวิธี build → [`app/README.md`](app/README.md)
