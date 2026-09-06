import { StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

// ชุดคู่สีสดใสหลากหลายแบบ (คละสี) ตามที่ผู้ใช้ระบุ
const VIBRANT_PALETTES = [
  ['#6366F1', '#4338CA'], // Indigo
  ['#06B6D4', '#0284C7'], // Electric Cyan / Ocean Blue
  ['#10B981', '#047857'], // Emerald
  ['#F59E0B', '#D97706'], // Amber Gold
  ['#EF4444', '#B91C1C'], // Crimson Red
  ['#EC4899', '#BE185D'], // Rose Pink
  ['#8B5CF6', '#6D28D9'], // Purple
  ['#14B8A6', '#0F766E'], // Teal
  ['#F97316', '#C2410C'], // Tangerine Orange
  ['#3B82F6', '#1D4ED8'], // Royal Blue
  ['#84CC16', '#4D7C0F'], // Lime Green
  ['#A855F7', '#7E22CE'], // Violet
  ['#E11D48', '#9F1239'], // Ruby
  ['#0EA5E9', '#0369A1'], // Sky Blue
  ['#D946EF', '#A21CAF'], // Magenta
  ['#22C55E', '#15803D'], // Green
]

function hash(text) {
  let h = 0
  for (let i = 0; i < text.length; i += 1) {
    h = (h << 5) - h + text.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/** ดึงเลขช่อง หรือตัวอักษรภาษาอังกฤษ/ตัวแรกของชื่อช่อง */
function getChannelLabel(channel) {
  if (!channel) return 'TV'
  if (channel.isMain) return '★'
  const name = String(channel.name || '').trim()

  // ดึงหมายเลขช่องออกมาแสดงชัดเจน (เช่น 3, 5, 7, 9, 23, 25, 29, 31, 32, 34, 8, 24, 2)
  const numMatch = name.match(/\d+/)
  if (numMatch) {
    return numMatch[0]
  }

  // กรณีเป็น Thai PBS
  if (/thai\s*pbs/i.test(name)) return '3'

  const chars = [...name]
  return chars[0]?.toUpperCase() || 'TV'
}

/**
 * Icon ช่องแบบสร้างจากตัวเลขช่อง/ตัวอักษร คละสี ขนาดใหญ่ขึ้น +25% ชัดเจนสะใจสไตล์ tvOS
 */
export function Avatar({ channel, size = 52 }) {
  const isMain = channel?.isMain
  const name = channel?.name || 'TV'
  const label = getChannelLabel(channel)
  const colorIndex = hash(name) % VIBRANT_PALETTES.length
  const colors = isMain ? ['#F59E0B', '#B45309'] : VIBRANT_PALETTES[colorIndex]
  const radius = Math.round(size * 0.32)

  // คำนวณขนาดตัวหนังสือ: ขยายใหญ่ขึ้น +25% ถึง +35% ตัวเลขช่องเด่นชัดเต็มตา
  const fontSize = label.length <= 1
    ? Math.round(size * 0.70)
    : label.length === 2
    ? Math.round(size * 0.58)
    : Math.round(size * 0.38)

  const lineHeight = label.length <= 1
    ? Math.round(size * 0.78)
    : label.length === 2
    ? Math.round(size * 0.66)
    : Math.round(size * 0.46)

  return (
    <View style={[styles.wrapper, { width: size, height: size, borderRadius: radius }]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0.1, y: 0.1 }}
        end={{ x: 0.9, y: 0.9 }}
        style={[styles.gradient, { borderRadius: radius }]}
      >
        <Text
          style={[
            styles.letter,
            {
              fontSize,
              lineHeight,
              letterSpacing: label.length === 2 ? -1 : -0.2,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </LinearGradient>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  letter: {
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
})
