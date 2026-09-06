/**
 * sync_ch3.js — สคริปต์ตรวจสอบและอัปเดตสตรีมช่อง 3 ขึ้น Backend อัตโนมัติ
 * 
 * รันบนเครื่อง Mac / Home Network ในไทย ซึ่งเข้าถึง ch3plus.com ได้ 100%
 * สามารถรันเดี่ยวๆ หรือตั้ง Cron Job / PM2 / Launchd ให้ทำงานทุก 2 ชั่วโมงได้
 */

const API_BASE = process.env.API_URL || 'https://tv-z.duckdns.org'

async function syncCh3() {
  console.log(`[${new Date().toISOString()}] เริ่มตรวจสอบสตรีมช่อง 3 HD...`)

  // 1. ดึงข้อมูลช่อง 3 จาก Backend ปัจจุบัน
  const channelsRes = await fetch(`${API_BASE}/api/channels?_t=${Date.now()}`)
  if (!channelsRes.ok) {
    console.error(`[sync] ไม่สามารถเชื่อมต่อ Backend ได้ (${channelsRes.status})`)
    return
  }
  const channelsData = await channelsRes.json()
  const ch3 = (channelsData.channels || []).find(
    (c) =>
      c.id === '834500c3-7a3e-4d58-a7df-6d0c981fb111' ||
      c.id === 'd100002d-bc97-4852-abfa-f80224804a8f' ||
      /^(3\s*hd|ช่อง\s*3|ch\s*3|channel\s*3)($|\s)/i.test(String(c.name || '').trim())
  )
  if (!ch3) {
    console.error('[sync] ไม่พบช่อง 3 บน Backend')
    return
  }

  // 2. ดึงสตรีมสดล่าสุดจาก ch3plus.com
  console.log('[sync] กำลังดึงสตรีมสดล่าสุดจาก ch3plus.com...')
  const pageRes = await fetch('https://ch3plus.com/live', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  if (!pageRes.ok) {
    console.error(`[sync] ch3plus.com ตอบกลับ HTTP ${pageRes.status}`)
    return
  }

  const html = await pageRes.text()
  const tag = '<script id="__NEXT_DATA__"'
  const idx = html.indexOf(tag)
  if (idx === -1) {
    console.error('[sync] ไม่พบข้อมูล __NEXT_DATA__ บน ch3plus.com')
    return
  }

  const start = html.indexOf('>', idx) + 1
  const end = html.indexOf('</script>', start)
  const json = JSON.parse(html.slice(start, end))
  const live = json?.props?.initialState?.liveReducer?.live
  const freshUrl = live?.streamUrlWebSVOD || live?.streamUrlApp || live?.streamUrl

  if (!freshUrl || !freshUrl.includes('m3u8')) {
    console.error('[sync] ไม่พบ URL สตรีม m3u8 ที่ถูกต้อง')
    return
  }

  const expMatch = freshUrl.match(/x_ark_expires=(\d+)/)
  const expiresAt = expMatch ? new Date(parseInt(expMatch[1], 10) * 1000).toLocaleString('th-TH') : 'ไม่ระบุ'
  console.log(`[sync] ได้รับ Fresh URL (หมดอายุ: ${expiresAt})`)

  if (freshUrl === ch3.url) {
    console.log('[sync] URL บนเซิร์ฟเวอร์ยังเป็นตัวล่าสุดอยู่แล้ว ไม่ต้องอัปเดต')
    return
  }

  // 3. ส่ง URL ใหม่ไป sync บน Backend
  console.log(`[sync] กำลังอัปเดตไปยัง Backend ช่อง id: ${ch3.id}...`)
  const syncRes = await fetch(`${API_BASE}/api/channels/${ch3.id}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: freshUrl }),
  })
  const syncData = await syncRes.json()

  if (syncData.ok) {
    console.log(`[sync] ✅ อัปเดตสตรีมช่อง 3 HD ขึ้นเซิร์ฟเวอร์สำเร็จเรียบร้อย!`)
  } else {
    console.error(`[sync] ❌ ล้มเหลวขณะอัปเดต:`, syncData)
  }
}

syncCh3().catch(console.error)
