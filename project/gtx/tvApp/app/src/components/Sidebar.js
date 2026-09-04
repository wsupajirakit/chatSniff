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

const EXPANDED_WIDTH = 220
const COLLAPSED_WIDTH = 70

/**
 * แถบช่องด้านซ้าย สไตล์ tvOS 17.2:
 * - ตอนเลื่อน: เปิดเต็มขนาด (expanded) แสดงทั้งชื่อช่องและรายละเอียด
 * - พอช่อง active เล่นแล้ว: ย่อ sidebar เหลือแค่ logo avatar (mini rail)
 */
export function Sidebar({
  channels,
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
    Animated.spring(widthAnim, {
      toValue: COLLAPSED_WIDTH,
      useNativeDriver: false,
      speed: 22,
      bounciness: 0,
    }).start()
  }, [widthAnim])

  const expand = useCallback(() => {
    setIsCollapsed(false)
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

  // ตอนกดปุ่มรีโมทขึ้นลงหรือกดเลือก ให้กาง sidebar ทันที (ไม่ดักจับ event focus เพื่อป้องกัน loop)
  const handleTVEvent = useCallback(
    (evt) => {
      const type = evt?.eventType
      if (type && ['up', 'down', 'left', 'right', 'select'].includes(type)) {
        expand()
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
      // ปล่อยให้ Android TV Native Focus เลื่อน viewport ตามตำแหน่งอย่างลื่นไหล 60fps
      onFocusChannel?.(channel)
    },
    [expand, onFocusChannel],
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
        onPress={onSelectChannel}
      />
    ),
    [handleFocus, onSelectChannel, playingId, initialIndex, isCollapsed],
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
              <Text style={styles.subtitle} numberOfLines={1}>
                {status === 'ready' ? `${channels.length} ช่อง` : 'กำลังเชื่อมต่อ...'}
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
          getItemLayout={(_, index) => ({
            length: 68,
            offset: 68 * index,
            index,
          })}
          onScrollToIndexFailed={({ index }) => {
            listRef.current?.scrollToOffset({
              offset: 68 * index,
              animated: false,
            })
          }}
        />
      </TVFocusGuideView>

      {!isCollapsed ? (
        <View style={styles.footer}>
          <Text style={styles.hint}>▲ ▼ เลื่อนเพื่อเปลี่ยนช่อง</Text>
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
  listWrap: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingTop: 10,
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
    borderColor: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
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


