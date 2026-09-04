import { useEffect, useState } from 'react'
import { StyleSheet, Text } from 'react-native'
import { theme } from '../theme'

function format(date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

/** นาฬิกามุมบน — เดินตรงนาทีพอดี ไม่ต้องตื่นทุกวินาที */
export function Clock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer
    const tick = () => {
      const date = new Date()
      setNow(date)
      const msToNextMinute = 60_000 - (date.getSeconds() * 1000 + date.getMilliseconds())
      timer = setTimeout(tick, msToNextMinute)
    }
    const first = new Date()
    timer = setTimeout(tick, 60_000 - (first.getSeconds() * 1000 + first.getMilliseconds()))
    return () => clearTimeout(timer)
  }, [])

  return <Text style={styles.clock}>{format(now)}</Text>
}

const styles = StyleSheet.create({
  clock: {
    color: theme.color.textDim,
    fontSize: theme.font.row,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
})
