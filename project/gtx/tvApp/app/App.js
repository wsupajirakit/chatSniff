import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StatusBar, StyleSheet, useTVEventHandler, View } from 'react-native'
import { theme } from './src/theme'
import { useChannels } from './src/lib/useChannels'
import { fetchChannel } from './src/lib/api'
import { logState } from './src/lib/logger'
import { isCh3, renewCh3Auto, onCh3UrlUpdated, getCh3CachedUrl } from './src/lib/streamResolver'
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

  const badgeTimer = useRef(null)
  const playingRef = useRef(playing)
  playingRef.current = playing

  useEffect(() => {
    logState('APP_MOUNTED', 'TV App started', { channelCount: remoteChannels?.length || 0 })
  }, [remoteChannels?.length])

  // ซิงค์ URL ช่อง 3 ทันทีเมื่อมีการต่ออายุสำเร็จจากเบื้องหลัง
  useEffect(() => {
    return onCh3UrlUpdated((newUrl) => {
      if (!newUrl) return
      setPlaying((current) => {
        if (current && isCh3(current) && current.url !== newUrl) {
          logState('PLAYING_CH3_URL_SYNCED', 'Updated playing Channel 3 with newly renewed URL', {
            oldUrl: current.url,
            newUrl,
          }, current)
          return { ...current, url: newUrl }
        }
        return current
      })
    })
  }, [])

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

      let targetChannel = channel

      // ทุกครั้งที่มีการสั่งเล่นช่อง 3 ให้ต่ออายุอัตโนมัติทันที
      if (isCh3(channel)) {
        const cached = getCh3CachedUrl()
        if (cached && cached !== channel.url) {
          targetChannel = { ...channel, url: cached }
        }
        renewCh3Auto({
          channelId: channel.id,
          currentUrl: targetChannel.url,
          trigger: 'play_select_card',
          force: true,
        }).catch(() => {})
      }

      // ถ้าเป็นช่องเดิมที่กำลังเล่นอยู่แล้ว ไม่ต้องรีเซ็ต epoch ป้องกันการ reload โดยไม่จำเป็น
      if (playingRef.current?.id === targetChannel.id && !targetChannel.isMain) {
        showBadgeBriefly()
        return
      }

      logState('CHANNEL_COMMITTED', `Switching to ${targetChannel.name}`, {
        channelId: targetChannel.id,
        url: targetChannel.url,
      }, targetChannel)

      setPlaying({ ...targetChannel, _loadEpoch: Date.now() })
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
      logState('CHANNEL_BACKEND_UPDATED', `Channel URL or name changed on backend: ${found.name}`, {
        oldUrl: playing.url,
        newUrl: found.url,
      }, found)

      setPlaying((current) => ({
        ...found,
        _loadEpoch: current?._loadEpoch || Date.now(),
      }))
    }
  }, [remoteChannels, playing?.id, playing?.url, playing?.name, playing?.isMain])

  const handleFocusChannel = useCallback(
    (channel) => {
      if (!channel) return

      // เมื่อเลื่อนมาโฟกัสที่การ์ดช่อง 3 ให้กระตุ้นการต่ออายุอัตโนมัติล่วงหน้าทันทีในเบื้องหลัง
      if (isCh3(channel)) {
        renewCh3Auto({
          channelId: channel.id,
          currentUrl: channel.url,
          trigger: 'focus_card',
        }).catch(() => {})
      }

      // UX: เวลาเลื่อนดูรายการช่อง จะไม่สลับช่องอัตโนมัติเด็ดขาด
      // ผู้ใช้ต้องกดปุ่มตรงกลางรีโมต (OK / Select / Center) ก่อนเท่านั้น ถึงจะสลับไปเล่นช่องนั้น
    },
    [],
  )

  const handleSelectChannel = useCallback(
    (channel) => {
      // เมื่อผู้ใช้กดปุ่มตรงกลางรีโมต (OK / Select / Center) ให้สลับไปเล่นช่องที่เลือกทันที 0ms
      commit(channel)
    },
    [commit],
  )

  // ดึง URL ล่าสุดกรณีสตรีมหลุดและสงสัยว่าลิงก์เดิมหมดอายุ
  const handleRefreshChannel = useCallback(async (channelId) => {
    if (!channelId || channelId === MAIN_CHANNEL.id) return null
    try {
      logState('FETCH_FRESH_URL_REQUEST', `Requesting fresh channel URL for ${channelId}`, { channelId })
      
      let freshUrl = null
      if (isCh3({ id: channelId })) {
        freshUrl = await renewCh3Auto({
          channelId,
          trigger: 'handle_refresh_channel',
          force: true,
        })
      }

      if (!freshUrl) {
        const fresh = await fetchChannel(channelId, { refresh: true })
        freshUrl = fresh?.url
      }

      if (freshUrl) {
        setPlaying((current) => {
          if (current?.id === channelId) {
            return { ...current, url: freshUrl }
          }
          return current
        })
        logState('FETCH_FRESH_URL_SUCCESS', `Obtained fresh URL for ${channelId}`, { url: freshUrl })
        return { id: channelId, url: freshUrl }
      }
    } catch (err) {
      logState('FETCH_FRESH_URL_FAILED', `Failed to fetch fresh URL: ${err?.message}`, { error: err?.message })
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
        remoteCount={remoteChannels?.length || 0}
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
