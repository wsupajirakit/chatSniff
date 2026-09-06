import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TVFocusGuideView,
  useTVEventHandler,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ChannelRow } from './ChannelRow'
import { RowSkeleton } from './Loading'
import { Clock } from './Clock'
import { triggerCh3AutoRenew } from '../lib/streamResolver'

const EXPANDED_WIDTH = 235
const COLLAPSED_WIDTH = 74

/**
 * แถบช่องด้านซ้าย สไตล์ tvOS 17.2:
 * - ตอนเลื่อน: เปิดเต็มขนาด (expanded) แสดงทั้งชื่อช่องและรายละเอียด
 * - พอช่อง active เล่นแล้ว: ย่อ sidebar เหลือแค่ logo avatar (mini rail)
 */
export function Sidebar({
  channels,
  remoteCount,
  status,
  error,
  playingId,
  focusedId,
  onFocusChannel,
  onSelectChannel,
  onRetry,
}) {
  const listRef = useRef(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const collapseTimer = useRef(null)
  const widthAnim = useRef(new Animated.Value(EXPANDED_WIDTH)).current

  const collapse = useCallback(() => {
    setIsCollapsed(true)
    // เมื่อย่อ sidebar: ต่ออายุช่อง 3 ใน background
    triggerCh3AutoRenew('sidebar_collapse')
    Animated.spring(widthAnim, {
      toValue: COLLAPSED_WIDTH,
      useNativeDriver: false,
      speed: 22,
      bounciness: 0,
    }).start()
  }, [widthAnim])

  const expand = useCallback(() => {
    setIsCollapsed(false)
    // เมื่อเปิด/กาง sidebar: ต่ออายุช่อง 3 ใน background ทันที
    triggerCh3AutoRenew('sidebar_expand')
    Animated.spring(widthAnim, {
      toValue: EXPANDED_WIDTH,
      useNativeDriver: false,
      speed: 22,
      bounciness: 2,
    }).start()

    clearTimeout(collapseTimer.current)
    collapseTimer.current = setTimeout(() => {
      collapse()
    }, 2800)
  }, [widthAnim, collapse])

  const userPressedRemoteRef = useRef(false)

  // ตอนกดปุ่มรีโมทขึ้นลงหรือกดเลือก ให้กาง sidebar ทันที (ไม่ดักจับ event focus เพื่อป้องกัน loop)
  const handleTVEvent = useCallback(
    (evt) => {
      const type = evt?.eventType
      if (type && ['up', 'down', 'left', 'right', 'select'].includes(type)) {
        userPressedRemoteRef.current = true
        expand()
        triggerCh3AutoRenew('sidebar_tv_nav')
      }
    },
    [expand],
  )
  useTVEventHandler(handleTVEvent)

  // เมื่อ active channel เปลี่ยน หรือเริ่มเล่น ให้เริ่มนับถอยหลังย่อ sidebar เหลือแค่ logo avatar
  useEffect(() => {
    clearTimeout(collapseTimer.current)
    collapseTimer.current = setTimeout(() => {
      collapse()
    }, 3200)
    return () => clearTimeout(collapseTimer.current)
  }, [playingId, collapse])

  const handleFocus = useCallback(
    (channel) => {
      expand()
      onFocusChannel?.(channel)
    },
    [expand, onFocusChannel],
  )

  const handleSelect = useCallback(
    (channel) => {
      onSelectChannel?.(channel)
      // กดยืนยันเลือกช่องแล้ว เริ่มนับถอยหลังย่อ sidebar เพื่อให้เห็นสตรีมเต็มจอ
      clearTimeout(collapseTimer.current)
      collapseTimer.current = setTimeout(() => {
        collapse()
      }, 1800)
    },
    [onSelectChannel, collapse],
  )

  // คำนวณ index เริ่มต้นเพียงครั้งแรกตอน mount เพื่อไม่ให้ flatlist re-render ยกแผงทุกครั้งที่เลื่อน
  const initialIndexRef = useRef(
    Math.max(0, channels.findIndex((channel) => channel.id === (focusedId || playingId)))
  )
  const initialIndex = initialIndexRef.current

  const renderItem = useCallback(
    ({ item, index }) => (
      <ChannelRow
        channel={item}
        isPlaying={item.id === playingId}
        preferFocus={index === initialIndex}
        isCollapsed={isCollapsed}
        onFocus={handleFocus}
        onPress={handleSelect}
      />
    ),
    [handleFocus, handleSelect, playingId, initialIndex, isCollapsed],
  )

  return (
    <Animated.View style={[styles.container, { width: widthAnim }]}>
      <LinearGradient
        colors={['rgba(12, 15, 24, 0.96)', 'rgba(6, 8, 14, 0.92)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, isCollapsed && styles.headerCollapsed]}>
        {!isCollapsed ? (
          <>
            <View style={styles.titleWrap}>
              <Text style={styles.title} numberOfLines={1}>ช่องทีวี</Text>
              <Text
                style={[
                  styles.subtitle,
                  status === 'error' && styles.subtitleError,
                  status === 'loading' && styles.subtitleLoading,
                ]}
                numberOfLines={1}
              >
                {status === 'loading'
                  ? '⏳ กำลังเชื่อมต่อ...'
                  : status === 'error'
                  ? '⚠️ ต่อเซิร์ฟเวอร์ไม่ได้'
                  : `${remoteCount !== undefined ? remoteCount : channels.length} ช่อง`}
              </Text>
            </View>
            <Clock />
          </>
        ) : (
          <View style={styles.miniHeaderIcon}>
            <View style={styles.miniDot} />
          </View>
        )}
      </View>

      <TVFocusGuideView style={styles.listWrap} trapFocusLeft>
        {/* ปุ่มรีโหลดช่อง รองรับรีโมท D-pad กดขึ้นจากช่องแรกเพื่อโฟกัส และรองรับเมาส์ Hover */}
        <View style={[styles.reloadBar, isCollapsed && styles.reloadBarCollapsed]}>
          <Pressable
            focusable
            onFocus={() => {
              expand()
            }}
            onHoverIn={() => {
              expand()
            }}
            onPress={() => {
              expand()
              onRetry?.()
            }}
            style={({ focused, hovered }) => [
              styles.reloadBtn,
              isCollapsed && styles.reloadBtnCollapsed,
              (focused || hovered) && styles.reloadBtnFocused,
              status === 'loading' && styles.reloadBtnLoading,
            ]}
          >
            {({ focused, hovered }) => {
              const isHighlighted = Boolean(focused || hovered)
              return (
                <View style={[styles.reloadInner, isCollapsed && styles.reloadInnerCollapsed]}>
                  <Text style={[styles.reloadIcon, isHighlighted && styles.reloadIconFocused]}>
                    {status === 'loading' ? '⏳' : '🔄'}
                  </Text>
                  {!isCollapsed ? (
                    <View style={styles.reloadTextWrap}>
                      <Text
                        style={[styles.reloadText, isHighlighted && styles.reloadTextFocused]}
                        numberOfLines={1}
                      >
                        {status === 'loading' ? 'กำลังดึงรายการ...' : 'รีโหลดช่อง'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )
            }}
          </Pressable>
        </View>

        {/* แจ้งเตือนกรณีเชื่อมต่อไม่ได้ */}
        {status === 'error' && !isCollapsed ? (
          <View style={styles.errorNotice}>
            <Text style={styles.errorNoticeText} numberOfLines={2}>
              {error || 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กดปุ่มรีโหลดเพื่อลองใหม่'}
            </Text>
          </View>
        ) : null}

        {status === 'loading' && channels.length === 0 ? (
          <View style={styles.skeletons}>
            {[0, 1, 2, 3, 4].map((index) => (
              <RowSkeleton key={index} index={index} />
            ))}
          </View>
        ) : null}

        {status === 'error' && channels.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>ต่อเซิร์ฟเวอร์ไม่ได้</Text>
            <Text style={styles.emptyText} numberOfLines={2}>{error}</Text>
            <Pressable focusable onPress={() => onRetry?.()} style={styles.retryButton}>
              {({ focused, hovered }) => {
                const isHighlighted = Boolean(focused || hovered)
                return (
                  <View style={[styles.retryInner, isHighlighted && styles.retryInnerFocused]}>
                    <Text style={[styles.retryText, isHighlighted && styles.retryTextFocused]}>
                      ลองใหม่
                    </Text>
                  </View>
                )
              }}
            </Pressable>
          </View>
        ) : null}

        {status !== 'error' && status !== 'loading' && channels.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>ยังไม่มีช่อง</Text>
            <Text style={styles.emptyText}>เพิ่มช่องผ่าน API แล้วรายการจะขึ้นทันที</Text>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={channels}
          keyExtractor={(item) => item.id}
          initialScrollIndex={initialIndex}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, isCollapsed && styles.listContentCollapsed]}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={false}
          overScrollMode="never"
          bounces={false}
          onScroll={() => triggerCh3AutoRenew('sidebar_scroll')}
          scrollEventThrottle={1500}
          getItemLayout={(_, index) => ({
            length: 70,
            offset: 70 * index,
            index,
          })}
          onScrollToIndexFailed={({ index }) => {
            listRef.current?.scrollToOffset({
              offset: 70 * index,
              animated: false,
            })
          }}
        />
      </TVFocusGuideView>

      {!isCollapsed ? (
        <View style={styles.footer}>
          <Text style={styles.hint}>▲ ▼ เลื่อนดู • กด OK เพื่อเลือกช่อง</Text>
        </View>
      ) : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    zIndex: 10,
  },
  header: {
    height: 64,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  miniHeaderIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#7C8CFF',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 1,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10,
    fontWeight: '500',
  },
  subtitleError: {
    color: '#FF4D6A',
    fontWeight: '700',
  },
  subtitleLoading: {
    color: '#7C8CFF',
  },
  reloadBar: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  reloadBarCollapsed: {
    paddingHorizontal: 6,
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  reloadBtn: {
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  reloadBtnCollapsed: {
    width: 46,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reloadBtnFocused: {
    backgroundColor: '#2563EB',
    borderColor: '#00FFFF',
    borderWidth: 4,
    shadowColor: '#00FFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 18,
  },
  reloadBtnLoading: {
    borderColor: '#7C8CFF',
    backgroundColor: 'rgba(124, 140, 255, 0.15)',
  },
  reloadInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  reloadInnerCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
    gap: 0,
  },
  reloadIcon: {
    fontSize: 15,
    color: '#A0AEC0',
  },
  reloadIconFocused: {
    color: '#FFFFFF',
  },
  reloadTextWrap: {
    flex: 1,
  },
  reloadText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  reloadTextFocused: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  errorNotice: {
    marginHorizontal: 8,
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 77, 106, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 106, 0.3)',
  },
  errorNoticeText: {
    color: '#FF6B81',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  listWrap: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 16,
  },
  listContentCollapsed: {
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  skeletons: {
    paddingHorizontal: 8,
    paddingTop: 10,
  },
  emptyBox: {
    paddingHorizontal: 10,
    paddingTop: 16,
    gap: 6,
  },
  emptyTitle: {
    color: '#FF4D6A',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    lineHeight: 16,
  },
  retryButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    cursor: 'pointer',
  },
  retryInner: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  retryInnerFocused: {
    borderColor: '#00FFFF',
    borderWidth: 2,
    backgroundColor: '#2563EB',
    shadowColor: '#00FFFF',
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  retryTextFocused: {
    color: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.35)',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
})


