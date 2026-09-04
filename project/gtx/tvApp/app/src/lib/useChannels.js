import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { fetchChannels, fetchUpdatedAt } from './api'
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

  const updatedAtRef = useRef(null)
  const mountedRef = useRef(true)
  const inFlightRef = useRef(false)

  const load = useCallback(async ({ silent = false } = {}) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    if (!silent) {
      setStatus('loading')
      setError(null)
    }
    try {
      const data = await fetchChannels()
      if (!mountedRef.current) return
      updatedAtRef.current = data.updatedAt
      setChannels(data.channels)
      setStatus('ready')
      setError(null)
    } catch (err) {
      console.log('>>> [DEBUG] useChannels load error:', err.message, err);
      if (!mountedRef.current) return
      // โหลดพลาดตอน poll เงียบๆ ไม่ต้องล้างรายการที่ดูอยู่ ปล่อยให้ดูต่อได้
      if (!silent) {
        setStatus('error')
        setError(err.message)
      }
    } finally {
      inFlightRef.current = false
    }
  }, [])

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

  return { channels, status, error, reload: load }
}
