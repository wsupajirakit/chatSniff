/**
 * streamResolver.js — ระบบตรวจสอบและต่ออายุลิงก์สตรีมสดอัตโนมัติ (ฝั่งแอป)
 * 
 * กลยุทธ์แบบ Fail-Safe อัจฉริยะ:
 * - ทุกครั้งที่มีการ getlist / play select card / เลื่อนเปิดปิด / fetch / play -> ต่ออายุให้อัตโนมัติทันที
 * - ซิงค์ URL สดที่ได้ขึ้น Backend API (POST /api/channels/:id/sync) ทันที
 * - กระจาย URL ใหม่ให้ทุกส่วนในแอป (channels list, player) ผ่าน onCh3UrlUpdated
 * - มี In-flight Deduplication + Throttling ป้องกันการยิง network ซ้ำซ้อนตอนเลื่อนรีโมตเร็วๆ
 */

import { refreshChannel, syncChannelUrl } from './api'
import { logState, logWarn, logError } from './logger'

export const FALLBACK_CH3_URL = 'https://live-us1.thaimomo.com/live-as/ch3hd-3/playlist.m3u8'
export const CH3_DEFAULT_ID = '834500c3-7a3e-4d58-a7df-6d0c981fb111'

let cachedCh3Url = null
let cachedCh3Expires = 0
let lastRenewTimestamp = 0
let inFlightRenewPromise = null
const ch3Listeners = new Set()

/**
 * ตรวจสอบว่าช่องนี้เป็นช่อง 3 หรือไม่ (Strict Check)
 * ห้ามใช้ .includes('3') เด็ดขาด เพราะจะทำให้ช่อง One 31, Amarin TV 34, ไทยรัฐทีวี 32, Workpoint 23 โดนเข้าใจผิดว่าเป็นช่อง 3
 */
export function isCh3(channel) {
  if (!channel) return false
  if (typeof channel === 'string') {
    const s = channel.trim()
    return /^(3\s*hd|ช่อง\s*3|ch\s*3|channel\s*3)($|\s)/i.test(s)
  }
  const id = String(channel.id || '')
  if (id === CH3_DEFAULT_ID || id === 'd100002d-bc97-4852-abfa-f80224804a8f') return true
  const name = String(channel.name || '').trim()
  return /^(3\s*hd|ช่อง\s*3|ch\s*3|channel\s*3)($|\s)/i.test(name)
}


/**
 * อ่าน URL สดที่แคชไว้ล่าสุด
 */
export function getCh3CachedUrl() {
  return cachedCh3Url
}

/**
 * ลงทะเบียนรับแจ้งเตือนเมื่อ URL ช่อง 3 มีการอัปเดตใหม่
 */
export function onCh3UrlUpdated(callback) {
  ch3Listeners.add(callback)
  return () => ch3Listeners.delete(callback)
}

function notifyCh3Updated(newUrl, channelId) {
  ch3Listeners.forEach((cb) => {
    try {
      cb(newUrl, channelId)
    } catch {}
  })
}

/**
 * ตรวจสอบว่า URL สตรีมกำลังจะหมดอายุหรือหมดอายุไปแล้วหรือไม่
 * @param {string} url 
 * @param {number} thresholdSec จำนวนวินาทีก่อนหมดอายุ (ค่าเริ่มต้น 5 นาที)
 */
export function isUrlExpiring(url, thresholdSec = 300) {
  if (!url || typeof url !== 'string') return true
  const match = url.match(/x_ark_expires=(\d+)/)
  if (!match) return false
  const expSec = parseInt(match[1], 10)
  const nowSec = Math.floor(Date.now() / 1000)
  return expSec <= nowSec + thresholdSec
}

/**
 * ดึงลิงก์สดล่าสุดของช่อง 3 จาก ch3plus.com โดยตรง (ใช้ safe string parsing 0.01ms)
 */
