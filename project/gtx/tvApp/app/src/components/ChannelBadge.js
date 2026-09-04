import { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { theme } from '../theme'
import { Avatar } from './Avatar'

/**
 * ป้ายบอกช่อง OSD ด้านบนขวา — ใหญ่ขึ้น +30% ชัดเจนสะใจจากระยะนั่งดูทีวี
 * โผล่ขึ้นมาตอนเปลี่ยนช่อง และซ่อนอัตโนมัติเมื่อเล่นแล้ว
 */
export function ChannelBadge({ channel, number, visible }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 4,
    }).start()
  }, [visible, anim])

  if (!channel) return null

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-46, 0] })

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { opacity: anim, transform: [{ translateY }] }]}
    >
      <LinearGradient
        colors={['rgba(15, 20, 32, 0.97)', 'rgba(9, 12, 20, 0.92)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Avatar logo +30% (จาก 48 เป็น 64) */}
      <Avatar channel={channel} size={64} />

      <View style={styles.info}>
        {/* ชื่อช่อง +30% (จาก 22 เป็น 28) */}
        <Text style={styles.name} numberOfLines={1}>
          {channel.name}
        </Text>
        <View style={styles.liveRow}>
          <View style={styles.liveDot} />
          {/* ตัวหนังสือ LIVE +30% */}
          <Text style={styles.liveText}>
            {channel.group ? `LIVE · ${channel.group}` : 'LIVE'}
          </Text>
        </View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 36,
    right: 48,
    maxWidth: 680,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    backgroundColor: 'rgba(15, 20, 32, 0.95)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 14,
    zIndex: 999,
  },
  info: {
    flexShrink: 1,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  liveRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.live,
  },
  liveText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
})
