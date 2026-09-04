import { memo, useRef } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
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

  return (
    <Pressable
      focusable
      hasTVPreferredFocus={initialFocusRef.current}
      onFocus={() => onFocus?.(channel)}
      onPress={() => onPress?.(channel)}
      style={styles.pressable}
    >
      {({ focused }) => (
        <View
          style={[
            styles.row,
            isCollapsed && styles.rowCollapsed,
            focused && styles.rowFocused,
            isPlaying && !focused && styles.rowPlaying,
          ]}
        >
          {/* ขยาย logo +20% (ขนาด 46) สวย คม ชัด */}
          <Avatar channel={channel} size={46} />

          {/* ซ่อนข้อความเมื่ออยู่ในโหมด mini rail */}
          {!isCollapsed ? (
            <View style={styles.info}>
              <Text
                style={[styles.name, focused && styles.nameFocused]}
                numberOfLines={1}
              >
                {channel.name}
              </Text>
              {channel.group ? (
                <Text
                  style={[styles.group, focused && styles.groupFocused]}
                  numberOfLines={1}
                >
                  {channel.group}
                </Text>
              ) : null}
            </View>
          ) : null}

          {!isCollapsed && isPlaying ? (
            <View style={[styles.liveDot, focused && styles.liveDotFocused]} />
          ) : null}
        </View>
      )}
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
    marginBottom: 8,
  },
  row: {
    height: 60,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
  },
  rowCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
    gap: 0,
    backgroundColor: 'transparent',
  },
  rowFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
    borderColor: '#FFFFFF',
    shadowColor: '#FFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  rowPlaying: {
    borderColor: 'rgba(124, 140, 255, 0.5)',
    backgroundColor: 'rgba(124, 140, 255, 0.1)',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  nameFocused: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  group: {
    marginTop: 1,
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10,
    fontWeight: '500',
  },
  groupFocused: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF4D6A',
    marginRight: 2,
  },
  liveDotFocused: {
    backgroundColor: '#FF6B81',
  },
})
