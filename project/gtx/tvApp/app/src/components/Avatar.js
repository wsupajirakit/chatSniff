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

/** ดึงตัวอักษรภาษาอังกฤษหรือตัวแรกของชื่อช่อง */
function getInitialChar(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) return 'TV'
  // ค้นหาตัวอักษรหรือตัวเลขแรก
  const chars = [...trimmed]
  return chars[0].toUpperCase()
}

/**
 * Icon ช่องแบบสร้างจากตัวอักษรแรก (Alphabet) คละสี ขนาดใหญ่ ชัดเจน สไตล์ tvOS
 */
export function Avatar({ channel, size = 52 }) {
  const isMain = channel?.isMain
  const name = channel?.name || 'TV'
  const letter = isMain ? '★' : getInitialChar(name)
  const colorIndex = hash(name) % VIBRANT_PALETTES.length
  const colors = isMain ? ['#F59E0B', '#B45309'] : VIBRANT_PALETTES[colorIndex]
  const radius = Math.round(size * 0.32)

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
              fontSize: Math.round(size * 0.48),
              lineHeight: Math.round(size * 0.58),
            },
          ]}
          numberOfLines={1}
        >
          {letter}
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
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  letter: {
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
    includeFontPadding: false,
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
})
