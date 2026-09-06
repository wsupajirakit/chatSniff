import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useEventListener } from 'expo'
import { useVideoPlayer, VideoView } from 'expo-video'
import { LoadingOverlay } from './Loading'
import { logState, logWarn, logError } from '../lib/logger'
import { resolveStreamUrl, isUrlExpiring, isCh3, renewCh3Auto } from '../lib/streamResolver'


const MAIN_IMAGE = require('../../assets/main_still_channel.jpg')

const MAX_AUTO_RETRIES = 5
const RETRY_DELAYS = [2000, 4000, 6000, 8000, 10000] // มิลลิวินาที: เพิ่มเป็น 5 ครั้ง รอนานขึ้นทีละขั้น
const STALL_TIMEOUT_MS = 15000 // ไม่มีเฟรมขยับต่อเนื่องเกิน 15 วิ ถึงจะนับเป็นสตรีมค้างจริง
const STABLE_PLAYBACK_THRESHOLD_MS = 60000 // ต้องเล่นต่อเนื่องอย่างน้อย 60 วิ ถึงยอม reset ตัวนับ retry (ป้องกัน infinite loop)
const SAFETY_DISMISS_LOADING_MS = 3500 // รับประกันว่าจอโหลดต้องถูกปลดออกเมื่อภาพมา หรือไม่เกิน 3.5 วิ ป้องกันค้างไม่รู้จบ

/**
 * ตัวเล่นวิดีโอและจอภาพนิ่งหน้าหลัก
 * - แยกสถานะ "ปกติ" กับ "ไม่ปกติ" ชัดเจน 100% ไม่เดา ไม่ reload เองขณะกำลังดูได้ปกติ
 * - มี Hard Cap สูงสุด 3 ครั้ง หากไม่มา ให้หยุดนิ่งทันที ไม่ติดลูปกระตุก
 * - ส่ง Log ทุก State และ Error ละเอียดขึ้น Backend แบบ Non-blocking
 */
