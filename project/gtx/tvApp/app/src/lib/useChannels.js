import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { fetchChannels, fetchUpdatedAt } from './api'
import { logChannelState, logError } from './logger'
import { resolveStreamUrl, isCh3, onCh3UrlUpdated } from './streamResolver'
import { theme } from '../theme'


/**
 * โหลดรายการช่อง แล้วคอยเช็คว่าหลังบ้านมีการเพิ่ม/ลบ/แก้ช่องหรือยัง
 *
 * เช็คด้วย /api/health ซึ่งคืนแค่ timestamp — ถูกกว่าดึงรายการเต็มทุก 8 วินาที
 * ดึงรายการจริงเฉพาะตอน timestamp เปลี่ยนเท่านั้น
 */
export function useChannels() {
  const [channels, setChannels] = useState([])
  const [status, setStatus] = useState('loading') // loading | ready | error
  const [error, setError] = useState(null)
  const [lastLoadedAt, setLastLoadedAt] = useState(null)

  const updatedAtRef = useRef(null)
  const mountedRef = useRef(true)
  const inFlightRef = useRef(false)

  // ซิงค์ URL ช่อง 3 ทันทีเมื่อมีการต่ออายุสำเร็จจากส่วนใดๆ ของแอป (เช่น ตอนกดดู, เลื่อน sidebar, หรือ background sync)
  useEffect(() => {
    return onCh3UrlUpdated((newUrl) => {
      if (!newUrl) return
      setChannels((prev) =>
        prev.map((c) => (isCh3(c) && c.url !== newUrl ? { ...c, url: newUrl } : c))
      )
    })
  }, [])

  const load = useCallback(async ({ silent = false, isManual = false } = {}) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    const startTime = Date.now()

    if (!silent) {
      setStatus('loading')
      setError(null)
    }

    logChannelState(
      'CHANNELS_FETCH_REQUEST',
      isManual ? 'ผู้ใช้กดปุ่มรีโหลดช่องผ่านรีโมต' : 'กำลังดึงรายการช่องจากเซิร์ฟเวอร์',
      { silent, isManual, prevCount: channels.length, updatedAt: updatedAtRef.current }
    )

    try {
      const data = await fetchChannels(isManual)
      if (!mountedRef.current) return

      const rawChannels = Array.isArray(data.channels) ? data.channels : []
      // ทุกครั้งที่มีการ getlist ให้ต่ออายุและตรวจสอบสตรีมช่อง 3 อัตโนมัติทันที
      const resolvedChannels = await Promise.all(
        rawChannels.map(async (c) => {
          if (isCh3(c)) {
            try {
              const resolvedUrl = await resolveStreamUrl(c, {
                forceRefresh: isManual,
                trigger: isManual ? 'getlist_manual' : 'getlist_fetch',
              })
              if (resolvedUrl && resolvedUrl !== c.url) {
                return { ...c, url: resolvedUrl }
              }
            } catch {}
          }
          return c
        })
      )

      const durationMs = Date.now() - startTime
      updatedAtRef.current = data.updatedAt
      setChannels(resolvedChannels)
      setStatus('ready')
      setError(null)
      setLastLoadedAt(Date.now())


      logChannelState(
        'CHANNELS_FETCH_SUCCESS',
        `โหลดรายการช่องสำเร็จ ${data.channels.length} ช่อง (${durationMs}ms)`,
        {
          count: data.channels.length,
          updatedAt: data.updatedAt,
          durationMs,
          isManual,
          channelNames: data.channels.map((c) => c.name),
        }
      )
    } catch (err) {
      const durationMs = Date.now() - startTime
      console.log('>>> [DEBUG] useChannels load error:', err.message, err)

      logError(
        'CHANNELS_FETCH_ERROR',
        `โหลดรายการช่องไม่สำเร็จ: ${err.message}`,
        err,
        { durationMs, isManual, silent },
        null,
        'Channels'
      )

      if (!mountedRef.current) return
      // โหลดพลาดตอน poll เงียบๆ ไม่ต้องล้างรายการที่ดูอยู่ ปล่อยให้ดูต่อได้
      if (!silent) {
        setStatus('error')
        setError(err.message)
      }
    } finally {
      inFlightRef.current = false
    }
  }, [channels.length])

  const reload = useCallback(() => {
    return load({ silent: false, isManual: true })
  }, [load])

  useEffect(() => {
    mountedRef.current = true
    load()
    return () => {
      mountedRef.current = false
    }
  }, [load])

  // เช็คการเปลี่ยนแปลงเป็นระยะ
  useEffect(() => {
    const timer = setInterval(async () => {
      if (!mountedRef.current || inFlightRef.current) return
      try {
        const updatedAt = await fetchUpdatedAt()
        if (updatedAt && updatedAt !== updatedAtRef.current) {
          logChannelState(
            'CHANNELS_POLL_DETECTED_CHANGE',
            `ตรวจพบการอัพเดทรายการช่องจากหลังบ้าน (${updatedAtRef.current} -> ${updatedAt})`,
            { prevUpdatedAt: updatedAtRef.current, nextUpdatedAt: updatedAt }
          )
          load({ silent: true })
        }
      } catch {
        // เน็ตสะดุดชั่วคราว รอบหน้าค่อยลองใหม่
      }
    }, theme.pollInterval)
    return () => clearInterval(timer)
  }, [load])

  // กลับมาจากพักหน้าจอ/สลับแอป ให้เช็คทันทีไม่ต้องรอรอบถัดไป
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load({ silent: true })
    })
    return () => sub.remove()
  }, [load])

  return { channels, status, error, reload, lastLoadedAt }
}
