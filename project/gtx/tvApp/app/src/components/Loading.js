import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { theme } from '../theme'
import { Avatar } from './Avatar'

/** วนลูปค่า 0→1 ไม่รู้จบ ใช้เป็นฐานของทั้งการหมุน การเต้น และแถบไล่แสง */
function useLoop(duration, { easing = Easing.linear } = {}) {
  const value = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(value, {
        toValue: 1,
        duration,
        easing,
        useNativeDriver: true,
      }),
    )
    animation.start()
    return () => animation.stop()
  }, [duration, easing, value])
  return value
}

function DualSpinRing({ size, thickness, color, color2, duration, reverse = false }) {
  const spin = useLoop(duration)
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ['360deg', '0deg'] : ['0deg', '360deg'],
  })
  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: thickness,
          borderTopColor: color,
          borderRightColor: color2 || 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color || 'transparent',
          transform: [{ rotate }],
        },
      ]}
    />
  )
}

const DOT_STEP = 180
const DOT_FADE = 360

function Dot({ delay, color }) {
  const value = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration: DOT_FADE, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: DOT_FADE, useNativeDriver: true }),
        Animated.delay(DOT_STEP * 3 - delay),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [delay, value])

  const opacity = value.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] })
  const scale = value.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.3] })
  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: color || '#F5C518',
          opacity,
          transform: [{ scale }],
        },
      ]}
    />
  )
}

function PulsingDots({ color }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2, 3].map((index) => (
        <Dot key={index} delay={index * DOT_STEP} color={color} />
      ))}
    </View>
  )
}

/**
 * จอโหลดและรอ Buffer ตอนสลับช่อง — ดีไซน์พรีเมียมขนาดใหญ่พิเศษสำหรับจอทีวี
 */
export function LoadingOverlay({ channel, message = 'กำลังเชื่อมต่อสัญญาณถ่ายทอดสด' }) {
  const breathe = useLoop(2000, { easing: Easing.inOut(Easing.ease) })
  const scale = breathe.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.05, 1],
  })
  const glow = breathe.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 0.85, 0.35],
  })
  const pulse = breathe.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.92, 1.08, 0.92],
  })

  const groupText = channel?.group || 'สตรีมสด'

  return (
    <View style={styles.overlay} pointerEvents="none">
      <LinearGradient
        colors={['rgba(7, 9, 15, 0.82)', 'rgba(4, 5, 10, 0.96)']}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.center}>
        {/* ป้ายกลุ่มประเภทช่องด้านบน */}
        <View style={styles.badgePill}>
          <View style={styles.liveDot} />
          <Text style={styles.badgeText}>{groupText.toUpperCase()} • BUFFERING</Text>
        </View>

        {/* วงแหวนขนาดใหญ่พิเศษ 260px พร้อมเอฟเฟกต์หมุน 2 ทิศทางและ Ambient Glow */}
        <View style={styles.ringStack}>
          {/* วงแสงเรืองรองนุ่มนวลรอบนอก */}
          <Animated.View
            style={[
              styles.glow,
              {
                opacity: glow,
                transform: [{ scale: pulse }],
              },
            ]}
          />

          {/* วงแหวนนอกสุด สีทอง */}
          <DualSpinRing
            size={260}
            thickness={4}
            color="#F5C518"
            color2="rgba(245, 197, 24, 0.4)"
            duration={2000}
          />

          {/* วงแหวนกลาง หมุนสวนทาง สีฟ้าคราม */}
          <DualSpinRing
            size={210}
            thickness={3}
            color="#00D2FF"
            color2="rgba(0, 210, 255, 0.2)"
            duration={2800}
            reverse
          />

          {/* วงแหวนในสุด ละมุนตา */}
          <DualSpinRing
            size={170}
            thickness={2}
            color="rgba(255, 255, 255, 0.6)"
            color2="transparent"
            duration={1500}
          />

          {/* โลโก้ช่องขนาดใหญ่ใจกลางวงแหวน */}
          <Animated.View style={[styles.avatarWrap, { transform: [{ scale }] }]}>
            <Avatar channel={channel} size={118} />
          </Animated.View>
        </View>

        {/* ชื่อช่องขนาดใหญ่ ชัดเจน อ่านง่ายจากระยะไกล */}
        {channel?.name ? (
          <Text style={styles.channelName} numberOfLines={1}>
            {channel.name}
          </Text>
        ) : null}

        {/* ข้อความสถานะพร้อมจุดบัฟเฟอร์วิ่ง */}
        <View style={styles.messageRow}>
          <Text style={styles.message}>{message}</Text>
          <PulsingDots color="#F5C518" />
        </View>

        {/* หลอดไฟบอกระดับสัญญาณจำลอง */}
        <View style={styles.statusBarWrap}>
          <Animated.View
            style={[
              styles.statusBarInner,
              {
                opacity: glow,
                transform: [{ scaleX: pulse }],
              },
            ]}
          />
        </View>
      </View>
    </View>
  )
}

/** โครงร่างช่องตอนยังโหลดรายการไม่เสร็จ — มีแถบแสงวิ่งผ่าน */
export function RowSkeleton({ index = 0 }) {
  const sweep = useLoop(1400)
  const translateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-theme.size.sidebarWidth, theme.size.sidebarWidth],
  })

  return (
    <View style={[styles.skeletonRow, { opacity: 1 - index * 0.13 }]}>
      <View style={styles.skeletonLogo} />
      <View style={styles.skeletonText}>
        <View style={[styles.skeletonLine, { width: '72%' }]} />
        <View style={[styles.skeletonLine, styles.skeletonLineSmall, { width: '40%' }]} />
      </View>
      <Animated.View style={[styles.sweep, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.07)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
  },
  ringStack: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(245, 197, 24, 0.16)',
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F5C518',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 24, 0.35)',
    marginBottom: 24,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  badgeText: {
    color: '#F5C518',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  channelName: {
    marginTop: 26,
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    maxWidth: 720,
    textAlign: 'center',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  messageRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBarWrap: {
    width: 240,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 24,
    overflow: 'hidden',
  },
  statusBarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#F5C518',
  },
  skeletonRow: {
    height: theme.size.rowHeight,
    marginBottom: 10,
    borderRadius: theme.size.radius,
    backgroundColor: theme.color.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
  skeletonLogo: {
    width: theme.size.logo,
    height: theme.size.logo,
    borderRadius: theme.size.logo * 0.28,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  skeletonText: {
    flex: 1,
    marginLeft: 14,
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skeletonLineSmall: {
    height: 9,
  },
  sweep: {
    ...StyleSheet.absoluteFillObject,
  },
})
