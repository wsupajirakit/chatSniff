import { memo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Avatar } from './Avatar'

function ChannelRowBase({
  channel,
  isPlaying,
  preferFocus,
  isCollapsed = false,
  onFocus,
  onPress,
}) {
  const initialFocusRef = useRef(preferFocus)
  const [isHovered, setIsHovered] = useState(false)

  return (
    <Pressable
      focusable
      hasTVPreferredFocus={initialFocusRef.current}
      onFocus={() => onFocus?.(channel)}
      onHoverIn={() => {
        setIsHovered(true)
        onFocus?.(channel)
      }}
      onHoverOut={() => setIsHovered(false)}
      onPress={() => onPress?.(channel)}
      style={styles.pressable}
    >
      {({ focused, hovered }) => {
        const isHighlighted = Boolean(focused || hovered || isHovered)

        return (
          <View
            style={[
              styles.row,
              isCollapsed && styles.rowCollapsed,
              isHighlighted && styles.rowFocused,
              isPlaying && !isHighlighted && styles.rowPlaying,
            ]}
          >
            {/* แถบนีออนบอกตำแหน่งโฟกัส/hover เด่นชัดทางซ้ายมือ สไตล์ Leanback TV */}
            {isHighlighted && !isCollapsed ? (
              <View style={styles.focusPill} />
            ) : null}

            {/* ขยาย logo ขนาด 52 สวย คม ชัด เลขช่องใหญ่ขึ้น +25% เด่นสะใจ พร้อมกรอบเรืองแสงเมื่อโฟกัส/hover */}
            <View style={[styles.avatarWrap, isHighlighted && styles.avatarWrapFocused]}>
              <Avatar channel={channel} size={52} />
            </View>

            {/* ซ่อนข้อความเมื่ออยู่ในโหมด mini rail */}
            {!isCollapsed ? (
              <View style={styles.info}>
                <Text
                  style={[styles.name, isHighlighted && styles.nameFocused]}
                  numberOfLines={1}
                >
                  {channel.name}
                </Text>
                {channel.group ? (
                  <Text
                    style={[styles.group, isHighlighted && styles.groupFocused]}
                    numberOfLines={1}
                  >
                    {channel.group}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {!isCollapsed && isPlaying ? (
              <View style={[styles.liveDot, isHighlighted && styles.liveDotFocused]} />
            ) : null}
          </View>
        )
      }}
    </Pressable>
  )
}

export const ChannelRow = memo(
  ChannelRowBase,
  (prev, next) =>
    prev.channel.id === next.channel.id &&
    prev.channel.name === next.channel.name &&
    prev.channel.group === next.channel.group &&
    prev.isPlaying === next.isPlaying &&
    prev.isCollapsed === next.isCollapsed,
)

const styles = StyleSheet.create({
  pressable: {
    marginBottom: 6,
    cursor: 'pointer',
  },
  row: {
    height: 64,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 11,
  },
  rowCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 0,
    backgroundColor: 'transparent',
  },
  rowFocused: {
    backgroundColor: '#2563EB', // สีน้ำเงินสว่างสดใส (Vivid Electric Royal Blue) ชัดเจน 100% ไม่มืด ไม่กลืน
    borderColor: '#00FFFF',     // ขอบนีออน Electric Cyan หนา 4px สว่างจ้า เด่นสะดุดตาจากระยะไกล 3-4 เมตร
    borderWidth: 4,
    shadowColor: '#00FFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 20,
  },
  rowPlaying: {
    borderColor: 'rgba(124, 140, 255, 0.65)',
    backgroundColor: 'rgba(124, 140, 255, 0.15)',
  },
  focusPill: {
    position: 'absolute',
    left: 4,
    top: 8,
    bottom: 8,
    width: 7,
    borderRadius: 3.5,
    backgroundColor: '#00FFFF',
    shadowColor: '#00FFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 12,
  },
  avatarWrap: {
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  avatarWrapFocused: {
    borderColor: '#00FFFF',
    borderWidth: 3,
    shadowColor: '#00FFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    color: 'rgba(255, 255, 255, 0.90)',
    fontSize: 16, // ใหญ่ขึ้นชัดเจน
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  nameFocused: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 18, // ใหญ่ขึ้น +28.5% หนาคมชัด สะดุดตา ไม่พลาดแน่นอน
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  group: {
    marginTop: 1,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 11.5,
    fontWeight: '500',
  },
  groupFocused: {
    color: '#BAE6FD',
    fontWeight: '800',
    fontSize: 13,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF4D6A',
    marginRight: 2,
  },
  liveDotFocused: {
    backgroundColor: '#FF2E55',
    shadowColor: '#FF4D6A',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 6,
  },
})