export async function fetchFreshCh3StreamDirect() {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)

    const res = await fetch('https://ch3plus.com/live', {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    clearTimeout(timer)

    if (!res.ok) return null

    const html = await res.text()
    const tag = '<script id="__NEXT_DATA__"'
    const idx = html.indexOf(tag)
    if (idx === -1) return null

    const start = html.indexOf('>', idx) + 1
    const end = html.indexOf('</script>', start)
    if (end === -1) return null

    const json = JSON.parse(html.slice(start, end))
    const live = json?.props?.initialState?.liveReducer?.live
    // เลือกลำดับ 1080p (WebSVOD) ก่อน แล้วจึง fallback ไป 720p
    const streamUrl = live?.streamUrlWebSVOD || live?.streamUrlApp || live?.streamUrl

    if (streamUrl && typeof streamUrl === 'string' && streamUrl.includes('m3u8')) {
      const expMatch = streamUrl.match(/x_ark_expires=(\d+)/)
      const nowSec = Math.floor(Date.now() / 1000)
      cachedCh3Url = streamUrl
      cachedCh3Expires = expMatch ? parseInt(expMatch[1], 10) : nowSec + 3600 * 6
      return streamUrl
    }
  } catch (err) {
    // network or parsing error handled gracefully
  }
  return null
}

/**
 * ระบบต่ออายุช่อง 3 อัตโนมัติส่วนกลาง (Centralized Ch3 Auto-Renewal)
 * รองรับการเรียกจาก: getlist, play select card, scroll, expand/collapse sidebar, fetch, player
 */
export async function renewCh3Auto({
  channel = null,
  channelId = null,
  currentUrl = null,
  trigger = 'manual',
  force = false,
} = {}) {
  // ถ้าส่ง channel เข้ามา แล้วตรวจพบว่าไม่ใช่ช่อง 3 ให้ข้ามทันที
  if (channel && !isCh3(channel)) {
    return currentUrl || channel?.url
  }

  const now = Date.now()
  const nowSec = Math.floor(now / 1000)

  // ถ้าไม่ได้สั่ง force และต่ออายุไปไม่ถึง 15 วินาที และ cache ยังไม่หมดอายุ ให้คืน cache เดิมทันที
  if (!force && now - lastRenewTimestamp < 15000 && cachedCh3Url && cachedCh3Expires > nowSec + 300) {
    return cachedCh3Url
  }

  // Deduplication: ถ้ามีตัวกำลังต่ออายุอยู่ ให้ reuse promise เดิม ไม่ยิงซ้อน
  if (inFlightRenewPromise) {
    return inFlightRenewPromise
  }

  inFlightRenewPromise = (async () => {
    const startMs = Date.now()
    logState('CH3_AUTO_RENEW_TRIGGER', `เริ่มต่ออายุสตรีมช่อง 3 อัตโนมัติ (${trigger})`, {
      trigger,
      force,
      channelId,
      hasCached: Boolean(cachedCh3Url),
    })

    let freshUrl = null

    // 1. ดึงสตรีมสดล่าสุดจาก ch3plus.com โดยตรง (Residential/TV Thai IP)
    try {
      freshUrl = await fetchFreshCh3StreamDirect()
    } catch (err) {
      logWarn('CH3_DIRECT_RENEW_FAILED', `ดึงจาก ch3plus ไม่สำเร็จ: ${err?.message}`, { trigger })
    }

    // 2. ถ้าดึงตรงไม่ได้ ให้ลองดึงผ่าน Backend refresh API
    if (!freshUrl && channelId) {
      try {
        const backendChannel = await refreshChannel(channelId)
        if (backendChannel?.url && !isUrlExpiring(backendChannel.url, 300)) {
          freshUrl = backendChannel.url
        }
      } catch (err) {
        logWarn('CH3_BACKEND_RENEW_FAILED', `ดึงจาก backend refresh ไม่สำเร็จ: ${err?.message}`, { trigger })
      }
    }

    if (freshUrl && !isUrlExpiring(freshUrl, 300)) {
      lastRenewTimestamp = Date.now()
      cachedCh3Url = freshUrl
      const expMatch = freshUrl.match(/x_ark_expires=(\d+)/)
      cachedCh3Expires = expMatch ? parseInt(expMatch[1], 10) : Math.floor(Date.now() / 1000) + 3600 * 6

      // ซิงค์ URL สดนี้ขึ้น Backend เพื่อให้อุปกรณ์อื่นๆ ในบ้านได้รับด้วย
      // ป้องกันการ sync ผิดช่องเด็ดขาด: ตรวจสอบว่าเป็นช่อง 3 และฝั่ง Backend มี Guard 403 ป้องกันซ้ำอีกชั้น
      if (channelId && (!channel || isCh3(channel))) {
        syncChannelUrl(channelId, freshUrl).catch(() => {})
      }

      // แจ้งเตือนทุก component ในแอปที่ subscribe อยู่ให้เปลี่ยน URL ทันที
      notifyCh3Updated(freshUrl, channelId)

      logState('CH3_AUTO_RENEW_SUCCESS', `ต่ออายุช่อง 3 สำเร็จ (${trigger}) ใน ${Date.now() - startMs}ms`, {
        trigger,
        url: freshUrl,
        expiresAt: new Date(cachedCh3Expires * 1000).toISOString(),
      })

      return freshUrl
    }

    // 3. ถ้าล้มเหลว ให้ใช้ cached URL เดิมถ้ามีและยังไม่หมดอายุ
    if (cachedCh3Url && !isUrlExpiring(cachedCh3Url, 0)) {
      return cachedCh3Url
    }

    return currentUrl
  })().finally(() => {
    inFlightRenewPromise = null
  })

  return inFlightRenewPromise
}

