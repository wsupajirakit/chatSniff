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
export async function fetchChannels(cacheBust = false) {
  const qs = cacheBust ? `?enabled=true&_t=${Date.now()}` : '?enabled=true'
  const data = await request(`/api/channels${qs}`)
  const channels = Array.isArray(data.channels) ? [...data.channels] : []

  // แค่ตอน response server: ให้ช่อง 3 เป็นลำดับที่ 3 (index 2)
  const ch3Idx = channels.findIndex(
    (ch) =>
      ch?.id === '834500c3-7a3e-4d58-a7df-6d0c981fb111' ||
      ch?.id === 'd100002d-bc97-4852-abfa-f80224804a8f' ||
      /^(3\s*hd|ช่อง\s*3|ch\s*3|channel\s*3)($|\s)/i.test(String(ch?.name || '').trim())
  )
  if (ch3Idx !== -1 && channels.length >= 3) {
    const [ch3] = channels.splice(ch3Idx, 1)
    channels.splice(2, 0, ch3)
  }

  return {
    updatedAt: data.updatedAt,
    channels,
  }
}

/** ดึงข้อมูลช่องเดี่ยวแบบสดๆ ใช้เมื่อต้องการ refresh ลิงก์ที่อาจหมดอายุ */
export async function fetchChannel(id, { refresh = false } = {}) {
  if (!id) return null
  const qs = refresh ? `?refresh=true&_t=${Date.now()}` : `?_t=${Date.now()}`
  return await request(`/api/channels/${id}${qs}`)
}

/** บังคับต่ออายุ Token สตรีมของช่องผ่าน Backend ทันที */
export async function refreshChannel(id) {
  if (!id) return null
  try {
    const res = await request(`/api/channels/${id}/refresh`, { method: 'POST' })
    return res?.channel || res
  } catch {
    // ถ้า endpoint refresh ตอบ error ให้ fallback ไปดึงแบบปกติพร้อม flag refresh
    return await fetchChannel(id, { refresh: true })
  }
}

/** ส่ง URL สดที่ resolve สำเร็จไปอัปเดตบน Backend */
export async function syncChannelUrl(id, url) {
  if (!id || !url) return
  try {
    await request(`/api/channels/${id}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {}
}



/**
 * เช็คว่ารายการช่องเปลี่ยนไปหรือยัง — ตัวนี้เบามาก เรียกถี่ได้
 * ใช้แทนการดึงรายการเต็มทุกรอบ
 */
export async function fetchUpdatedAt() {
  const data = await request('/api/health')
  return data.updatedAt
}
