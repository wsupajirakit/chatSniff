import { useEffect, useRef, useState } from 'react'
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

const DOT_STEP = 160
const DOT_FADE = 320

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
  const scale = value.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.35] })
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
 * จอโหลดขนาดใหญ่พิเศษระดับภาพยนตร์ (Cinematic Big Loading Screen) สำหรับจอทีวี
 * - แสดงชัดเจนว่ากำลังโหลดช่องใดอยู่ พร้อมโลโก้ขนาดใหญ่ 140px
 * - วงแหวนหมุน 3 ชั้น (340px) พร้อม Ambient Glow
 * - ป้ายบอกสถานะ LIVE HD และชื่อช่องเด่นชัด
 * - Fade Out นุ่มนวลเมื่อภาพวิดีโอมาจริง เพื่อไม่ให้มีจอดำแม้แต่เสี้ยววินาทีเดียว
 */
export function LoadingOverlay({
  channel,
  message = 'กำลังเชื่อมต่อสัญญาณถ่ายทอดสด',
  visible = true,
}) {
  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current
  const [rendered, setRendered] = useState(visible)

  // จัดการการแสดงผลแบบ Fade-In / Fade-Out นุ่มนวล พร้อม Fallback ป้องกันค้าง
  useEffect(() => {
    let active = true
    let fallbackTimer = null

    if (visible) {
      setRendered(true)
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start()
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (active) setRendered(false)
      })

      // Fallback รับประกันว่า LoadingOverlay จะถูกถอดออกเมื่อหมดเวลา Fade-out 100%
      fallbackTimer = setTimeout(() => {
        if (active) setRendered(false)
      }, 400)
    }

    return () => {
      active = false
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
  }, [visible, fadeAnim])

  // แอนิเมชันการหายใจ (Pulse/Breathe) ของโลโก้และแสงเรือง
  const breathe = useLoop(2200, { easing: Easing.inOut(Easing.ease) })
  const scale = breathe.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.06, 1],
  })
  const glow = breathe.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0.9, 0.4],
  })
  const pulse = breathe.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.92, 1.1, 0.92],
  })

  // แอนิเมชันลำแสงวิ่งผ่านหลอดโหลด (Shimmer Sweep)
  const sweep = useLoop(1400, { easing: Easing.inOut(Easing.sin) })
  const sweepTranslateX = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: [-320, 320],
  })

  if (!rendered) return null

  const groupText = channel?.group || 'สตรีมสด'
  const isCh3 = /^(3\s*hd|ช่อง\s*3|ch\s*3|channel\s*3)($|\s)/i.test(String(channel?.name || '').trim())

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim,
        },
      ]}
      pointerEvents="none"
    >
      {/* พื้นหลังไล่เฉดสีดำมืดหรูหรา กลบจอดำสนิท */}
      <LinearGradient
        colors={['rgba(2, 4, 8, 0.88)', 'rgba(2, 4, 8, 0.95)']}
        style={StyleSheet.absoluteFill}
      />

      {/* กล่อง Loading Dialog ขนาดใหญ่ ลอยเด่นกลางจอทีวี */}
      <View style={styles.dialogCard}>
        {/* ป้ายประเภทช่องด้านบน (Pill Tag) */}
        <View style={styles.badgePill}>
          <View style={styles.liveDot} />
          <Text style={styles.badgeText}>
            {groupText.toUpperCase()} • {isCh3 ? 'FULL HD 1080P' : 'LIVE BROADCAST'}
          </Text>
        </View>

        {/* ชุดวงแหวนหมุนรอบโลโก้ช่อง */}
        <View style={styles.ringStack}>
          {/* วงแสงเรืองรอง Ambient Halo */}
          <Animated.View
            style={[
              styles.glow,
              {
                opacity: glow,
                transform: [{ scale: pulse }],
                backgroundColor: isCh3 ? 'rgba(0, 210, 255, 0.25)' : 'rgba(245, 197, 24, 0.25)',
              },
            ]}
          />

          {/* วงแหวนนอก สีทองพรีเมียม 280px */}
          <DualSpinRing
            size={280}
            thickness={4.5}
            color="#F5C518"
            color2="rgba(245, 197, 24, 0.35)"
            duration={2400}
          />

          {/* วงแหวนกลาง สีฟ้าครามไซเบอร์ 220px */}
          <DualSpinRing
            size={220}
            thickness={3.5}
            color="#00D2FF"
            color2="rgba(0, 210, 255, 0.25)"
            duration={3000}
            reverse
          />

          {/* วงแหวนในสุด สีขาวประกาย 170px */}
          <DualSpinRing
            size={170}
            thickness={2.5}
            color="rgba(255, 255, 255, 0.75)"
            color2="transparent"
            duration={1500}
          />

          {/* โลโก้ช่องขนาดใหญ่พิเศษ 120px ตรงกลาง */}
          <Animated.View style={[styles.avatarWrap, { transform: [{ scale }] }]}>
            <Avatar channel={channel} size={120} />
          </Animated.View>
        </View>

        {/* ชื่อช่องขนาดใหญ่มาก 42px คมชัดระดับทีวี 4K */}
        {channel?.name ? (
          <Text style={styles.channelName} numberOfLines={1}>
            {channel.name}
          </Text>
        ) : null}

        {/* ข้อความสถานะพร้อมจุดไฟกระพริบ */}
        <View style={styles.messageRow}>
          <Text style={styles.message}>
            {channel?.name ? `กำลังเชื่อมต่อ ${channel.name}...` : message}
          </Text>
          <PulsingDots color={isCh3 ? '#00D2FF' : '#F5C518'} />
        </View>

        {/* หลอดไฟโหลดพร้อมลำแสงวิ่งผ่าน (Cinematic Shimmer Bar) */}
        <View style={styles.statusBarWrap}>
          <Animated.View
            style={[
              styles.shimmerSweep,
              {
                transform: [{ translateX: sweepTranslateX }],
              },
            ]}
          >
            <LinearGradient
              colors={['transparent', isCh3 ? '#00D2FF' : '#F5C518', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>
    </Animated.View>
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
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -70, // ชดเชย left: 70 ของ playerWrap เพื่อให้กึ่งกลางจอทีวี 100% เป๊ะ
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  dialogCard: {
    width: 580,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 15, 26, 0.96)',
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(0, 210, 255, 0.45)',
    paddingVertical: 36,
    paddingHorizontal: 40,
    shadowColor: '#00D2FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.65,
    shadowRadius: 28,
    elevation: 25,
  },
  ringStack: {
    width: 300,
    height: 300,
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
  },
  avatarWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00D2FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 10,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 24, 0.4)',
    marginBottom: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  badgeText: {
    color: '#F5C518',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  channelName: {
    marginTop: 20,
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    maxWidth: 500,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  messageRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  dots: {
    flexDirection: 'row',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusBarWrap: {
    width: 320,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginTop: 22,
    overflow: 'hidden',
  },
  shimmerSweep: {
    width: 140,
    height: '100%',
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
