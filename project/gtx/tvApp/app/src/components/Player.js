import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useEventListener } from 'expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { LoadingOverlay } from './Loading'

const MAIN_IMAGE = require('../../assets/main_still_channel.jpg')

const MAX_AUTO_RETRIES = 3
const RETRY_DELAYS = [1500, 3000, 5000] // มิลลิวินาทีสำหรับ auto-reconnect แต่ละรอบ
const STALL_TIMEOUT_MS = 12000 // ค้าง buffering/loading ติดต่อกันเกิน 12 วิ ถึงจะสั่ง re-sync

/**
 * ตัวเล่นวิดีโอและจอภาพนิ่งหน้าหลัก
 * - สตรีม HLS ผ่าน expo-video รองรับ Live TV
 * - ป้องกัน Infinite Refresh Loop (ไม่แตะต้อง player ขณะกำลังเล่นปกติ)
 * - มีระบบ Seamless Auto-Reconnect เมื่อสตรีมหลุด / หลุด Live Window / ลิงก์มีอายุ
 */
export function Player({ channel, onPlayStateChange, onRefreshChannel }) {
  const isMain = channel?.isMain || channel?.type === 'image'
  const url = isMain ? null : channel?.url
  const loadEpoch = channel?._loadEpoch || 0

  const [loading, setLoading] = useState(!isMain)
  const [error, setError] = useState(null)

  const currentUrlRef = useRef(url)
  const currentEpochRef = useRef(loadEpoch)
  const autoRetryCountRef = useRef(0)
  const retryTimerRef = useRef(null)
  const stallTimerRef = useRef(null)
  const isPlayingRef = useRef(false)

  // สำหรับสตรีมสด (Live HLS):
  // - loop = false ป้องกันไทม์ไลน์เลื่อนหลุดหน้าต่าง live chunk
  // - timeUpdateEventInterval = 1 เปิดให้ระบบส่งอีเวนต์บอกเวลาจริง
  // - bufferOptions ปรับให้เหมาะกับไลฟ์ ไม่ให้ buffer หลุด 30s live window
  const player = useVideoPlayer(url ? { uri: url } : null, (instance) => {
    instance.loop = false
    instance.timeUpdateEventInterval = 1
    try {
      instance.bufferOptions = {
        preferredForwardBufferDuration: 15,
        minBufferForPlayback: 2,
        waitsToMinimizeStalling: true,
      }
    } catch {
      // expo-video บางเวอร์ชันอาจไม่รองรับ bufferOptions บางฟิลด์
    }
    instance.play()
  })

  const clearAllTimers = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }
  }, [])

  // ฟังก์ชันสั่งเชื่อมต่อใหม่แบบปลอดภัย
  const performReconnect = useCallback(
    async (isManual = false) => {
      if (isMain || !player) return
      clearAllTimers()

      if (isManual) {
        autoRetryCountRef.current = 0
      }

      setLoading(true)
      setError(null)

      // หากลองรอบที่ 2 ขึ้นไป ให้ลองขอ fresh URL จาก backend เผื่อกรณีลิงก์เดิมหมดอายุ
      let targetUrl = url
      if (autoRetryCountRef.current >= 2 && onRefreshChannel && channel?.id) {
        try {
          const fresh = await onRefreshChannel(channel.id)
          if (fresh?.url) {
            targetUrl = fresh.url
          }
        } catch {
          // ใช้ url เดิมต่อถ้า backend ไม่ตอบสนอง
        }
      }

      if (!targetUrl) {
        setLoading(false)
        setError('ไม่พบที่อยู่ของสตรีม')
        onPlayStateChange?.(false)
        return
      }

      try {
        player.replace({ uri: targetUrl })
        player.play()
      } catch (e) {
        console.log('[Player] Reconnect error:', e?.message)
      }
    },
    [isMain, player, url, onRefreshChannel, channel?.id, clearAllTimers, onPlayStateChange],
  )

  // ฟังก์ชันจัดการ Auto-Reconnect เมื่อเกิด error หรือสตรีมหลุด
  const triggerAutoReconnect = useCallback(
    (reason) => {
      if (isMain || !url || !player) return
      if (retryTimerRef.current) return // กำลังรอคิว retry อยู่แล้ว

      const retryIndex = autoRetryCountRef.current
      if (retryIndex < MAX_AUTO_RETRIES) {
        const delay = RETRY_DELAYS[retryIndex] || 3000
        console.log(`[Player] Auto-reconnecting in ${delay}ms (attempt ${retryIndex + 1}/${MAX_AUTO_RETRIES}) reason: ${reason}`)
        autoRetryCountRef.current += 1

        setLoading(true)
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null
          performReconnect(false)
        }, delay)
      } else {
        // ลองครบตามโควตาแล้วยังไม่มา แสดงหน้าต่างให้กดลองใหม่
        setLoading(false)
        setError('สัญญาณถ่ายทอดสดขัดข้อง หรือหลุดการเชื่อมต่อชั่วคราว')
        onPlayStateChange?.(false)
      }
    },
    [isMain, url, player, performReconnect, onPlayStateChange],
  )

  // เฝ้าระวังกรณีสตรีมค้าง Buffering นานผิดปกติ (Stall Watcher)
  // จะทำงานเฉพาะเมื่อไม่ได้กำลังเล่น (isPlaying === false) และค้างอยู่ที่ loading/idle เกิน 12 วิ เท่านั้น!
  const resetStallWatcher = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }

    if (!isMain && url && !isPlayingRef.current) {
      stallTimerRef.current = setTimeout(() => {
        if (!isPlayingRef.current && !error) {
          console.log('[Player] Playback stalled for > 12s, triggering auto-reconnect')
          triggerAutoReconnect('stalled-buffering')
        }
      }, STALL_TIMEOUT_MS)
    }
  }, [isMain, url, error, triggerAutoReconnect])

  // ช่องหลัก (ภาพนิ่ง)
  useEffect(() => {
    if (isMain) {
      clearAllTimers()
      setLoading(false)
      setError(null)
      onPlayStateChange?.(true)
    }
  }, [isMain, onPlayStateChange, clearAllTimers])

  // ติดตามสถานะของ player
  useEventListener(player, 'statusChange', ({ status, error: err }) => {
    if (isMain) return

    if (status === 'error' || err) {
      isPlayingRef.current = false
      console.log('[Player] statusChange error:', err?.message || status)
      triggerAutoReconnect(err?.message || 'status-error')
    } else if (status === 'readyToPlay') {
      clearAllTimers()
      setLoading(false)
      setError(null)
      onPlayStateChange?.(true)
      autoRetryCountRef.current = 0

      if (!player?.playing) {
        try {
          player.play()
        } catch {
          // ignore
        }
      }
    } else if (status === 'loading') {
      setLoading(true)
      resetStallWatcher()
    } else if (status === 'idle') {
      // หากตกไปที่ idle ระหว่างที่ควรจะเล่น ให้เตรียมตรวจสอบ stall
      setLoading(true)
      resetStallWatcher()
    }
  })

  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isMain) return
    isPlayingRef.current = isPlaying

    if (isPlaying) {
      clearAllTimers()
      setLoading(false)
      setError(null)
      onPlayStateChange?.(true)
      autoRetryCountRef.current = 0
    } else if (!error) {
      // เมื่อหยุดเล่นหรือสะดุดรอ buffer ให้เฝ้าระวัง stall
      setLoading(true)
      resetStallWatcher()
    }
  })

  useEventListener(player, 'timeUpdate', () => {
    if (isMain) return
    // มี timeUpdate ส่งมา แปลว่ากำลังเล่นสดได้ตามปกติ
    isPlayingRef.current = true
    if (loading) {
      setLoading(false)
    }
    if (error) {
      setError(null)
    }
    clearAllTimers()
  })

  // จัดการเมื่อเปลี่ยนช่อง หรือผู้ใช้กดเลือกช่องเดิมเพื่อบังคับโหลดใหม่
  useEffect(() => {
    if (isMain) {
      currentUrlRef.current = null
      currentEpochRef.current = loadEpoch
      clearAllTimers()
      return
    }

    if (!player || !url) return

    const urlChanged = currentUrlRef.current !== url
    const forceReloadRequested = currentEpochRef.current !== loadEpoch

    // ถ้า URL เดิมและไม่ได้สั่ง force reload ผ่าน epoch ไม่ต้องทำอะไร ปล่อยให้เล่นต่อเนื่อง
    if (!urlChanged && !forceReloadRequested) return

    currentUrlRef.current = url
    currentEpochRef.current = loadEpoch
    autoRetryCountRef.current = 0
    clearAllTimers()

    // ถ้า URL เปลี่ยน useVideoPlayer จะจัดการสร้าง player ใหม่ให้อยู่แล้ว
    // แต่ถ้าเป็นการกดซ้ำเพื่อบังคับโหลดใหม่ (force reload) ให้สั่ง replace
    if (forceReloadRequested && !urlChanged) {
      setLoading(true)
      setError(null)
      try {
        player.replace({ uri: url })
        player.play()
      } catch (e) {
        console.log('[Player] Force reload error:', e?.message)
      }
    }
  }, [isMain, player, url, loadEpoch, clearAllTimers])

  // กลับมาจากสแตนด์บาย / พักหน้าจอทีวี ให้สั่งเล่นต่อทันที
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !isMain && player && url) {
        if (!player.playing) {
          try {
            player.play()
          } catch {
            performReconnect(true)
          }
        }
      }
    })
    return () => sub.remove()
  }, [isMain, player, url, performReconnect])

  // ทำความสะอาด Timers เมื่อ unmount
  useEffect(() => {
    return () => clearAllTimers()
  }, [clearAllTimers])

  const manualRetry = useCallback(() => {
    performReconnect(true)
  }, [performReconnect])

  // กรณีเป็นช่องภาพนิ่งหน้าหลัก (Main Channel)
  if (isMain) {
    return (
      <View style={styles.container}>
        <Image
          source={MAIN_IMAGE}
          style={[StyleSheet.absoluteFill, styles.ambientBg]}
          blurRadius={28}
          resizeMode="cover"
        />
        <Image source={MAIN_IMAGE} style={styles.stillImage} resizeMode="contain" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <VideoView
        style={styles.video}
        player={player}
        contentFit="contain"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />

      {/* จอโหลดตอนกำลังเชื่อมต่อ อยู่กึ่งกลางจอสมบูรณ์ */}
      {loading && !error ? <LoadingOverlay channel={channel} /> : null}

      {/* จอแจ้งเตือนเมื่อเปิดช่องไม่ได้ */}
      {error ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>เล่นช่องนี้ไม่ได้</Text>
          <Text style={styles.errorName} numberOfLines={1}>
            {channel?.name}
          </Text>
          <Text style={styles.errorHint}>
            สัญญาณถ่ายทอดสดขัดข้อง ลิงก์อาจหมดอายุ หรือเครือข่ายหลุดชั่วคราว
          </Text>
          <Pressable focusable onPress={manualRetry} style={styles.retry}>
            {({ focused }) => (
              <View style={[styles.retryInner, focused && styles.retryInnerFocused]}>
                <Text style={[styles.retryText, focused && styles.retryTextFocused]}>
                  ลองใหม่
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(7, 9, 15, 0.94)',
    paddingHorizontal: 50,
    zIndex: 5,
  },
  errorTitle: {
    color: '#FF4D6A',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  errorName: {
    marginTop: 14,
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '700',
    maxWidth: 700,
    textAlign: 'center',
  },
  errorHint: {
    marginTop: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 600,
  },
  retry: {
    marginTop: 32,
  },
  retryInner: {
    paddingHorizontal: 38,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  retryInnerFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    transform: [{ scale: 1.08 }],
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  retryTextFocused: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  stillImage: {
    width: '100%',
    height: '100%',
  },
  ambientBg: {
    width: '100%',
    height: '100%',
    opacity: 0.22,
  },
})