export function Player({ channel, onPlayStateChange, onRefreshChannel }) {
  const isMain = channel?.isMain || channel?.type === 'image'
  const url = isMain ? null : channel?.url
  const loadEpoch = channel?._loadEpoch || 0

  const [loading, setLoading] = useState(!isMain)
  const [error, setError] = useState(null)

  // ป้องกันจอดำสนิทตอนสลับช่อง:
  // ทันทีที่ channel.id หรือ loadEpoch เปลี่ยน ให้เปิดหน้าจอโหลดทันทีใน render cycle นี้ (0ms delay)
  const prevChannelIdRef = useRef(channel?.id)
  const prevEpochRef = useRef(loadEpoch)
  if (!isMain && (prevChannelIdRef.current !== channel?.id || prevEpochRef.current !== loadEpoch)) {
    prevChannelIdRef.current = channel?.id
    prevEpochRef.current = loadEpoch
    if (!loading) {
      setLoading(true)
    }
  }

  const currentUrlRef = useRef(url)
  const currentEpochRef = useRef(loadEpoch)
  const autoRetryCountRef = useRef(0)
  const retryTimerRef = useRef(null)
  const stallTimerRef = useRef(null)
  const stableTimerRef = useRef(null)
  const heartbeatTimerRef = useRef(null)
  const safetyDismissTimerRef = useRef(null)
  const dismissTimerRef = useRef(null)
  const loadStartTimeRef = useRef(Date.now())

  const isReconnectingRef = useRef(false)
  const hasStartedPlayingRef = useRef(false)
  const currentPlayingChannelIdRef = useRef(null)
  const lastProgressTimeRef = useRef(Date.now())
  const lastPlaybackPositionRef = useRef(-1)

  // ตั้งค่า Expo Video Player สำหรับ Live Stream HLS
  const player = useVideoPlayer(url ? { uri: url } : null, (instance) => {
    instance.loop = false
    instance.timeUpdateEventInterval = 1 // รับ timeUpdate ทุกวินาทีเพื่อตรวจสอบความก้าวหน้าของเฟรม
    try {
      instance.bufferOptions = {
        preferredForwardBufferDuration: 8,          // ลดจาก 15 เหลือ 8 วิ เพื่อไม่ buffer เกิน live window (30 วิ)
        minBufferForPlayback: 1.5,                  // เริ่มเล่นเร็วขึ้นเล็กน้อย
        prioritizeTimeOverSizeThreshold: true,       // ให้ buffer ตามเวลา ไม่ใช่ตามขนาดไฟล์
      }
    } catch {
      // ignore
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
    if (stableTimerRef.current) {
      clearTimeout(stableTimerRef.current)
      stableTimerRef.current = null
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current)
      heartbeatTimerRef.current = null
    }
    if (safetyDismissTimerRef.current) {
      clearTimeout(safetyDismissTimerRef.current)
      safetyDismissTimerRef.current = null
    }
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
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
      isReconnectingRef.current = true
      hasStartedPlayingRef.current = false

      logState('RECONNECT_EXECUTING', `Executing reconnect (attempt ${autoRetryCountRef.current}/${MAX_AUTO_RETRIES})`, {
        isManual,
        currentAttempt: autoRetryCountRef.current,
        url,
      }, channel)

      // ตรวจสอบและดึง fresh URL เสมอ (เช่น กรณี Token ByteArk หมดอายุ)
      let targetUrl = url
      try {
        targetUrl = await resolveStreamUrl(channel, {
          forceRefresh: autoRetryCountRef.current >= 1 || isUrlExpiring(url, 300),
        })
      } catch (err) {
        logError('RESOLVE_URL_RECONNECT_ERROR', `Error resolving URL: ${err?.message}`, err, {}, channel)
      }

      // หากลองรอบที่ 2 ขึ้นไป ให้ลองขอ fresh URL จาก backend เผื่อกรณีลิงก์เดิมหมดอายุ
      if (autoRetryCountRef.current >= 2 && onRefreshChannel && channel?.id) {
        try {
          const fresh = await onRefreshChannel(channel.id)
          if (fresh?.url && !isUrlExpiring(fresh.url, 300)) {
            targetUrl = fresh.url
          }
        } catch {
          // ใช้ url เดิมต่อถ้า backend ไม่ตอบสนอง
        }
      }



      if (!targetUrl) {
        setLoading(false)
        isReconnectingRef.current = false
        setError('ไม่พบที่อยู่ของสตรีม')
        onPlayStateChange?.(false)
        logError('RECONNECT_FAILED_NO_URL', 'Target URL is missing', null, {}, channel)
        return
      }

      try {
        player.replace({ uri: targetUrl })
        player.play()
        lastProgressTimeRef.current = Date.now()
        lastPlaybackPositionRef.current = -1
      } catch (e) {
        logError('RECONNECT_EXCEPTION', 'Exception while calling player.replace()', e, {}, channel)
      } finally {
        isReconnectingRef.current = false
      }
    },
    [isMain, player, url, onRefreshChannel, channel, clearAllTimers, onPlayStateChange],
  )

  // ฟังก์ชันจัดการ Auto-Reconnect เมื่อเกิด error หรือสตรีมหลุด (จำกัดสูงสุด 5 ครั้ง ไม่ติดลูป)
  const triggerAutoReconnect = useCallback(
    (reason) => {
      if (isMain || !url || !player) return

      // ถ้ากำลังรอคิว retry อยู่แล้ว หรือกำลัง replace อยู่ ห้ามยิงซ้ำ!
      if (retryTimerRef.current || isReconnectingRef.current) {
        return
      }

      // ป้องกันลูปไม่รู้จบ: ถ้าลองครบ MAX_AUTO_RETRIES แล้ว ให้หยุดสนิททันที ห้าม trigger ซ้ำ
      if (autoRetryCountRef.current >= MAX_AUTO_RETRIES) {
        setLoading(false)
        return
      }

      const retryIndex = autoRetryCountRef.current
      if (retryIndex < MAX_AUTO_RETRIES) {
        const delay = RETRY_DELAYS[retryIndex] || 5000
        autoRetryCountRef.current += 1
        isReconnectingRef.current = true

        logWarn('AUTO_RECONNECT_SCHEDULED', `Scheduling reconnect in ${delay}ms (attempt ${autoRetryCountRef.current}/${MAX_AUTO_RETRIES})`, {
          attempt: autoRetryCountRef.current,
          maxRetries: MAX_AUTO_RETRIES,
          delayMs: delay,
          reason,
        }, channel)

        setLoading(true)
        retryTimerRef.current = setTimeout(() => {
          retryTimerRef.current = null
          performReconnect(false)
        }, delay)
      } else {
        // ลองครบ 3 ครั้งแล้วหยุดสนิท! ห้ามติดลูปกระตุกเด็ดขาด
        isReconnectingRef.current = false
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current)
          retryTimerRef.current = null
        }

        logError('AUTO_RECONNECT_HALTED_MAX_REACHED', `Reached maximum retries (${MAX_AUTO_RETRIES}). Halting retry to prevent infinite stutter loop.`, null, {
          reason,
          maxRetries: MAX_AUTO_RETRIES,
          url,
        }, channel)

        setLoading(false)
        setError('สัญญาณถ่ายทอดสดขัดข้อง หรือหลุดการเชื่อมต่อชั่วคราว')
        onPlayStateChange?.(false)
      }
    },
    [isMain, url, player, performReconnect, channel, onPlayStateChange],
  )

  // ตรวจจับกรณีสตรีมค้าง (Stall Watcher)
  // ทำงานเฉพาะเมื่อ: ไม่มีเฟรมภาพ/เสียงขยับติดต่อกันเกิน 15 วินาทีจริง ๆ
  const checkStallStatus = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }

    // ป้องกันลูป: ถ้ากำลัง reconnect หรือครบ max retries แล้ว ไม่ต้องตั้ง stall timer
    if (isMain || !url || isReconnectingRef.current || autoRetryCountRef.current >= MAX_AUTO_RETRIES) return

    stallTimerRef.current = setTimeout(() => {
      stallTimerRef.current = null
      const elapsedSinceProgress = Date.now() - lastProgressTimeRef.current

      // ถ้าไม่มีการขยับของเวลาเกิน 15 วินาทีจริง ๆ และไม่ได้กำลังเล่นอยู่
      if (elapsedSinceProgress >= STALL_TIMEOUT_MS && !player?.playing && !error) {
        logWarn('PLAYBACK_STALL_CONFIRMED', `No playback progress for ${Math.round(elapsedSinceProgress / 1000)}s`, {
          elapsedMs: elapsedSinceProgress,
          lastPosition: lastPlaybackPositionRef.current,
        }, channel)

        triggerAutoReconnect('stalled-no-progress-15s')
      }
    }, STALL_TIMEOUT_MS)
  }, [isMain, url, player, error, triggerAutoReconnect, channel])

  // ช่องหลัก (ภาพนิ่ง)
  useEffect(() => {
    if (isMain) {
      clearAllTimers()
      setLoading(false)
      setError(null)
      onPlayStateChange?.(true)
      logState('MAIN_STILL_CHANNEL_ACTIVE', 'Showing main still channel', {}, channel)
    }
  }, [isMain, onPlayStateChange, clearAllTimers, channel])

  // ติดตามสถานะของ player (statusChange)
  useEventListener(player, 'statusChange', ({ status, error: err }) => {
    if (isMain) return

    if (status === 'error' || err) {
      const errMsg = err?.message || ''

      // BehindLiveWindowException หรือ Source error: ส่งเข้า triggerAutoReconnect ทันที
      // ห้ามใส่ return เด็ดขาด เพื่อไม่ให้ตัดวงจรการกู้คืนสตรีม
      if (errMsg.includes('Source error') || errMsg.includes('BehindLiveWindow')) {
        logWarn('BEHIND_LIVE_WINDOW_RECONNECT', 'Source error detected, triggering auto reconnect', {
          errMsg,
          url,
          currentTime: lastPlaybackPositionRef.current,
        }, channel)
      }

      hasStartedPlayingRef.current = false
      if (stableTimerRef.current) {
        clearTimeout(stableTimerRef.current)
        stableTimerRef.current = null
      }

      logError('PLAYER_STATUS_ERROR', `Status error: ${errMsg || status}`, err, {
        status,
        url,
        currentTime: lastPlaybackPositionRef.current,
      }, channel)

      triggerAutoReconnect(errMsg || 'status-error')
    } else if (status === 'readyToPlay') {
      logState('PLAYER_READY_TO_PLAY', 'Media source prepared, readyToPlay', {
        status,
        url,
      }, channel)

      setError(null)

      if (!player?.playing) {
        try {
          player.play()
        } catch {}
      }

      // Fail-Safe Safety Watchdog (4.5 วินาที):
      // หากผ่านไป 4.5 วิ แล้ว timeUpdate ยังไม่เดินหน้า ให้ปลด loading เพื่อไม่ให้ค้าง
      if (safetyDismissTimerRef.current) clearTimeout(safetyDismissTimerRef.current)
      safetyDismissTimerRef.current = setTimeout(() => {
        safetyDismissTimerRef.current = null
        if (!isMain && !error) {
          logState('SAFETY_DISMISS_LOADING', 'Clearing loading via safety watchdog (4.5s elapsed)', {}, channel)
          if (!hasStartedPlayingRef.current) {
            hasStartedPlayingRef.current = true
            onPlayStateChange?.(true)
          }
          setLoading(false)
        }
      }, 4500)
    } else if (status === 'loading') {
      if (!hasStartedPlayingRef.current) {
        setLoading(true)
      }
      checkStallStatus()
    } else if (status === 'idle') {
      if (hasStartedPlayingRef.current) {
        checkStallStatus()
      }
    }
  })

  // ติดตามการเล่น (playingChange)
  useEventListener(player, 'playingChange', ({ isPlaying }) => {
    if (isMain) return

    if (isPlaying) {
      setError(null)
      // หมายเหตุสำคัญ: ห้ามสั่ง setLoading(false) ตรงนี้!
      // เพราะ playingChange เกิดขึ้นทันทีที่สั่ง play() ก่อนที่ตัวถอดรหัสจะวาดเฟรมภาพลงจอ 1.5-2.5 วิ
      // เราจะคงหน้าจอ Loading Dialog ไว้จนกว่า timeUpdate จะยืนยันว่าเฟรมภาพแรกเริ่มขยับจริง

      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current)
        stallTimerRef.current = null
      }

      // เริ่มส่ง Heartbeat ทุก 60 วินาที เพื่อบันทึกว่ายังเล่นได้ปกติ
      if (!heartbeatTimerRef.current) {
        heartbeatTimerRef.current = setInterval(() => {
          if (player?.playing && hasStartedPlayingRef.current) {
            logState('PLAYING_HEARTBEAT', 'Stream is healthy and playing', {
              currentTime: lastPlaybackPositionRef.current,
              isPlaying: true,
            }, channel)
          }
        }, 60000)
      }
    } else if (!error) {
      checkStallStatus()
    }
  })

  // ตรวจจับความก้าวหน้าจริงของเวลาสตรีม (timeUpdate)
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (isMain) return

    lastProgressTimeRef.current = Date.now()

    // เช็คว่าเฟรมภาพแรกเริ่มเรนเดอร์และเวลากำลังเดินหน้าจริง
    const hasProgress = currentTime > 0 || (lastPlaybackPositionRef.current >= 0 && currentTime !== lastPlaybackPositionRef.current)
    lastPlaybackPositionRef.current = currentTime

    if (hasProgress) {
      // ยกเลิก safety watchdog
      if (safetyDismissTimerRef.current) {
        clearTimeout(safetyDismissTimerRef.current)
        safetyDismissTimerRef.current = null
      }

      // แจ้งเตือนสถานะเริ่มเล่นเพียง "ครั้งเดียว" (ป้องกันไม่ให้ badge ช่องบนขวาถูก reset timer ค้าง)
      if (!hasStartedPlayingRef.current) {
        hasStartedPlayingRef.current = true
        onPlayStateChange?.(true)
      }

      // รับประกันว่าหน้าจอ Loading Dialog จะแสดงอย่างน้อย 900ms เพื่อความสวยงามและไม่กระพริบหายก่อนตาเห็น
      const elapsed = Date.now() - loadStartTimeRef.current
      const remainingMinTime = Math.max(0, 900 - elapsed)

      if (remainingMinTime > 0) {
        if (!dismissTimerRef.current) {
          dismissTimerRef.current = setTimeout(() => {
            dismissTimerRef.current = null
            setLoading(false)
          }, remainingMinTime)
        }
      } else {
        setLoading(false)
      }
    }

    // เคลียร์ stall timer ทิ้งทันที
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current)
      stallTimerRef.current = null
    }

    if (error) setError(null)

    // Cooldown 60 วินาที
    if (!stableTimerRef.current && autoRetryCountRef.current > 0) {
      stableTimerRef.current = setTimeout(() => {
        stableTimerRef.current = null
        if (hasStartedPlayingRef.current && player?.playing) {
          logState('PLAYBACK_STABLE_60S', 'Stream has played smoothly for 60s. Retry counter reset to 0.', {
            previousRetries: autoRetryCountRef.current,
          }, channel)
          autoRetryCountRef.current = 0
        }
      }, STABLE_PLAYBACK_THRESHOLD_MS)
    }
  })

  // จัดการเมื่อเปลี่ยนช่องจริง หรือ URL เปลี่ยนแปลง
  useEffect(() => {
    if (isMain) {
      currentUrlRef.current = null
      currentEpochRef.current = loadEpoch
      clearAllTimers()
      return
    }

    if (!player || !url) return

    const channelChanged = currentPlayingChannelIdRef.current !== channel?.id
    const urlChanged = currentUrlRef.current !== url
    const forceReloadRequested = currentEpochRef.current !== loadEpoch

    // ถ้าไม่มีอะไรเปลี่ยนเลย ปล่อยให้เล่นต่อเนื่อง
    if (!channelChanged && !urlChanged && !forceReloadRequested) return

    // Best Practice: หากกำลังดูช่องเดิมอยู่ และสตรีมกำลังเล่นได้อย่างราบรื่น (Healthy Playback)
    // การที่ URL มีการต่ออายุ Token ใหม่ใน Background จะต้องไม่ขัดจังหวะการดูของผู้ใช้
    // ให้อัปเดต URL ใหม่ไว้ใน Ref เงียบๆ เพื่อใช้กรณีเกิด Network Error ในอนาคต
    if (!channelChanged && !forceReloadRequested && hasStartedPlayingRef.current) {
      currentUrlRef.current = url
      return
    }

    logState('CHANNEL_LOAD_INITIATED', `Loading channel: ${channel?.name}`, {
      channelChanged,
      urlChanged,
      forceReloadRequested,
      url,
    }, channel)

    currentPlayingChannelIdRef.current = channel?.id
    currentUrlRef.current = url
    currentEpochRef.current = loadEpoch
    autoRetryCountRef.current = 0
    hasStartedPlayingRef.current = false
    loadStartTimeRef.current = Date.now()
    lastPlaybackPositionRef.current = -1
    clearAllTimers()

    // ทุกครั้งที่เริ่มเล่นหรือเปลี่ยนมาช่อง 3 ให้สั่งต่ออายุอัตโนมัติล่วงหน้าทันที
    if (isCh3(channel)) {
      renewCh3Auto({
        channel,
        channelId: channel?.id,
        currentUrl: url,
        trigger: 'player_channel_load',
      }).catch(() => {})
    }

    // สั่ง replace สตรีมเมื่อเปลี่ยนช่อง หรือเมื่อสั่ง reload
    setLoading(true)
    setError(null)
    try {
      player.replace({ uri: url })
      player.play()
    } catch (e) {
      logError('CHANNEL_LOAD_ERROR', 'Error replacing player uri', e, {}, channel)
    }
  }, [isMain, player, url, loadEpoch, channel, clearAllTimers])

  // ตรวจสอบความสดของ Token ช่อง 3 เป็นระยะขณะกำลังเล่น เพื่อไม่ให้สตรีมขาดตอนกรณีเปิดดูยาวๆ
  useEffect(() => {
    if (isMain || !isCh3(channel)) return

    const interval = setInterval(() => {
      if (isUrlExpiring(currentUrlRef.current, 1800)) {
        // ถ้าเหลือเวลาน้อยกว่า 30 นาที ให้ต่ออายุอัตโนมัติทันที
        renewCh3Auto({
          channelId: channel?.id,
          currentUrl: currentUrlRef.current,
          trigger: 'player_heartbeat_proactive',
          force: true,
        }).catch(() => {})
      }
    }, 300000) // เช็คทุก 5 นาที

    return () => clearInterval(interval)
  }, [isMain, channel])

  // กลับมาจากสแตนด์บาย / พักหน้าจอทีวี
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !isMain && player && url) {
        logState('APP_STATE_ACTIVE', 'TV resumed from standby', {}, channel)
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
  }, [isMain, player, url, performReconnect, channel])

  // ล้าง timers ทั้งหมดตอน unmount
  useEffect(() => {
    return () => clearAllTimers()
  }, [clearAllTimers])

  const manualRetry = useCallback(() => {
    logState('MANUAL_RETRY_CLICKED', 'User clicked manual retry button with remote', {}, channel)
    performReconnect(true)
  }, [performReconnect, channel])

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

      {/* จอโหลดตอนกำลังเชื่อมต่อ สวยงาม ใหญ่ระดับภาพยนตร์ พร้อม Fade Out เมื่อภาพมา */}
      <LoadingOverlay
        channel={channel}
        visible={loading && !error && !isMain}
      />

      {/* จอแจ้งเตือนเมื่อเปิดช่องไม่ได้ */}
      {error ? (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>เล่นช่องนี้ไม่ได้</Text>
          <Text style={styles.errorName} numberOfLines={1}>
            {channel?.name}
          </Text>
          <Text style={styles.errorHint}>
            สัญญาณถ่ายทอดสดขัดข้อง หรือหลุดการเชื่อมต่อชั่วคราว
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
