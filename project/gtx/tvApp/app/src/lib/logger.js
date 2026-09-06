import { Platform } from 'react-native'
import { API_URL } from './api'

// คิวสำหรับส่ง log แบบ batch เมื่อมีหลายรายการ หรือเน็ตสะดุดชั่วคราว
let logQueue = []
let isFlushing = false

const DEVICE_INFO = {
  platform: Platform.OS,
  version: Platform.Version,
  isTV: Platform.isTV,
}

/**
 * ส่ง Log ขึ้น Backend แบบ Non-blocking (Fire-and-forget)
 * ไม่บล็อก UI, ไม่ทำให้เฟรมเรตตก, ปลอดภัย 100%
 */
export async function sendAppLog({
  level = 'info',
  tag = 'App',
  state = 'UNKNOWN',
  message = '',
  details = {},
  channelId = null,
  channelName = null,
} = {}) {
  const item = {
    level,
    tag,
    state,
    message,
    details: {
      ...details,
      device: DEVICE_INFO,
    },
    channelId,
    channelName,
    clientTime: new Date().toISOString(),
  }

  logQueue.push(item)

  // ถ้าเป็น error ให้ flush ส่งทันที ถ้าเป็น info ให้รวมส่งใน 150ms
  if (level === 'error' || state.includes('ERROR')) {
    flushLogQueue()
  } else {
    scheduleFlush()
  }
}

let flushTimer = null
function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushLogQueue()
  }, 200)
}

async function flushLogQueue() {
  if (isFlushing || logQueue.length === 0) return
  isFlushing = true

  const batch = logQueue.slice(0, 50)
  logQueue = logQueue.slice(50)

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)

    await fetch(`${API_URL}/api/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.length === 1 ? batch[0] : { logs: batch }),
      signal: controller.signal,
    })

    clearTimeout(timer)
  } catch (err) {
    // ถ้าส่งไม่ผ่าน ให้เก็บไว้ในคิว (จำกัดไม่เกิน 100 รายการเพื่อประหยัดแรม)
    if (logQueue.length < 100) {
      logQueue = [...batch, ...logQueue]
    }
  } finally {
    isFlushing = false
    if (logQueue.length > 0) {
      setTimeout(flushLogQueue, 2000)
    }
  }
}

// ---------- Helper Functions ----------

export function logState(state, message, details = {}, channel = null, tag = 'App') {
  sendAppLog({
    level: 'info',
    tag: channel ? 'Player' : tag,
    state,
    message,
    details,
    channelId: channel?.id || null,
    channelName: channel?.name || null,
  })
}

export function logWarn(state, message, details = {}, channel = null, tag = 'App') {
  sendAppLog({
    level: 'warn',
    tag: channel ? 'Player' : tag,
    state,
    message,
    details,
    channelId: channel?.id || null,
    channelName: channel?.name || null,
  })
}

export function logError(state, message, error = null, details = {}, channel = null, tag = 'App') {
  const errorDetails = {
    ...details,
    errorMessage: error?.message || (typeof error === 'string' ? error : 'Unknown error'),
    errorName: error?.name,
    errorCode: error?.code,
    nativeError: error?.nativeException || error?.nativeError || null,
    errorStack: error?.stack?.slice?.(0, 300) || null,
  }

  sendAppLog({
    level: 'error',
    tag: channel ? 'Player' : tag,
    state,
    message,
    details: errorDetails,
    channelId: channel?.id || null,
    channelName: channel?.name || null,
  })
}

export function logChannelState(state, message, details = {}) {
  sendAppLog({
    level: 'info',
    tag: 'Channels',
    state,
    message,
    details,
  })
}
