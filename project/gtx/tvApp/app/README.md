# TV Live — แอปดูทีวีสำหรับ Android TV / Apple TV

Expo SDK 57 + `react-native-tvos` 0.86.2 + `expo-video`

## ทำอะไรได้

- แถบช่อง 2 จังหวะ: ย่อเป็นแถบ Avatar ปลอดภัยไม่บังจอวิดีโอ (Safe Margin 70px) และขยายทับเฉพาะตอนเลื่อนดูช่อง
- ช่องหน้าหลัก (Main Channel): เริ่มต้นด้วยภาพนิ่งประจำแอปเมื่อเปิดขึ้นมาครั้งแรก และคงอยู่จนกว่าจะเลือกช่องใหม่
- ป้ายบอกช่องมุมล่างซ้ายขนาดใหญ่ ชัดเจน มองเห็นง่ายบนจอทีวีระยะไกล
- เล่น m3u8 (HLS), mp4, mpd และลิงก์อื่นที่เครื่องรองรับ
- ช่องไม่มีโลโก้ → วาด avatar ตัวอักษรแรกให้ สีล็อกตามชื่อช่อง
- หลังบ้านเพิ่ม/ลบ/แก้ช่อง แอปอัปเดตรายการเองใน ~8 วินาที ไม่ต้องปิดเปิด
- รองรับการ Build Standalone Offline APK ใช้งานได้ทันทีโดยไม่ต้องรัน Metro Bundler

## เริ่มใช้งาน

```bash
cd app
npm install
cp .env.example .env      # แก้ EXPO_PUBLIC_API_URL ให้ชี้ไป backend
```

**ต้อง build เป็นแอปจริง — Expo Go ใช้ไม่ได้** เพราะ TV ต้องใช้ native fork (`react-native-tvos`)

### Android TV

```bash
npm run android
```

สคริปต์ตั้ง `EXPO_TV=1` ให้แล้ว ตัว config plugin จะเติม leanback launcher + TV banner ลง manifest เอง

ลงบนกล่องจริง: เปิด Developer options บนกล่อง → `adb connect <ไอพีกล่อง>:5555` → `npm run android`

### Apple TV

```bash
npm run ios
```

(ต้องมี Xcode และเลือก target เป็น tvOS simulator หรือ Apple TV จริง)

### ถ้าแก้ `app.json` หรือเปลี่ยน native dependency

```bash
npm run prebuild        # สร้าง native project ใหม่ (EXPO_TV=1 + --clean)
```

## ตั้ง URL ของ backend

แก้ `EXPO_PUBLIC_API_URL` ใน `.env`

| รันบนอะไร | ใส่ค่าอะไร |
|---|---|
| Android TV emulator | `http://10.0.2.2:3000` |
| กล่อง/ทีวีจริงในบ้าน | `http://<ไอพีเครื่องที่รัน backend>:3000` |
| ขึ้นเซิร์ฟเวอร์แล้ว | `https://tv-api.your-domain.com` |

`localhost` ใช้ไม่ได้บนกล่องทีวี เพราะ localhost ของกล่องคือตัวกล่องเอง ไม่ใช่เครื่องคุณ

> Android 9 ขึ้นไปบล็อก http ธรรมดาโดยค่าเริ่มต้น — Expo เปิด `usesCleartextTraffic` ให้ใน debug build อยู่แล้ว
> แต่ถ้า build release แล้วต่อ http ไม่ได้ ให้ย้าย backend ไป https

## ปุ่มบนรีโมต

| ปุ่ม | ทำอะไร |
|---|---|
| ▲ ▼ | ไล่ช่องในแถบซ้าย หยุดที่ช่องไหนสักครู่ก็เปลี่ยนไปช่องนั้น |
| OK | เล่นช่องที่เลือกทันที แล้วเก็บแถบให้เลย |
| CH+ / CH- | เปลี่ยนช่องตรงๆ ไม่ต้องเรียกแถบ (วนรอบได้) |
| ปุ่มอื่นๆ | เรียกแถบช่องกลับมา |

## โครงไฟล์

```
App.js                       รวมสถานะทั้งหมด: ช่องที่เล่น, ช่องที่โฟกัส, ตัวจับเวลาซ่อนแถบ
src/theme.js                 สี ขนาด และค่าหน่วงเวลาทั้งแอป แก้ที่เดียว
src/lib/api.js               เรียก backend
src/lib/useChannels.js       โหลดรายการช่อง + คอยเช็คว่าหลังบ้านเปลี่ยนไหม
src/components/Sidebar.js    แถบช่องซ้าย + แอนิเมชันซ่อน/แสดง
src/components/ChannelRow.js หนึ่งแถวช่อง จัดการโฟกัสรีโมต
src/components/Player.js     expo-video + จอ error พร้อมปุ่มลองใหม่
src/components/Loading.js    จอโหลดสลับช่อง + โครงร่างตอนโหลดรายการ
src/components/ChannelBadge.js ป้ายบอกช่องตอนแถบซ่อน
src/components/Avatar.js     โลโก้ช่อง / avatar ตัวอักษรแรก
src/components/Clock.js      นาฬิกามุมบนของแถบ
```

## ปรับพฤติกรรมเร็วๆ

แก้ที่ `src/theme.js`:

```js
channelSwitchDelay: 450,   // หน่วงก่อนเปลี่ยนช่องจริงตอนไถผ่าน
idleHideDelay: 6000,       // ไม่กดอะไรกี่มิลลิวินาที แถบถึงซ่อน
pollInterval: 8000,        // ถามหลังบ้านทุกกี่มิลลิวินาทีว่ารายการช่องเปลี่ยนไหม
```

## เทคนิคและ Best Practices สำหรับ Android TV (Zero Technical Debt)

เพื่อให้แอปทำงานบนชิปเซ็ตของ Android TV จริง (เช่น Toshiba TV, Mi TV, Sony Bravia) ได้อย่างลื่นไหล 60 FPS และไม่แครช ได้มีการปฏิบัติตามข้อกำหนดทางการของ AOSP Leanback และ `react-native-tvos` ดังนี้:

### 1. การจัดการ Native Focus และ D-pad ไม่ให้ค้างหรือดีดเด้งไปมา
* **`removeClippedSubviews={false}`**: ค่าเริ่มต้นของ Android จะตัด View นอกจอทิ้งเพื่อประหยัด RAM มือถือ แต่บน TV การกดรีโมตต้องค้นหา View ถัดไปใน Native View Hierarchy (`FocusFinder`) หาก View ถูกตัดทิ้ง โฟกัสจะค้างหรือดีดกลับไปที่จุดเริ่มต้น (Index 0) จึงต้องปิดเป็น `false` เสมอ
* **`getItemLayout`**: ล็อกขนาดแน่นอนของแถวช่อง (`length: 68, offset: 68 * index`) เพื่อให้ FlatList รู้พิกัดทันทีโดยไม่ต้องคำนวณแบบ Asynchronous ใน JS Thread ทำให้การตอบสนองต่อรีโมตลื่นไหลเต็ม 60 FPS
* **ไม่ใช้ `scrollToIndex` แย่งกับ Native**: ปล่อยให้ Android TV Focus Engine เลื่อน viewport ตามตำแหน่งโฟกัสโดยตรง ไม่สั่ง `scrollToIndex({ animated: true })` ใน JS เพื่อป้องกันภาวะ Race Condition ที่ทำให้จอสั่นกระตุก
* **ไม่ผูก `key` ที่ทำให้ Remount ทั้งแผง**: ตัด `key={focusEpoch}` ออก เพื่อรักษา Native View Tree ให้คงที่ตลอดการสลับช่อง

### 2. ป้องกันตัวถอดรหัสวิดีโอชนกันจนแอป Force Close (MediaCodec Thrashing)
* **Debounce การสลับสัญญาณ 450ms**: เมื่อผู้ใช้กด D-pad เลื่อนช่องรวดเร็ว แถบโฟกัสจะกระโดดตอบสนองทันทีที่ 60 FPS โดยยังไม่สั่งให้ Player สลับสัญญาณ เมื่อหยุดดูเกิน 450ms หรือกดปุ่ม `OK / Select` จึงสั่งเริ่มเล่นทันที (0ms) ป้องกันการเปิด MediaCodec ซ้อนกันจน RAM ระดับ Native หมด
* **`android:largeHeap="true"` ใน `AndroidManifest.xml`**: ขยายเพดาน Memory Heap ของระบบ Android เพื่อรองรับการบัฟเฟอร์ HLS Video สตรีมความละเอียดสูง
* **รองรับ 32-bit (`armeabi-v7a`)**: ใน `gradle.properties` ตั้ง `reactNativeArchitectures=armeabi-v7a,arm64-v8a` ทำให้แอปมีไลบรารี Native C++ (`libexpo-modules-core.so`) ครบถ้วนบนชิปเซ็ตทีวี 32-bit ของ Toshiba และแบรนด์อื่นๆ

### 3. UI/UX สไตล์ Luxury TV
* **ป้ายช่อง OSD**: ตัดเลขลำดับช่อง (`01, 02, ...`) ออก เหลือเฉพาะโลโก้, ชื่อช่องขนาด 28px และสถานะ `LIVE · ประเภท`
* **หน้าโหลดบัฟเฟอร์ขนาดใหญ่ (Luxury Buffering Screen)**: วงแหวนคู่ทอง-ฟ้าครามขนาด 260px พร้อม Ambient Glow, โลโก้ช่อง 118px และจุดวิ่ง ที่รันบน Native Animation Driver 100%

---

## วิธี Build Standalone Offline APK (ไม่ต้องต่อ Metro)

1. Export JS Bundle และ Assets แบบออฟไลน์:
```bash
npx expo export -p android --output-dir dist
cp dist/_expo/static/js/android/index-*.hbc android/app/src/main/assets/index.android.bundle
cp -r dist/assets android/app/src/main/assets/
```

2. สั่งคอมไพล์ Release APK ด้วย Gradle:
```bash
cd android
./gradlew assembleRelease --no-daemon
```

3. ไฟล์ APK ที่ได้จะอยู่ที่:
`android/app/build/outputs/apk/release/app-release.apk`
สามารถนำไปติดตั้งบน Android TV Box ด้วย `adb install -r <path-to-apk>` หรือใส่ Flash Drive ติดตั้งตรงได้ทันทีครับ

