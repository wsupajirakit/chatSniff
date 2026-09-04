/** โทนสีและระยะห่างทั้งแอป — แก้ที่เดียวเปลี่ยนทั้งหมด */
export const theme = {
  color: {
    bg: '#07090F',
    panel: 'rgba(11, 14, 22, 0.94)',
    panelSolid: '#0B0E16',
    card: 'rgba(255, 255, 255, 0.04)',
    cardFocused: 'rgba(124, 140, 255, 0.16)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderFocused: '#7C8CFF',
    accent: '#7C8CFF',
    accentSoft: 'rgba(124, 140, 255, 0.25)',
    live: '#FF4D6A',
    text: '#F2F5FC',
    textDim: '#98A2B8',
    textFaint: '#5C6577',
  },
  // ทีวีนั่งดูไกล ตัวอักษรและระยะห่างต้องใหญ่กว่ามือถือ
  size: {
    sidebarWidth: 380,
    rowHeight: 84,
    logo: 56,
    radius: 16,
    gutter: 24,
  },
  font: {
    title: 30,
    row: 21,
    label: 15,
    tiny: 12,
  },
  /** หน่วงก่อนเปลี่ยนช่องจริง ตอนกดขึ้นลงรัวๆ จะได้ไม่โหลดทุกช่องที่ไถผ่าน */
  channelSwitchDelay: 450,
  /** ไม่กดอะไรกี่มิลลิวินาที แถบซ้ายถึงจะซ่อนเอง */
  idleHideDelay: 6000,
  /** ถามเซิร์ฟเวอร์ทุกกี่มิลลิวินาทีว่ารายการช่องเปลี่ยนไหม */
  pollInterval: 8000,
}