/**
 * เรียกต่ออายุช่อง 3 แบบ Fire-and-Forget (ไม่บล็อค UI)
 */
export function triggerCh3AutoRenew(trigger = 'event', options = {}) {
  renewCh3Auto({ trigger, ...options }).catch(() => {})
}

/**
 * ตรวจสอบและแปลง Channel URL ให้พร้อมเล่นเสมอ
 * @param {object} channel
 * @param {object} options
 * @param {boolean} options.forceRefresh บังคับขอ token ใหม่
 * @param {string} options.trigger ชื่อเหตุการณ์ที่เรียก
 */
export async function resolveStreamUrl(channel, { forceRefresh = false, trigger = 'resolve' } = {}) {
  if (!channel || !channel.url) return channel?.url || null

  if (!isCh3(channel)) {
    return channel.url
  }

  const nowSec = Math.floor(Date.now() / 1000)

  // 1. ถ้าไม่ force และมี cache ที่ยังสดอยู่ (> 1 ชั่วโมง) ให้ใช้ cache ได้เลย
  if (!forceRefresh && cachedCh3Url && cachedCh3Expires > nowSec + 3600) {
    return cachedCh3Url
  }

  // 2. ถ้าไม่ force และ URL ปัจจุบันยังมีอายุเหลือมากกว่า 10 นาที
  if (!forceRefresh && !isUrlExpiring(channel.url, 600)) {
    return channel.url
  }

  // 3. ทำการต่ออายุอัตโนมัติ
  const renewed = await renewCh3Auto({
    channel,
    channelId: channel.id,
    currentUrl: channel.url,
    trigger,
    force: forceRefresh,
  })

  if (renewed && !isUrlExpiring(renewed, 0)) {
    return renewed
  }

  // 4. Fallback หากหมดอายุและต่ออายุล้มเหลวทุกทาง สลับไปใช้ Mirror สำรอง ไม่ให้จอดำ
  if (isUrlExpiring(channel.url, 0)) {
    logWarn('STREAM_FALLBACK_TO_MIRROR', 'Token หมดอายุและไม่สามารถต่ออายุได้ สลับไปใช้สตรีมสำรองชั่วคราว', {
      fallbackUrl: FALLBACK_CH3_URL,
    }, channel)
    return FALLBACK_CH3_URL
  }

  return channel.url
}
