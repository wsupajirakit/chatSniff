import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StatusBar, StyleSheet, useTVEventHandler, View } from 'react-native'
import { theme } from './src/theme'
import { useChannels } from './src/lib/useChannels'
import { fetchChannel } from './src/lib/api'
import { Sidebar } from './src/components/Sidebar'
import { Player } from './src/components/Player'
import { ChannelBadge } from './src/components/ChannelBadge'

const MAIN_CHANNEL = {
  id: 'main-channel',
  name: 'หน้าหลัก',
  group: 'ภาพนิ่ง',
  isMain: true,
  type: 'image',
  enabled: true,
}

export default function App() {
  const { channels: remoteChannels, status, error, reload } = useChannels()
  const channels = useMemo(
    () => [MAIN_CHANNEL, ...(remoteChannels || [])],
    [remoteChannels],
  )

  // เข้ามาครั้งแรกจะอยู่หน้าหลักที่เป็นภาพนิ่งเสมอจนกว่าจะเลือกช่องใหม่
  const [playing, setPlaying] = useState(MAIN_CHANNEL)
  const [badgeVisible, setBadgeVisible] = useState(false)

  const switchTimer = useRef(null)
  const badgeTimer = useRef(null)

  const showBadgeBriefly = useCallback(() => {
    setBadgeVisible(true)
    clearTimeout(badgeTimer.current)
    badgeTimer.current = setTimeout(() => {
      setBadgeVisible(false)
    }, 3000)
  }, [])

  const handlePlayStateChange = useCallback((isPlaying) => {
    if (isPlaying) {
      // เมื่อโหลดสำเร็จและ player เริ่มเล่น ให้ซ่อน badge ทันที
      clearTimeout(badgeTimer.current)
      badgeTimer.current = setTimeout(() => {
        setBadgeVisible(false)
      }, 1200)
    }
  }, [])

  const commit = useCallback(
    (channel) => {
      if (!channel) return
      clearTimeout(switchTimer.current)
      setPlaying({ ...channel, _loadEpoch: Date.now() })
      showBadgeBriefly()
    },
    [showBadgeBriefly],
  )

  const zap = useCallback(
    (delta) => {
      if (channels.length === 0) return
      const current = channels.findIndex((channel) => channel.id === playing?.id)
      const base = current < 0 ? 0 : current
      const next = channels[(base + delta + channels.length) % channels.length]
      commit(next)
    },
    [channels, playing, commit],
  )

  const handleTVEvent = useCallback(
    (event) => {
      const type = event?.eventType
      if (!type || type === 'blur' || type === 'focus') return
      if (event.eventKeyAction === 1) return

      if (type === 'channelUp') {
        zap(1)
        return
      }
      if (type === 'channelDown') {
        zap(-1)
        return
      }
    },
    [zap],
  )

  useTVEventHandler(handleTVEvent)

  // ซิงค์การเปลี่ยนแปลงของช่องปัจจุบันเมื่อ backend อัพเดท (เช่น มีการแก้ URL หรือช่องถูกลบ)
  // จะอัพเดทเฉพาะเมื่อ URL หรือชื่อช่องเปลี่ยนจริงๆ เท่านั้น เพื่อไม่ให้กระทบการเล่นต่อเนื่อง
  useEffect(() => {
    if (!playing || playing.isMain) return
    const found = remoteChannels.find((channel) => channel.id === playing.id)
    if (!found) {
      setPlaying(MAIN_CHANNEL)
    } else if (found.url !== playing.url || found.name !== playing.name) {
      setPlaying((current) => ({
        ...found,
        _loadEpoch: current?._loadEpoch || Date.now(),
      }))
    }
  }, [remoteChannels, playing?.id, playing?.url, playing?.name, playing?.isMain])

  const handleFocusChannel = useCallback(
    (channel) => {
      if (!channel) return
      clearTimeout(switchTimer.current)
      // หน่วงเวลา 450ms ก่อนสลับวิดีโอ เพื่อให้ตอนเลื่อนช่องด้วยรีโมตเร็วๆ ลื่นไหล 60fps ไม่แย่งชิง MediaCodec
      switchTimer.current = setTimeout(() => {
        setPlaying({ ...channel, _loadEpoch: Date.now() })
        showBadgeBriefly()
      }, 450)
    },
    [showBadgeBriefly],
  )

  const handleSelectChannel = useCallback(
    (channel) => {
      // ถ้ากดปุ่ม OK หรือ Select ให้เล่นทันที 0ms
      commit(channel)
    },
    [commit],
  )

  // ดึง URL ล่าสุดจาก backend กรณีสตรีมหลุดและสงสัยว่าลิงก์เดิมหมดอายุ
  const handleRefreshChannel = useCallback(async (channelId) => {
    if (!channelId || channelId === MAIN_CHANNEL.id) return null
    try {
      const fresh = await fetchChannel(channelId)
      if (fresh?.url) {
        setPlaying((current) => {
          if (current?.id === channelId) {
            return { ...current, url: fresh.url }
          }
          return current
        })
        return fresh
      }
    } catch (err) {
      console.log('[App] refreshChannel error:', err?.message)
    }
    return null
  }, [])

  const playingNumber = channels.findIndex((channel) => channel.id === playing?.id) + 1

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {/* หน้าจอเล่นวิดีโอ พื้นหลังเต็มจอ */}
      <View style={styles.playerWrap}>
        <Player
          channel={playing}
          onPlayStateChange={handlePlayStateChange}
          onRefreshChannel={handleRefreshChannel}
        />
      </View>

      {/* แถบรายการช่อง ค้างไว้ตลอดเวลา 11% ทางซ้าย สไตล์ tvOS 17.2 */}
      <Sidebar
        channels={channels}
        status={status}
        error={error}
        playingId={playing?.id}
        onFocusChannel={handleFocusChannel}
        onSelectChannel={handleSelectChannel}
        onRetry={reload}
      />

      {/* ป้ายบอกช่องมุมล่างขวา — ซ่อนอัตโนมัติเมื่อ player เล่นแล้ว */}
      <ChannelBadge
        channel={playing}
        number={playingNumber}
        visible={badgeVisible}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  playerWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: 70, // เวลาย่อ avatar จะเป็น safe margin ไม่ทับวิดีโอ (overlay เฉพาะตอนเลื่อนกาง sidebar)
    backgroundColor: '#000000',
  },
})
