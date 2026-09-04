/**
 * คุยกับ backend
 *
 * ตั้ง URL ผ่าน env EXPO_PUBLIC_API_URL (ดูไฟล์ .env.example)
 * - Android TV emulator : http://10.0.2.2:3000
 * - กล่อง/ทีวีจริงในบ้าน : http://<ไอพีเครื่องคุณ>:3000
 */

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000').replace(
  /\/+$/,
  '',
)

const TIMEOUT_MS = 10000

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, signal: controller.signal })
    if (!response.ok) {
      throw new Error(`เซิร์ฟเวอร์ตอบ ${response.status}`)
    }
    return await response.json()
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (หมดเวลารอ)')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** ดึงเฉพาะช่องที่เปิดใช้งาน เรียงตาม order ที่ตั้งไว้หลังบ้าน */
export async function fetchChannels() {
  const data = await request('/api/channels?enabled=true')
  return {
    updatedAt: data.updatedAt,
    channels: Array.isArray(data.channels) ? data.channels : [],
  }
}

/** ดึงข้อมูลช่องเดี่ยวแบบสดๆ ใช้เมื่อต้องการ refresh ลิงก์ที่อาจหมดอายุ */
export async function fetchChannel(id) {
  if (!id) return null
  return await request(`/api/channels/${id}`)
}

/**
 * เช็คว่ารายการช่องเปลี่ยนไปหรือยัง — ตัวนี้เบามาก เรียกถี่ได้
 * ใช้แทนการดึงรายการเต็มทุกรอบ
 */
export async function fetchUpdatedAt() {
  const data = await request('/api/health')
  return data.updatedAt
}
