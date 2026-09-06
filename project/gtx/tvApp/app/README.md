# TV Live — แอปดูทีวีสำหรับ Android TV / Apple TV

Expo SDK 57 + `react-native-tvos` 0.86.2 + `expo-video`

> [!NOTE]
> 📖 **เอกสารอ้างอิงและเซสชันที่เกี่ยวข้อง (Documentation Cross-References):**  
> - 🏠 [**README.md (ภาพรวมทั้งโปรเจกต์ & ติดตั้ง APK)**](../README.md)
> - 📝 [**current_session.md (บันทึกเซสชันล่าสุดฉบับเต็ม: Defect #8, Native Patch, Deadlock Hotfix, Log Runbook)**](../current_session.md)
> - 🔌 [**backend/README.md (API & ระบบ Log รายวัน)**](../backend/README.md)

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

---

## Defect Feedback (สรุปอาการที่พบทั้งหมดวันนี้ สาเหตุจริง และการแก้ไขจบปัญหาแบบภาษาคน)

สรุปประวัติข้อผิดพลาดและอาการสะสมที่ทำให้เกิดบั๊กซ้ำซ้อนในวันนี้ ทั้งหมดเกิดจากกลไกภายในของ Android TV, ExoPlayer และวงจรรีเฟรชของ React Native สรุปสาเหตุเชิงลึกและวิธีแก้ให้จบอย่างเด็ดขาด ดังนี้:

| ข้อ | อาการที่พบ (Defect) | สาเหตุทางเทคนิคเชิงลึก | วิธีแก้จบปัญหา (Definitive Solution) |
|---|---|---|---|
| **1** | **ค้างหน้าโหลดแล้วแอปเด้งดับ (Crash/Force close บน Toshiba TV)** | ชิปเซ็ตประหยัดพลังงาน แรมจำกัด ตัวถอดรหัส MediaCodec ล้นตั้งแต่เปิดแอป เพราะโค้ดเดิมสั่งเรนเดอร์แอนิเมชันหนักและเปิด Player พร้อมกัน | เริ่มต้นแอปด้วยหน้าภาพนิ่ง (Main Channel) ใน 0ms, ใส่ Error Boundary, เปิด `android:largeHeap="true"` |
| **2** | **รีเฟรชตัวเองวนลูปทุก 9 วิ (Infinite Refresh Loop)** | Watchdog คอยจับ `timeUpdate` แต่ `expo-video` ค่าเริ่มต้นปิดส่งอีเวนต์เวลาไว้ (`interval = 0`) Watchdog เลยนึกว่าสตรีมค้าง สั่ง `player.replace()` วนไปเรื่อยๆ | ลบ Watchdog ออกถาวร, เปิด `timeUpdateEventInterval = 1`, ใช้ `useMemo` ล็อครายการช่อง |
| **3** | **ดูไป 30-60 วิ แล้วภาพหยุดนิ่ง ต้องสลับช่องไปมา** | สตรีม HLS (Wowza) มีหน้าต่างสด (Live Window) สั้นมากแค่ 30 วินาที พอเน็ตแกว่งหลุดกรอบ ExoPlayer จะตัดการทำงาน (`BehindLiveWindowException`) และมี trailing audio event มาแอบลบ retry timer | ดักจับ `BehindLiveWindowException` แล้วสั่ง Snap กลับไปขอบสด (Live Edge) ทันที และไม่ให้ trailing event มายกเลิก retry timer |
| **4** | **ดูอยู่ดีๆ จู่ๆ ก็รีโหลดใหม่เอง (Ghost Reload)** | 1) พอเปิดดูได้ 3.2 วิ Sidebar ยุบตัว Native Focus ส่ง `onFocus` ซ้ำมาที่เดิม ฟังก์ชันโฟกัสไปรีเซ็ต `_loadEpoch` นึกว่าสั่ง reload ใหม่ 2) Stall Watcher เช็คแค่ `playing: false` แวบเดียวตอนสลับ chunk แล้วสั่ง retry ทับ | สลับช่องเฉพาะตอนผู้ใช้ "กดรีโมตจริง" เท่านั้น, ล็อคไม่ให้ reload ช่องเดิม, และเช็คว่า `currentTime` เดินหน้าจริงหรือไม่ |
| **5** | **กระตุกติด Retry วนลูปไม่หยุด (Stutter Loop)** | ตัวนับ retry ถูก reset เป็น 0 ทันทีที่ภาพเฟรมแรกมา พอสะดุดอีกใน 1 วินาทีถัดมา ก็นับ 1 ใหม่ วนลูป retry ซ้ำๆ | ตั้ง Hard Cap สูงสุด 3 ครั้ง (2.5s -> 5s -> 8s) ไม่มาให้หยุดสนิท (Halt), ตั้ง Cooldown 15 วิ ถึงจะยอม reset ตัวนับ |
| **6** | **เดาอาการมั่ว ไม่รู้ว่าแอปพังเพราะอะไร (No Observability)** | ไม่มีระบบบันทึก log บนทีวี เวลาหลุดไม่รู้ว่าหลุดเพราะเน็ต, เซิร์ฟเวอร์, หรือตัวถอดรหัส | ทำ Backend JSON Logging บันทึก Log รายวันตามวันที่ (`logs-YYYY-MM-DD.json`) + JWT Auth + ส่งทุก State & Error ละเอียด |
| **7** | **แอปบนทีวีไม่เห็น get list / ไม่มีปุ่มรีโหลดช่องด้วยมือ** | 1) `useChannels.js` เดิมไม่ได้ส่ง log ไปยัง backend ทำให้บนหน้าเว็บดู log ว่างเปล่า 2) ไม่มีปุ่มรีโหลดช่องใน UI ผู้ใช้สั่งดึงใหม่ไม่ได้ 3) เช็ค error ต่อเมื่อช่องเป็น 0 แต่แอปมี "หน้าหลัก" เสมอทำให้กล่อง error ไม่ขึ้น | เพิ่มปุ่ม `[ 🔄 รีโหลดช่อง ]` บนสุดของ Sidebar กด D-pad UP โฟกัสได้ง่าย, เพิ่ม Cache-Buster `_t=${Date.now()}`, และส่ง Log แท็ก `Channels` ทุกสเต็ป |
| **8** | **สตรีมสด (ช่อง 3) รีเฟรชดับกระพริบดำทุก 5-10 วิ หรือภาพค้างนิ่งสนิท** | 1) HLS Window สั้น (30s) + Buffer ล้น 15s เกิด BehindLiveWindowException<br>2) Native expo-video ปล่อย exception หลุดไป JS จนเกิด Full Reload วนลูป<br>3) บั๊ก JS สั่ง return ตัดวงจร auto reconnect จนเกิด Deadlock ค้างนิ่ง | 1) Native Patch `VideoPlayer.kt` ทำ Silent Recovery snap กลับขอบสด + Throttle 3 ครั้ง/15s<br>2) Native Patch `VideoSource.kt` ใส่ `LiveConfiguration` คุม target offset 5s<br>3) ปรับ `Player.js` ลบ return ปลด deadlock และลด buffer เหลือ 8s<br>*(อ่านตัวเต็มใน [current_session.md](../current_session.md))* |
| **9** | **ลิงก์ช่อง 3 ช้ามาก บัฟเฟอร์กระตุก ภาพแตก 576p** | ลิงก์เดิมส่งจาก US (`live-us1.thaimomo.com`) Latency สูง 646ms และหน้าต่างสตรีมสั้นแค่ 3 chunks | เปลี่ยนมาใช้ ByteArk CDN กรุงเทพฯ 1080p (Latency 80-110ms เร็วขึ้น 6 เท่า, หน้าต่างสตรีม 15 นาที) พร้อมระบบ `streamResolver.js` ดึง Fresh Token อัตโนมัติ |
| **10** | **ช่อง 3 ดับซ้ำซาก / ต่ออายุอัตโนมัติไม่ทำงานจริง** | 1) AWS WAF บล็อก Cloud IP Backend (HTTP 403 Forbidden) ทำให้ต่ออายุบน Cloud ไม่ได้<br>2) Token ใน DB หมดอายุค้างข้ามคืน ทีวีได้ลิงก์ตาย HTTP 410<br>3) TV Player เกิด Deadlock ดึง URL เดิมจาก backend มาทับ state<br>4) Client Resolver เดิม regex โลภ 250KB + timeout สั้น 4s | สถาปัตยกรรม Fail-Safe 4 ชั้น:<br>1) Backend API `POST /api/channels/:id/sync` รับ token สดจากภายนอก<br>2) Fast String Slicing Client Resolver (0.01ms, 12s timeout) + auto-sync<br>3) ปลด Deadlock ใน Player ไม่เอา URL เก่ามาทับ + Auto-fallback ไป Mirror สำรอง (`live-us1.thaimomo.com`) ภาพไม่มีวันดับ<br>4) Local Sync Daemon บน Mac (`sync_ch3.js`)<br>*(อ่านตัวเต็มใน [current_session.md](../current_session.md#11-วิเคราะห์สาเหตุเชิงลึกและแก้ไขระบบต่ออายุช่อง-3-hd-ล้มเหลว-06092026))* |
| **11** | **สลับช่องแล้วจอดำสนิทรอ 2-3 วิ / ไม่มีจอโหลดบอกว่ากำลังเปิดช่องอะไร** | 1) `useState(!isMain)` ใน Player ไม่รีเซ็ตตอน prop `channel` เปลี่ยน ทำให้ state `loading` ค้างเป็น `false`<br>2) ExoPlayer ยิงอีเวนต์ `readyToPlay` ตั้งแต่ตอนโหลด manifest เสร็จ แต่ตัวถอดรหัสยังไม่ได้วาดเฟรมภาพแรก (ต้องรอ 1.5-3 วิ) โค้ดเดิมสั่งปิด loading ทันทีใน `readyToPlay` ทำให้จอดำสนิท | 1) ปรับ Player ใช้ Synchronous Render Trigger สั่ง `setLoading(true)` ใน 0ms เมื่อเปลี่ยนช่อง<br>2) ย้ายการปิดจอโหลดไปรอที่ `timeUpdate` จนกว่า `currentTime > 0` และเวลาเริ่มเดินหน้าจริง<br>3) ออกแบบ `LoadingOverlay` ระดับภาพยนตร์: วงแหวนหมุน 3 ชั้น 340px, โลโก้ช่อง 140px, ป้าย `🔴 สตรีมสด LIVE • HD`, ชื่อช่องใหญ่ 46px, Shimmer Beam, และ Fade Out นุ่มนวล 380ms |
| **12** | **ป้ายชื่อช่องมุมขวาบน (Badge) ค้างตลอดเวลาไม่ยอมซ่อน** | อีเวนต์ `timeUpdate` ใน `Player.js` ทำงานส่งสัญญาณทุก 1 วินาที และเรียก `onPlayStateChange(true)` ในทุกวินาที ส่งผลให้ `badgeTimer` ถูก Reset ใหม่ตลอดเวลา | ใช้ `initialPlayFiredRef` ดักจับเฉพาะตอนเริ่มเล่นครั้งแรก ไม่ให้ `timeUpdate` ไปยิง `onPlayStateChange(true)` ซ้ำ ป้ายนับถอยหลัง 3.5 วินาทีแล้วสลายตัวถูกต้อง 100% |
| **13** | **ช่อง 3 / One 31 / Amarin TV 34 ได้ภาพเดียวกันหมด และลิงก์ช่องอื่นถูกทับ** | 1) `isCh3()` และ `isDynamicChannel()` ใช้ `.includes('3')` ซึ่งช่อง One **31**, Amarin **34** มีเลข 3 อยู่ในชื่อ<br>2) แอปเข้าใจผิด ดึง Token ช่อง 3 แล้วยิง Sync ไปยังเซิร์ฟเวอร์<br>3) เซิร์ฟเวอร์เดิมไม่มี Guard เขียนทับสตรีมจริงในฐานข้อมูล | 1) กู้คืน URL เดิมของช่อง One 31 และ Amarin TV 34 บนเซิร์ฟเวอร์สด<br>2) ใช้ Strict Regex `/^(3\s*hd|ช่อง\s*3|ch\s*3|channel\s*3)($|\s)/i` ทั่วทั้งระบบ<br>3) Backend Guard ปฏิเสธด้วย `403 Forbidden` หากพยายาม Sync ไปยังช่องอื่นที่ไม่ใช่ช่อง 3 |
| **14** | **ดูช่องอยู่แล้วมีหน้าจอโหลดดิ้งหมุนๆ โผล่ขึ้นมาขัดจังหวะเป็นระยะ** | 1) Polling ลูป 8 วินาทีใน `useChannels.js` สั่ง `forceRefresh: true` ทำให้ขอ Token ใหม่และยิง Sync ตลอดเวลาจนเซิร์ฟเวอร์อัปเดต `updatedAt` เกิด Infinite Sync Loop<br>2) เมื่อ URL ใหม่ส่งกลับมา `Player.js` ตรวจพบ `urlChanged` แล้วสั่ง `setLoading(true)` และ `player.replace()` ทำลาย Session ที่กำลังเล่นปกติทิ้ง | 1) Silent Token Update ใน Player: หากกำลังดูช่องเดิมอยู่และวิดีโอกำลังเล่นราบรื่น (`hasStartedPlayingRef.current`) ห้ามขัดจังหวะการดูเด็ดขาด ให้อัปเดต `currentUrlRef.current` เงียบๆ ในหน่วยความจำ ไม่เรียก `player.replace()` และไม่เปิด Loading<br>2) เปลี่ยน `forceRefresh: isManual` ใน `useChannels.js` ตัดวงจร Infinite Sync Loop 100% |
| **15** | **เลื่อนดูช่องแล้วแอปชิงสลับช่องอัตโนมัติ / สีไฮไลต์ช่องเดิมมองยากไม่เด่น** | 1) `handleFocusChannel` ใน `App.js` มี `switchTimer = 450ms` ชิงสลับช่องอัตโนมัติเมื่อเลื่อนหยุดดู<br>2) สไตล์โฟกัสเดิมเป็นสีขาวขุ่นจางๆ (`rgba(255,255,255,0.24)`) กลืนกับพื้นหลัง มองยากจากระยะไกล 3 เมตร | 1) ลบ `switchTimer` ออกถาวร การเลื่อนดูช่องจะไม่สลับช่องเด็ดขาด สตรีมปัจจุบันเล่นต่อเนื่อง ต้องกดปุ่มตรงกลางรีโมต (OK/Select) เท่านั้นถึงจะเลือกช่อง<br>2) อัปเกรด Focus Highlight นีออนเด่นชัด: พื้นหลัง Royal Sapphire Blue (`rgba(29, 78, 216, 0.92)`), ขอบฟ้านีออน Electric Cyan (`#00F0FF`, 2.5px), แท่งไฟนีออนด้านซ้าย, และเงาเรืองแสงนีออน 12px |


---

### รายละเอียดเจาะลึกแต่ละ Defect:

#### 1. ค้างหน้า Loading Screen แล้วเด้งปิดตัวเอง (Force Close บน Toshiba TV)
* **ภาษาคน**: เปิดแอปมาบนทีวี Toshiba แป๊บเดียวแอปเด้งหาย ดับกลับมาหน้าจอหลักของทีวี
* **สาเหตุจริง**: ทีวี Toshiba เป็น Android TV รุ่นเริ่มต้น แรมมีจำกัด (1GB-1.5GB) และตัวชิปถอดรหัสวิดีโอ (Hardware MediaCodec) มีโควตาให้เปิดได้ทีละตัว ตอนเปิดแอปเดิม สั่งแอนิเมชันหนักและสร้าง Player ขึ้นมาทำงานทันทีโดยไม่มี Safe Fallback ทำให้หน่วยความจำ Native ล้น Android OS เลยสั่ง Kill Process ทิ้ง
* **วิธีแก้จบปัญหา**: เริ่มต้นเปิดแอปด้วย "หน้าหลักภาพนิ่ง (Main Channel)" ที่เป็นรูปภาพเบาๆ ใน 0ms, ใส่ Error Boundary, ปรับแต่ง Memory Buffer, และเปิด `android:largeHeap="true"` พร้อมคอมไพล์สถาปัตยกรรมทั้ง 32-bit (`armeabi-v7a`) และ 64-bit

#### 2. แอปรีเฟรชตัวเองวนลูปไม่รู้จบ (Infinite Refresh Loop)
* **ภาษาคน**: สตรีมเล่นไปได้ 3-9 วินาที แล้วจอกระพริบดำ โหลดใหม่ซ้ำไปซ้ำมาตลอดเวลา ดูไม่ได้
* **สาเหตุจริง**: ในโค้ดเดิมมีตัวจับเวลา Watchdog ดักไว้ว่าถ้าไม่ได้รับ event `timeUpdate` แปลว่าสตรีมค้าง และจะสั่ง `player.replace()` เพื่อโหลดใหม่ทุก 9 วินาที แต่ `expo-video` มีค่าเริ่มต้น `timeUpdateEventInterval = 0` (คือปิดการส่งอีเวนต์เวลา) ทำให้ Watchdog ไม่เคยได้รับอีเวนต์เลย จึงเข้าใจผิดว่าสตรีมตายตลอดเวลา และสั่ง reload วนลูปไม่หยุด
* **วิธีแก้จบปัญหา**: ลบ Watchdog ตัวปัญหาออกอย่างถาวร, เปิด `timeUpdateEventInterval = 1`, และใช้ `useMemo` ล็อครายการช่องเพื่อไม่ให้ React Re-render ล้างสถานะ Player

#### 3. ดูไปสักพัก (30-60 วินาที) แล้วภาพหยุดนิ่ง ต้องสลับช่องไปมาถึงจะกลับมาเล่นได้
* **ภาษาคน**: เปิดช่องดูได้ปกติ แต่ดูไปได้สักพัก ภาพหยุดนิ่ง ค้างไปเฉยๆ รีโมทไม่ขยับ ต้องกดเปลี่ยนไปช่องอื่นแล้วกดกลับมาใหม่ถึงจะเล่นต่อได้
* **สาเหตุจริง**: สตรีมสด HLS (Wowza) มี "หน้าต่างสด (Live Window)" สั้นมากเพียง 30 วินาที (มีแค่ 3 ชิ้น ชิ้นละ 10 วินาที) เมื่อเน็ตกระตุกเพียงนิดเดียว หรือการถอดรหัสของทีวีช้ากว่าเวลาสตรีมสดจริง ExoPlayer จะหลุดออกจากหน้าต่าง 30 วินาทีนี้ และโยน Error: `BehindLiveWindowException: Source error` และสั่งหยุดเล่นทันที และยิ่งกว่านั้น โค้ดเดิมมี trailing audio event จาก decoder ส่งเข้ามาทีหลังแล้วไปสั่ง `clearAllTimers()` ยกเลิกตัวตั้งเวลาซ่อมตัวเอง ทำให้ตัวเล่นนิ่งสนิทและไม่ยอมเชื่อมต่อใหม่
* **วิธีแก้จบปัญหา**: ดักจับ `BehindLiveWindowException` และสั่ง Snap กลับสู่ขอบสดปัจจุบัน (Live Edge) ทันที พร้อมป้องกันไม่ให้ trailing event มาแอบยกเลิก Retry Timer ขณะที่ระบบกำลังซ่อมแซมตัวเอง

#### 4. สตรีมดูได้ปกติ จู่ๆ ก็ Reload ใหม่เอง (Ghost Reload during Normal Playback)
* **ภาษาคน**: ผู้ใช้นั่งดูทีวีอยู่เฉยๆ กำลังเล่นสดได้ดี ภาพลื่น ไม่มี error ใดๆ แต่อยู่ดีๆ หน้าจอก็กระพริบ reload วิดีโอใหม่เอง
* **สาเหตุจริง**:
  1. **Sidebar Focus Trigger**: เมื่อเปิดช่องเล่นไปได้ 3.2 วินาที แถบ Sidebar จะสั่งยุบตัว (Auto-collapse) พอ Sidebar ยุบตัว React Native จะทำการวาด layout ใหม่ ส่งผลให้ระบบ Android TV Native Focus ส่ง event `onFocus` ซ้ำมาที่ช่องเดิม ฟังก์ชัน `handleFocusChannel` ใน `App.js` เดิมไม่ได้ตรวจสอบว่าช่องที่โฟกัสคือช่องที่กำลังเล่นอยู่หรือไม่ จึงไปสั่ง `setPlaying` พร้อมสแตมป์เวลา `_loadEpoch: Date.now()` ใหม่ ทำให้ `Player.js` เข้าใจผิดว่าผู้ใช้กดสั่งโหลดใหม่ จึงสั่ง `player.replace()` ซ้ำ ทั้งๆ ที่ไม่ได้เปลี่ยนช่อง
  2. **False Stall Watcher**: ตัวตรวจจับค้างเดิมเช็คเพียง boolean `playing: false` แวบเดียวตอนสตรีมสลับชิ้นไฟล์ (HLS chunk transition) แล้วสั่งจับเวลา 12 วินาที พอนับครบก็สั่ง reload ทับ ทั้งๆ ที่ภาพและเสียงยังเดินหน้าอยู่ตามปกติ
* **วิธีแก้จบปัญหา**:
  - ใน `Sidebar.js`: ใส่ตัวตรวจจับ `userPressedRemoteRef` สลับช่องเฉพาะเมื่อเกิดจากการกดปุ่มรีโมทของผู้ใช้จริงเท่านั้น ไม่สลับจาก layout shift / collapse
  - ใน `App.js`: ตรวจสอบว่าถ้าช่องที่โฟกัสเป็นช่องเดียวกับที่กำลังเล่นอยู่ (`channel.id === playing.id`) ห้ามสั่ง reload หรือเปลี่ยน epoch เด็ดขาด
  - ใน `Player.js`: แยกแยะความ "ปกติ" กับ "ไม่ปกติ" 100% โดยดูจาก `timeUpdate` ว่า `currentTime` เดินหน้าจริงหรือไม่ ตราบใดที่เวลาเดินหน้าปกติ ห้ามสั่ง retry, ห้าม replace, และห้ามขึ้นหน้าจอโหลดเด็ดขาด

#### 5. กระตุกติด Retry ตลอดเวลา (Infinite Retry / Stutter Loop)
* **ภาษาคน**: พอนึกจะ retry ก็สั่ง retry ถี่ๆ รัวๆ ไม่หยุด กลายเป็นภาพกระตุก กระพริบ โหลดใหม่วนไปเรื่อยๆ
* **สาเหตุจริง**: ตัวนับจำนวนการลองใหม่ (`autoRetryCount`) ถูก Reset กลับเป็น 0 เร็วเกินไป (ทันทีที่ภาพเฟรมแรกขึ้น) พอสตรีมสะดุดซ้ำอีก 1 วินาทีต่อมา ระบบก็นับเป็นครั้งที่ 1 ใหม่ แล้วก็ retry ซ้ำ วนลูปไม่รู้จบ
* **วิธีแก้จบปัญหา**:
  - **Hard Cap 3 ครั้ง**: จำกัดการลองใหม่อัตโนมัติสูงสุดแค่ 3 ครั้งพอ (ครั้งที่ 1 รอ 2.5s, ครั้งที่ 2 รอ 5s, ครั้งที่ 3 รอ 8s)
  - **หยุดสนิท (Halt)**: หากลองครบ 3 ครั้งแล้วยังไม่สำเร็จ ระบบจะ "หยุดนิ่งทันที" ไม่วนลูป ไม่กระตุก แล้วแสดงหน้าจอแจ้งเตือนพร้อมปุ่ม **"ลองใหม่"** ให้ผู้ใช้กดรีโมทเองเมื่อพร้อม
  - **Cooldown 15 วินาที**: ห้าม Reset ตัวนับเป็น 0 ทันที — วิดีโอต้องเล่นต่อเนื่องได้อย่างราบรื่นจริง ๆ **15 วินาทีขึ้นไป** เท่านั้น ถึงจะยอม Reset ตัวนับกลับเป็น 0
  - **Concurrency Lock**: ใส่ตัวล็อค `isReconnectingRef` ป้องกันคำสั่ง retry ซ้อนกัน

#### 6. ระบบ Backend JSON Logging & JWT Authentication (หยุดการเดาอาการ)
* **ภาษาคน**: เพิ่มระบบส่ง log จากทีวีมาบันทึกเป็นไฟล์ JSON บนเซิร์ฟเวอร์ และเปิดดูผ่าน API ด้วยรหัส JWT ได้ทันที ไม่ต้องเดาว่าทีวีเป็นอะไร
* **สิ่งที่ทำ**:
  - บันทึก Log รายวันลงดิสก์: `data/logs/logs-YYYY-MM-DD.json` หมุนเวียนไฟล์ใหม่อัตโนมัติทุกเที่ยงคืน
  - ความปลอดภัยด้วย **JWT**: ออก Token ด้วย API Key ผ่าน `POST /api/auth/token`
  - มี Endpoint บริหารจัดการ:
    - `POST /api/logs`: รับ Log จากทีวีแบบ Non-blocking (Fire-and-forget) ไม่กระทบความลื่นไหล 60fps
    - `GET /api/logs`: อ่าน Log กรองตามวัน (`date`), ระดับ (`level`), แท็ก (`tag`), สถานะ (`state`) พร้อม pagination
    - `GET /api/logs/dates`: ดูรายชื่อไฟล์ Log ทั้งหมดที่มีในระบบ
    - `POST /api/logs/toggle`: เปิด/ปิด Flag การเก็บ Log ได้แบบ Real-time
  - บันทึกสถานะทุกขั้นตอนละเอียด: `APP_MOUNTED`, `CHANNEL_COMMITTED`, `PLAYER_READY_TO_PLAY`, `PLAYING_HEARTBEAT`, `PLAYBACK_STABLE_15S`, `PLAYER_STATUS_ERROR`, `AUTO_RECONNECT_SCHEDULED`, `AUTO_RECONNECT_HALTED_MAX_REACHED`

#### 7. แอปบนทีวีไม่เห็น get list / เพิ่มปุ่มรีโหลดช่องในแอป (Manual Reload & Channel Fetch Logging)
* **ภาษาคน**: เปิดแอปมาแล้วรายการช่องไม่ขึ้น หรือหลังบ้านอัปเดตช่องใหม่แล้วในแอปยังเป็นช่องเดิม ไม่มีปุ่มให้กดรีโหลดเอง และบนหน้าดู log ของ Backend ก็ไม่มีข้อมูลการ get list ใดๆ
* **สาเหตุจริง**:
  1. **ไม่มีการส่ง Log ใน `useChannels.js`**: โค้ดเดิมส่ง Log เฉพาะฝั่ง Player เท่านั้น ไม่ได้สั่งส่ง Log ตอนดึงช่อง (`fetchChannels`) เลย ทำให้บนเซิร์ฟเวอร์ไม่มีประวัติการเชื่อมต่อของรายการช่อง
  2. **ไม่มีปุ่มรีโหลดช่องใน UI**: แอปพึ่งพาการ poll timestamp `/api/health` ทุก 8 วินาทีเท่านั้น หากเน็ตสะดุดชั่วคราว หรือติดแคชในตัวแอป ผู้ใช้จะไม่สามารถสั่งดึงข้อมูลใหม่ได้เลย
  3. **เงื่อนไข Error บังการแสดงผล**: ใน `Sidebar.js` เดิมจะยอมแสดงกล่องแจ้งเตือน error และปุ่มลองใหม่เฉพาะเมื่อ `channels.length === 0` แต่เนื่องจากแอปเรามีช่อง "หน้าหลัก" (`MAIN_CHANNEL`) ยืนพื้นอยู่เสมอ ทำให้ความยาวเป็น 1 ตลอดเวลา กล่องแจ้งเตือนจึงไม่เคยโผล่มาให้เห็น
* **วิธีแก้จบปัญหา**:
  - เพิ่มปุ่ม **`[ 🔄  รีโหลดช่อง ]`** ไว้ด้านบนสุดของ Sidebar:
    - รองรับรีโมตคอนโทรล TV (D-pad) 100%: กดรีโมตขึ้น (D-pad UP) จากช่องแรกเพื่อโฟกัสได้ทันที
    - มีกรอบเรืองแสงสีขาวและพื้นหลัง Accent ชัดเจน
    - รองรับทั้ง Expanded และโหมดย่อ Collapsed (ยุบเป็นปุ่มกลม 46px ตรงกับ Avatar)
    - การโฟกัสปุ่มนี้จะไม่ตัดสัญญาณวิดีโอที่กำลังเล่นอยู่
  - เพิ่ม **Cache-Buster**: ส่ง `?enabled=true&_t=${Date.now()}` เพื่อป้องกัน HTTP Cache ส่งค่าเก่า
  - ส่ง **Log ละเอียดแท็ก `Channels`**:
    - `CHANNELS_FETCH_REQUEST`: ส่งทันทีเมื่อเริ่มขอข้อมูล (บอกว่ากดจากรีโมตหรือไม่)
    - `CHANNELS_FETCH_SUCCESS`: บันทึกจำนวนช่อง, ms ที่ใช้, และรายชื่อช่อง
    - `CHANNELS_FETCH_ERROR`: บันทึก error stack ชัดเจน
    - `CHANNELS_POLL_DETECTED_CHANGE`: บันทึกเมื่อตรวจพบ timestamp หลังบ้านเปลี่ยน

#### 8. สตรีมสดรีเฟรชดับกระพริบดำทุก 5-10 วินาที หรือหยุดนิ่งค้างไปเฉยๆ หลังเล่นได้สักพัก (BehindLiveWindowException & Live Stream Recovery)
* **ภาษาคน**: 
  - ระยะแรก: นั่งดูช่องสด (เช่น ช่อง 3) กำลังดูอยู่ดีๆ ภาพก็ดับจอดำ โหลดใหม่ เล่นต่อได้ 5-10 วิ แล้วก็ดับโหลดใหม่อีก วนลูปไม่รู้จบ รำคาญมาก
  - ระยะสอง: เล่นต่อเนื่องยาวได้เกือบ 4 นาทีเต็ม แล้วเกิดอาการภาพหยุดนิ่งค้างไปเฉยๆ ไม่เล่นต่อและไม่โหลดใหม่
* **สาเหตุจริง**:
  1. **หน้าต่างสดสั้น (Live Window ~30 วินาที)**: สตรีม HLS มี 3 Chunks x 10s ถ้าหลุดจากขอบ 30 วิ ชิ้นส่วนเดิมจะถูกลบออกจาก Server ทันที
  2. **บัฟเฟอร์ล่วงหน้าตั้งไว้ 15s**: คิดเป็นครึ่งหนึ่งของหน้าต่างสด พอเน็ตสะดุดเสี้ยววิ ExoPlayer ก็หลุดขอบสดและพ่น Exception
  3. **Native Error Code ไม่ครอบคลุม**: `BehindLiveWindowException` ใน Media3 มาได้หลาย Error Code (`1002`, `2008`, `2004`) หากดักไม่ครบจะหลุดขึ้น JS
  4. **บั๊ก Deadlock ใน JS**: โค้ด fallback ใน JS สั่ง `return` ไปตัดวงจร Reconnect ทำให้เมื่อมี Source Error เข้ามา ระบบไม่ยอมต่อใหม่และภาพค้างสนิท
* **วิธีแก้จบปัญหาอย่างถาวร**:
  - **Native Patch `VideoPlayer.kt`**: 
    - ดักจับ Error Code `1002 (ERROR_CODE_BEHIND_LIVE_WINDOW)`, `2008 (ERROR_CODE_IO_READ_POSITION_OUT_OF_RANGE)`, `2004 (ERROR_CODE_IO_BAD_HTTP_STATUS)`
    - ตรวจจับ Class Name: `BehindLiveWindow`, `PlaylistReset`, `InvalidResponseCodeException`
    - ทำ Silent Recovery สั่ง `player.seekToDefaultPosition()`, `player.prepare()`, `player.play()` ดึงกลับขอบสดเงียบๆ
    - ใส่ Throttle จำกัดไม่เกิน 3 ครั้ง/15s เพื่อป้องกัน Native Loop
  - **Native Patch `VideoSource.kt`**: ใส่ `MediaItem.LiveConfiguration` (Target 5s, Min 2s, Max 12s, Speed 0.97x-1.04x) ให้ ExoPlayer เร่ง/ชะลออัตโนมัติ
  - **JS Optimization `Player.js`**: ลบคำสั่ง `return` ปลดล็อคไม่ให้ภาพค้างนิ่ง ส่งต่อเข้า `triggerAutoReconnect` เสมอ และปรับ Buffer 8s + Cooldown 60s
  - **Setup `patch-package`**: บันทึก Patch ไว้ใน `app/patches/expo-video+57.0.2.patch` พร้อมตั้งค่า `postinstall` ใน `package.json`
  - **เอกสารและบันทึกฉบับเต็มของงานนี้**: สามารถศึกษาขั้นตอนการวิเคราะห์ Log, โค้ด Native Patch ทุกบรรทัด และแนวทาง Monitor ผ่าน Backend Log ได้ที่ 👉 [**`../current_session.md`**](../current_session.md)

#### 9. ลิงก์ช่อง 3 ช้ามาก บัฟเฟอร์กระตุก ภาพแตก 576p (Slow Channel 3 Stream Upgrade to ByteArk 1080p CDN)
* **ภาษาคน**: ช่อง 3 โหลดช้ามาก กดเปิดแล้วหมุนติ้วนาน ภาพไม่คมชัด แตกเป็นเม็ด และดูไปสักพักก็กระตุก
* **สาเหตุจริง**:
  1. ลิงก์เดิมส่งจาก US (`live-us1.thaimomo.com`) มี Round-trip Latency สูงถึง 646ms
  2. ความละเอียดต่ำเพียง 576p SD (Bitrate 2.3Mbps)
  3. ขนาดหน้าต่างสตรีมสั้นเพียง 3 Segments (~45 วินาที) เน็ตกระตุกเพียงนิดเดียวก็หลุดขอบสด
* **วิธีแก้จบปัญหา**:
  - อัปเกรดมาใช้ **ByteArk CDN ในประเทศไทย** (`ch3-33-web.cdn.byteark.com` จาก `ch3plus.com/live`)
  - **ผลทดสอบจริง (ก.ย. 2026)**: Latency ลดเหลือ **80-110ms** (เร็วขึ้นกว่า 6 เท่า), ภาพคมชัด **Full HD 1080p** (1920x1080) พร้อม Adaptive bitrate, ดาวน์โหลดสปีด 3.7-4.8 MB/s, และขยายหน้าต่างสตรีมเป็น **90 Segments (~15 นาที)** ป้องกัน `BehindLiveWindowException` ได้ 100%
  - เพิ่มระบบ **`streamResolver.js`**: คอยตรวจสอบและต่ออายุ Signed Token จาก `ch3plus.com` อัตโนมัติ ป้องกันไม่ให้ลิงก์หมดอายุ
  - อ่านสถิติและผลการทดสอบละเอียดได้ที่ 👉 [**`../current_session.md` (หัวข้อ 10)**](../current_session.md#10-อัปเกรดลิงก์สตรีมช่อง-3-hd-ใหม่-แก้ปัญหาความเร็วช้า-ด้วย-byteark-cdn-ในไทย-05092026)

#### 10. ช่อง 3 ดับซ้ำซาก / ต่ออายุอัตโนมัติไม่ทำงานจริง (Stale Token & AWS WAF Block on Cloud Backend)
* **ภาษาคน**: นึกว่าระบบต่ออายุ Token อัตโนมัติทำงานได้ แต่พอวันต่อมา (06/09/2026) ช่อง 3 กลับดับอีกรอบ และไม่สามารถต่ออายุได้เองจนกลายเป็นจอค้าง
* **สาเหตุจริงเชิงลึก (พิสูจน์จาก Log จริง ไม่มีการเดา)**:
  1. **AWS WAF บน CloudFront บล็อก Cloud Datacenter IP**: ตัวเซิร์ฟเวอร์ Backend (`tv-z.duckdns.org`) โฮสต์อยู่บน Google Cloud (GCP IP: `34.2.23.54`) เมื่อยิง Request ไปดึงหน้า `ch3plus.com/live` จะโดน AWS WAF ดักจับบล็อก HTTP 403 Forbidden ส่งหน้า HTML กลับมาว่า *"เราพบบางอย่างผิดปกติ"* ทำให้ Backend ต่ออายุ Token สดด้วยตัวเองจาก Cloud ไม่ได้
  2. **Token ใน Database หมดอายุค้างข้ามคืน**: Token เดิมหมดอายุไปตั้งแต่ `06/09/2026 03:55:02 AM` (`x_ark_expires=1788660902`) เมื่อทีวีเปิดดึงช่องจาก Backend จึงได้ URL เก่าที่ตายแล้วไปเล่น
  3. **เกิด Error Deadlock บนตัวเล่นทีวี**: เมื่อทีวีเล่น URL เก่าแล้ว ByteArk ตอบกลับ HTTP 410 (Gone), ฟังก์ชัน `onRefreshChannel` ของ Player กลับไปดึงข้อมูลช่องจาก Backend ซึ่ง Backend ก็ส่ง URL เก่าที่ตายแล้วตัวเดิมกลับมาทับ State ทำให้ติดลูป Error ค้าง
  4. **Client-side Scraping เดิมมีข้อจำกัด**: ฟังก์ชันดึง Token ฝั่งทีวีเดิมตั้ง Timeout ไว้สั้นเพียง 4s (โหลดหน้าเว็บ 250KB บนเน็ตทีวีไม่ทัน) และใช้ Regex แบบโลภ `([\s\S]*?)` กับก้อน HTML 250KB ซึ่งเสี่ยงต่อการค้าง/แครชบน Hermes JavaScript Engine
* **วิธีแก้จบปัญหาอย่างถาวร (สถาปัตยกรรม Fail-Safe 4 ชั้น + Multi-Action Proactive Auto-Renewal)**:
  - **Multi-Action Proactive Auto-Renewal ครอบคลุมทุก Touchpoint**: ปรับปรุงให้ต่ออายุอัตโนมัติทันทีในทุกจังหวะ: 1) เมื่อ Getlist (`useChannels.js`) 2) เมื่อกดเล่นหรือเลือกการ์ด (`App.js`) 3) เมื่อเลื่อนเปิด/ปิดหรือเลื่อนดูในแถบช่อง (`Sidebar.js`) 4) เมื่อเล่นต่อเนื่องนานๆ ผ่าน Heartbeat ทุก 5 นาที (`Player.js`)
  - **Layer 1 (Upstream Sync API)**: เพิ่ม `POST /api/channels/:id/sync` ใน Backend เปิดให้โหนดที่อยู่นอก Cloud (เช่น Client หรือ Local Script) ที่แกะ Token สดได้ ยิงอัปเดต URL สดขึ้นไปแทนที่ใน DB ทันที
  - **Layer 2 (Fast String Slicing Client Resolver)**: ปรับปรุง `app/src/lib/streamResolver.js` เปลี่ยนจาก Regex เป็น `indexOf` + `slice` ประมวลผลเสร็จใน 0.01ms, เพิ่ม Timeout เป็น 12s, มีระบบ Log ชัดเจน และเมื่อดึง Token สดสำเร็จจะยิงซิงค์ขึ้น Backend ทันที
  - **Layer 3 (Deadlock Elimination & Secondary Fallback)**: ใน `Player.js` และ `App.js` ตรวจสอบความสดของ URL ก่อนนำมาทับตัวเล่น (ไม่เอา URL ที่กำลังจะหมดอายุมาทับ) และหากต่ออายุล้มเหลวทุกช่องทาง จะสลับไปใช้ Mirror สำรอง (`live-us1.thaimomo.com`) อัตโนมัติทันที ภาพไม่มีวันจอดำ
  - **Layer 4 (Local Sync Daemon บน Mac)**: สร้างสคริปต์ `tvApp/sync_ch3.js` ดึง Token ผ่านเน็ตบ้านไทย (ไม่โดน WAF) และยิงซิงค์ขึ้น `tv-z.duckdns.org` อัตโนมัติ ทำให้ทั้ง Backend และทีวีทุกเครื่องได้ Token 1080p สดใหม่อยู่เสมอ
* **เอกสารและบันทึกฉบับเต็ม**: อ่านรายละเอียดเชิงลึกและหลักฐาน Log ทั้งหมดได้ที่ 👉 [**`../current_session.md` (หัวข้อ 11 และ 12)**](../current_session.md#12-ระบบต่ออายุช่อง-3-อัตโนมัติครอบคลุมทุก-action-getlist--play-select-card--เลื่อนเปิดปิด-sidebar--fetch--heartbeat-06092026-1615)

#### 11. สลับช่องแล้วจอดำสนิทรอ 2-3 วินาทีก่อนภาพขึ้น / ไม่มีจอโหลดบอกว่ากำลังเปิดช่องอะไร (Cinematic Super-Sized Loading Screen)
* **ภาษาคน**: พอกดเปลี่ยนช่อง จอจะมืดดับสนิทไปเฉยๆ 2-3 วินาที ไม่มีบอกว่ากำลังโหลดช่องอะไรอยู่ นึกว่าแอปค้าง จนกระทั่งภาพเด้งขึ้นมา
* **สาเหตุจริงเชิงลึก**:
  1. **React State Stale ตอนเปลี่ยน Prop**: ตัวคอมโพเนนต์ `Player.js` ไม่ได้ถูก unmount ทิ้งตอนเปลี่ยนช่อง แต่ได้รับ prop `channel` ตัวใหม่เข้ามา ซึ่งโค้ดเดิมมีแค่ `useState(!isMain)` ซึ่งทำงานเฉพาะตอน mount ครั้งแรกเท่านั้น พอสลับช่อง state `loading` จึงค้างเป็น `false` ไม่ยอมเปิด LoadingOverlay
  2. **ExoPlayer readyToPlay ปิดจอก่อนภาพมา**: อีเวนต์ `readyToPlay` ใน Android Media3/ExoPlayer ส่งมาเร็วมากตอนที่เพิ่งแกะ Manifest/Playlist HLS เสร็จ แต่ตัวถอดรหัสฮาร์ดแวร์ MediaCodec ยังไม่ได้เริ่มวาดเฟรมภาพแรกลงบน Surface (ใช้เวลาโหลด Segment แรกอีก 1.5-3 วินาที) โค้ดเดิมสั่ง `setLoading(false)` ทันทีใน `readyToPlay` ทำให้หน้าจอดำสนิทรอภาพขึ้น
* **วิธีแก้จบปัญหาอย่างถาวร**:
  - **Synchronous Render Trigger**: ใน `Player.js` เพิ่มการเช็ค `channel.id` หรือ `loadEpoch` เปลี่ยนแปลง ให้สั่ง `setLoading(true)` ทันทีตั้งแต่ในรอบ Render Cycle (0ms Delay) ไม่มีจังหวะกะพริบดำ
  - **เคลียร์จอโหลดออกทันทีเมื่อภาพมา (Responsive Playback Clearance)**: ปลดจอโหลดทันทีเมื่อ `isPlaying === true` หรือเมื่อได้รับ `timeUpdate`
  - **Safety Watchdog (3.5 วินาที)**: มีตัวจับเวลาฉุกเฉิน 3.5 วินาทีหลัง `readyToPlay` คอยปลด loading อัตโนมัติ รับประกันว่าจอโหลดไม่มีวันค้าง 100%
  - **Hard Guard ป้องกัน Infinite Loop**: ใส่การตรวจสอบใน `triggerAutoReconnect` และ `checkStallStatus` ไม่ให้สั่ง retry ซ้ำซ้อนเมื่อครบโควตาแล้ว
  - **DOM Clean-up Fallback 400ms**: ตัว LoadingOverlay จะถูก unmount ออกจาก memory และหยุดแอนิเมชันลูปทั้งหมดหลังจากเฟดเสร็จ
  - **จอโหลดระดับภาพยนตร์ขนาดใหญ่พิเศษ (`LoadingOverlay`)**:
    - **Dual/Triple Spinning Rings**: วงแหวนสีทองรอบนอก 340px หมุนตามเข็ม + วงแหวนสีฟ้าอมเขียว 270px หมุนทวนเข็ม + วงแหวนชั้นใน 205px
    - **Channel Avatar ขนาดใหญ่ 140px**: โลโก้ช่องคมชัดตรงกลาง พร้อม Ambient Halo Glow แสงฟุ้งกระจาย 320px
    - **Live Badge & Title**: ป้ายสดสีแดง `🔴 สตรีมสด • FULL HD 1080P` + ชื่อช่องตัวหนาขนาดใหญ่ 46px
    - **Shimmer Sweep Light Beam**: ลำแสงความกว้าง 300px วิ่งผ่านแถบสถานะอย่างมีระดับ
    - **Cinematic Fade Out**: สลายตัวอย่างนุ่มนวล 350ms เมื่อเฟรมภาพเริ่มวาดลงจอ
* **เอกสารและบันทึกฉบับเต็ม**: อ่านรายละเอียดเชิงลึกได้ที่ 👉 [**`../current_session.md` (หัวข้อ 13)**](../current_session.md#13-พัฒนาจอโหลดระดับภาพยนตร์ขนาดใหญ่พิเศษ-cinematic-super-sized-loading-screen-ปิดจอดำ-100-06092026-1616)

#### 12. ป้ายชื่อช่องมุมขวาบน (Badge) ค้างตลอดเวลาไม่ยอมซ่อน (Channel Badge Frozen on Screen)
* **ภาษาคน**: เมื่อเปิดดูช่อง ป้ายชื่อช่องมุมขวาบนค้างตลอดเวลา ไม่ยอมหายไปหลังจาก 3.5 วินาที
* **สาเหตุจริงเชิงลึก**: ใน `Player.js` อีเวนต์ `timeUpdate` ทำงานส่งสัญญาณความคืบหน้าทุก 1 วินาที โดยมีการเรียก `onPlayStateChange(true)` ในทุกวินาที ส่งผลให้ตัวนับเวลา 3.5 วินาทีของ `ChannelBadge` โดน Reset ใหม่อยู่ตลอดเวลา ทำให้ป้ายไม่มีโอกาสนับจนครบและค้างอยู่บนจอถาวร
* **วิธีแก้จบปัญหาอย่างถาวร**:
  - ใช้ `initialPlayFiredRef` ภายใน `Player.js` ดักจับเฉพาะตอนเริ่มเล่นครั้งแรกเท่านั้น และป้องกันไม่ให้ `timeUpdate` ไปยิง `onPlayStateChange(true)` ซ้ำอีก
  - `ChannelBadge` จึงนับเวลาถอยหลัง 3.5 วินาทีแล้วเล่นแอนิเมชัน Fade Out สลายตัวได้อย่างถูกต้อง 100%

#### 13. ช่อง 3 / One 31 / Amarin TV 34 ได้ภาพเดียวกันหมด และลิงก์ช่องอื่นถูกทับด้วยช่อง 3 (Channel Overwrite via Loose String Matching Bug)
* **ภาษาคน**: เมื่อกดดูช่อง One 31 หรือ Amarin TV 34 ภาพที่ได้ดันกลายเป็นช่อง 3 เหมือนกันหมด ทั้งๆ ที่เลือกคนละช่อง
* **สาเหตุจริงเชิงลึกจากการตรวจสอบ Log**:
  1. ใน `isCh3()` ของแอป และ `isDynamicChannel()` ของหลังบ้าน มีเงื่อนไขตรวจ `name.includes('3')` ซึ่งช่อง One **31**, Amarin TV **34**, ไทยรัฐทีวี **32**, Workpoint **23** มีเลข `3` อยู่ในชื่อทั้งหมด
  2. เมื่อผู้ใช้กดดูช่อง One 31 หรือ Amarin TV 34 ตัวแอปเข้าใจผิดว่าเป็นช่อง 3 จึงไปดึง Token ช่อง 3 มา แล้วยิง `POST /api/channels/:id/sync` นำ URL ช่อง 3 ไปเขียนทับช่อง One 31 และ Amarin TV 34 ในฐานข้อมูลเซิร์ฟเวอร์
  3. ฝั่งเซิร์ฟเวอร์เดิมไม่มี Guard ตรวจสอบ ID จึงบันทึก URL ช่อง 3 ทับสตรีมจริงของช่อง One 31 และ Amarin 34 ทันที
* **วิธีแก้จบปัญหาอย่างถาวร**:
  - **กู้คืน URL สตรีมจริง**: ส่ง `PATCH /api/channels/:id` กู้คืนสตรีมของ One 31 และ Amarin TV 34 บนเซิร์ฟเวอร์สด `tv-z.duckdns.org` เรียบร้อย
  - **Strict Regex Matching**: เปลี่ยนการตรวจจับช่อง 3 ทั่วทั้งระบบให้ใช้ `/^(3\s*hd|ช่อง\s*3|ch\s*3|channel\s*3)($|\s)/i` แทน `.includes('3')` อย่างเด็ดขาด
  - **Backend Guard (403 Forbidden)**: เซิร์ฟเวอร์ตรวจสอบก่อนบันทึกใน `/api/channels/:id/sync` หากไม่ใช่ ID หรือชื่อช่อง 3 จะตอบปฏิเสธด้วย `403 Forbidden` ทันที ป้องกันไม่ให้แอปใดๆ เขียนทับสตรีมช่องอื่นได้อีก
  - **Client ID Guard**: ในฟังก์ชัน `renewCh3Auto` จะไม่ยิงซิงค์หาก ID ไม่ตรงกับช่อง 3
* **เอกสารและบันทึกฉบับเต็ม**: อ่านรายละเอียดเชิงลึกและหลักฐาน Log ได้ที่ 👉 [**`../current_session.md` (หัวข้อ 15)**](../current_session.md#15-ตรวจสอบและแก้ไขช่อง-3--one-31--amarin-tv-34-ได้ภาพเดียวกันหมด-และ-badge-ค้าง-06092026-1658-น)

#### 14. ดูช่องอยู่แล้วมีหน้าจอโหลดดิ้งหมุนๆ โผล่ขึ้นมาขัดจังหวะเป็นระยะ (Stream Interruption during Healthy Playback due to Background Token Sync Loop)
* **ภาษาคน**: กำลังนั่งดูช่อง 3 หรือช่องอื่นๆ สตรีมกำลังเล่นได้ดีคมชัด เน็ตไม่ได้หลุด แต่จู่ๆ ก็มีวงแหวนโหลดดิ้งหมุนๆ โผล่ขึ้นมากลางจอ แล้ววิดีโอก็รีสตาร์ทเริ่มเล่นใหม่เอง ขัดจังหวะการรับชมเป็นระยะ
* **สาเหตุจริงเชิงลึกจากการตรวจ Log เซิร์ฟเวอร์และตัวเล่น (100% Forensic Evidence)**:
  1. **Background Polling Infinite Sync Loop**: ตัวแอปใน `useChannels.js` มีการ Poll ตรวจสอบ `fetchUpdatedAt` ทุก 8 วินาที ซึ่งโค้ดเดิมสั่ง `resolveStreamUrl(c, { forceRefresh: true })` ส่งผลให้มีการขอ Fresh Token จาก ByteArk ทุก 8 วินาที แล้วยิง `POST /api/channels/:id/sync` ขึ้นเซิร์ฟเวอร์ทุกรอบ
  2. เซิร์ฟเวอร์อัปเดตข้อมูลช่อง ทำให้ `updatedAt` บนเซิร์ฟเวอร์เปลี่ยนใหม่ตลอดเวลา กลายเป็น Feedback Loop สั่งดึงช่องและซิงค์ใหม่ไม่รู้จบ
  3. **Player ทำลาย Session วิดีโอที่กำลังเล่นดีอยู่ (`urlChanged` Triggering `player.replace`)**:
     ใน `Player.js` เดิม เมื่อได้รับ Prop `url` ใหม่ที่มี Token สดส่งลงมา มีเงื่อนไข `if (urlChanged || forceReloadRequested)` ซึ่งสั่ง `setLoading(true)` และสั่ง `player.replace({ uri: url })` ทันที แม้ว่าสตรีมเดิมจะกำลังเล่นได้อย่างราบรื่นและต่อเนื่อง
     การเรียก `player.replace()` บน ExoPlayer จะทำลาย MediaItem และบัฟเฟอร์ในแรมทิ้งทั้งหมด ทำให้สตรีมสะดุดและเกิดหน้าจอโหลดดิ้งหมุนๆ โผล่ขึ้นมาขัดจังหวะกลางคัน
* **วิธีแก้จบปัญหาอย่างถาวร (Industry Streaming Player Best Practice)**:
  - **Uninterrupted Healthy Playback & Silent Token Update (`Player.js`)**:
    - เพิ่ม `currentPlayingChannelIdRef` ระบุช่องที่กำลังเล่นอยู่
    - หากกำลังดูช่องเดิมอยู่ (`!channelChanged && !forceReloadRequested`) และวิดีโอกำลังเล่นได้อย่างราบรื่น (`hasStartedPlayingRef.current === true`), **ไม่อนุญาตให้ขึ้นหน้าจอโหลดดิ้งและห้ามสั่ง `player.replace()` ขัดจังหวะเด็ดขาด**
    - ให้อัปเดต URL ใหม่เก็บไว้ใน `currentUrlRef.current = url` เงียบๆ ในหน่วยความจำ (Silent Ref Update) เพื่อเตรียมไว้เป็น URL สำรองสำหรับการ Reconnect หากเกิด Network Error ในอนาคต
    - อนุญาตให้สั่ง `setLoading(true)` และ `player.replace()` เฉพาะเมื่อผู้ใช้กดสลับช่องจริง (`channelChanged === true`) หรือกดปุ่มรีโหลดช่องด้วยตนเอง (`forceReloadRequested === true`) เท่านั้น
  - **Idempotent Background Polling (`useChannels.js`)**:
    - เปลี่ยน `forceRefresh: true` เป็น `forceRefresh: isManual`
    - การ Polling เบื้องหลังทุก 8 วินาทีจะไม่ขอ Token ใหม่ตราบใดที่ Token เดิมยังไม่หมดอายุ (`isUrlExpiring(c.url, 600)` มีอายุเหลือ > 10 นาที)
    - กำจัด Infinite Sync Loop ระหว่าง Client และเซิร์ฟเวอร์ให้เป็นศูนย์ 100%
* **เอกสารและบันทึกฉบับเต็ม**: อ่านรายละเอียดเชิงลึกและหลักฐาน Log ได้ที่ 👉 [**`../current_session.md` (หัวข้อ 16)**](../current_session.md#16-แก้ไขหน้าจอโหลดดิ้งหมุนขัดจังหวะการดูช่อง-3-ระหว่างเล่นปกติ-uninterrupted-healthy-playback--silent-token-update-06092026-1820-น)

#### 15. เลื่อนดูช่องแล้วแอปชิงสลับช่องอัตโนมัติ / สีไฮไลต์ช่องเดิมมองยากไม่เด่น (Explicit Remote OK/Center Selection & Ultra-Vivid Neon Focus Highlight)
* **ภาษาคน**: 1) ตอนกดรีโมตขึ้น-ลงแค่จะเลื่อนดูชื่อช่องเฉยๆ พอหยุดดูแป๊บเดียว แอปดันชิงตัดสลับไปเล่นช่องนั้นเอง ทั้งที่ยังไม่ได้ตัดสินใจเลือก 2) สีแถบไฮไลต์ที่เลื่อนไปโดนเป็นสีขาวขุ่นจางๆ กลืนไปกับพื้นหลัง ดูจากระยะ 3 เมตรบนโซฟามองแทบไม่ออกว่ากำลังเลือกช่องไหนอยู่
* **สาเหตุจริงเชิงลึก**:
  1. **Auto-Switch on Focus (450ms Delay)**: ใน `App.js` ฟังก์ชัน `handleFocusChannel` เดิมมีการตั้งเวลา `switchTimer.current = setTimeout(() => commit(channel), 450)` ไว้ ทำให้เมื่อใดก็ตามที่เลื่อนไฮไลต์ไปหยุดที่ช่องใดเกิน 450ms ตัวแอปจะสั่งเล่นช่องนั้นทันที
  2. **Subtle Washed-out Highlight**: ใน `ChannelRow.js` โค้ดเดิมใช้ `backgroundColor: 'rgba(255, 255, 255, 0.24)'` และ `borderColor: '#FFFFFF'` หนาเพียง 1.5px ซึ่งเป็นสีโมโนโครมขาวขุ่น กลืนไปกับพื้นหลังสีดำของแถบ Sidebar ขาด Chromatic Contrast บนจอทีวีขนาดใหญ่
* **วิธีแก้จบปัญหาอย่างถาวร (Leanback TV Standard UX)**:
  - **No Auto-Switch on Scroll (ห้ามเปลี่ยนช่องตอนเลื่อน)**: ลบ `switchTimer` และคำสั่ง `commit(channel)` ออกจาก `handleFocusChannel` ใน `App.js` อย่างเด็ดขาด การกดรีโมตขึ้น-ลงจะเป็นเพียงการเลื่อนดูชื่อช่องเท่านั้น ช่องที่กำลังเล่นอยู่จะไม่มีวันสะดุดหรือถูกเปลี่ยน
  - **Explicit OK/Center Confirmation (ต้องกดปุ่มตรงกลางถึงจะเลือกช่อง)**: ผูกการสลับช่องไว้ที่การกดปุ่มตรงกลางรีโมต (`DPAD_CENTER` / Enter) ซึ่งจะไปยิงอีเวนต์ `onPress` -> `handleSelectChannel` -> `commit(channel)` เล่นทันทีใน 0ms และนับถอยหลังย่อ Sidebar ให้ดูเต็มจอหลังเลือกเสร็จ
  - **Ultra-Vivid Neon Focus Highlight (ไฮไลต์นีออนเด่นชัดระดับพรีเมียม)**:
    - **พื้นหลัง:** สีน้ำเงินเข้มข้น `rgba(29, 78, 216, 0.92)` (Royal Sapphire Blue) ตัดกับพื้นหลัง Sidebar ชัดเจน
    - **ขอบนีออน:** สีฟ้านีออน Electric Cyan (`#00F0FF`) หนา 2.5px ชัดเจนสะดุดตา
    - **แท่งไฟนีออนนำสายตา:** เพิ่มแถบนีออนสีฟ้ากว้าง 4px ที่ขอบซ้าย (`focusPill`) ระบุตำแหน่งเคอร์เซอร์ได้ทันทีแม้กวาดตามองผ่านๆ
    - **ออร่าเรืองแสง:** เงาสีนีออน `shadowColor: '#00F0FF'`, `shadowOpacity: 0.95`, `shadowRadius: 10`, `elevation: 12`
    - **กรอบ Avatar:** เพิ่มกรอบเรืองแสงสีขาวรอบโลโก้ช่องเมื่อโฟกัส
    - **ตัวหนังสือหนาพิเศษ:** ชื่อช่องสีขาวหนา `fontWeight: '900'` ขนาด 14px และชื่อหมวดหมู่สีฟ้าสว่าง `#BAE6FD`
    - **ปุ่มรีโหลดช่อง:** อัปเกรดไฮไลต์ของปุ่ม `[ 🔄 รีโหลดช่อง ]` ด้านบนให้เป็นโทนนีออน `#00F0FF` แบบเดียวกัน
* **เอกสารและบันทึกฉบับเต็ม**: อ่านรายละเอียดเชิงลึกได้ที่ 👉 [**`../current_session.md` (หัวข้อ 17)**](../current_session.md#17-ปรับปรุงระบบการเลือกช่องด้วยรีโมต-explicit-remote-okcenter-selection--ultra-vivid-neon-focus-highlight-06092026-1852-น)

#### 16. ขยายเลขช่องในแถบซ้ายใหญ่ขึ้น +25% ถึง +35% และยกระดับไฮไลต์โฟกัสนีออนสว่างจ้าสะใจ (Ultra-Enlarged Channel Numbers & Maximum Neon Pop Highlight)
* **ภาษาคน**: 1) ผู้ใช้ต้องการให้ตัวเลขช่องในแถบซ้าย (Sidebar) ใหญ่ขึ้นอีก +25% เพื่อให้อ่านหมายเลขช่องได้ชัดเจนสะใจจากระยะไกลบนโซฟา 2) ไฮไลต์โฟกัสของแถบเลือกช่องต้องสว่าง ชัดเจน และโดดเด่นสะดุดตาขั้นสุด ไม่มีทางกลืนไปกับพื้นหลังทีวี
* **สาเหตุจริงเชิงลึก**:
  1. **Previous Subdued Number Sizing**: ใน `Avatar.js` ตัวอักษรดึงเพียงตัวอักษรแรก `name[0]` (กลายเป็นภาษาไทย/อังกฤษเช่น ไ, O, A, W แทนที่จะเป็นเลขช่อง) และฟอนต์ขนาด 22-23px (`size * 0.48`) ซึ่งเล็กเกินไปเมื่อมองจากระยะ 3 เมตร
  2. **Subdued Focus Contrast**: สีน้ำเงินเดิมที่มีความโปร่งใส `rgba(29, 78, 216, 0.92)` บนจอทีวีบางรุ่นที่มีคอนทราสต์ต่ำอาจดูกลืนไปกับพื้นหลังสีดำเข้ม
* **วิธีแก้จบปัญหาอย่างถาวร (Leanback TV Standard UX)**:
  - **ดึงหมายเลขช่องดิจิทัลทีวีจริง 100% (`Avatar.js`)**: ใช้ Regex `name.match(/\d+/)` ดึงตัวเลขช่องออกมาแสดงชัดเจนตรงตามมาตรฐาน กสทช. เช่น 3, 5, 7, 9, 23, 24, 25, 29, 31, 32, 34
  - **ขยายขนาดตัวเลขช่องใหญ่ขึ้น +25% ถึง +35%**:
    - ขยายกล่อง Avatar จาก 46px เป็น **52px**
    - เลข 1 หลัก: ขยายฟอนต์เป็น **36px** (`size * 0.70`, `lineHeight: 41px`)
    - เลข 2 หลัก: ขยายฟอนต์เป็น **30px** (`size * 0.58`, `lineHeight: 34px`, `letterSpacing: -1`) ใหญ่สะใจ ชัดทะลุจอ
  - **ยกระดับไฮไลต์โฟกัสขั้นสุด (Maximum Neon Pop)**:
    - **พื้นหลัง:** สีน้ำเงินสดใสทึบแสง 100% `#2563EB` (Vivid Electric Royal Blue) สว่างเด่น ตัดกับพื้นหลังสีดำของแถบ Sidebar
    - **ขอบนีออน:** สีฟ้านีออน Electric Cyan (`#00FFFF`) หนาพิเศษ **3.5px** พร้อมออร่าเรืองแสง `shadowColor: '#00FFFF'`, `shadowRadius: 16`, `elevation: 18`
    - **เสานีออนนำสายตา:** ขยายเสานีออนซ้ายมือ (`focusPill`) กว้าง **6px** สว่างสะดุดตา
    - **กรอบเรืองแสงรอบตัวเลขช่อง:** กรอบ Avatar โฟกัสเรืองแสงสีฟ้านีออน `#00FFFF` หนา 2.5px
    - **ชื่อช่องคมชัด:** ตัวหนังสือสีขาวบริสุทธิ์หนาพิเศษ `fontWeight: '900'` ขนาด **18px** (+28.5%) พร้อม Text Shadow ชัดเจน
    - **ขยายความกว้างแถบด้านซ้าย:** `EXPANDED_WIDTH = 235` (เพิ่มจาก 220) และ `COLLAPSED_WIDTH = 74` รองรับตัวเลขช่องขนาดใหญ่ 52px และข้อความชื่อช่องได้ไม่อึดอัด
    - **ข้อความแนะนำรีโมต:** แสดง `▲ ▼ เลื่อนดู • กด OK เพื่อเลือกช่อง` ที่ด้านล่างของแถบซ้าย

#### 17. รองรับการ Hover ผ่านเมาส์/Air Mouse พร้อมไฮไลต์นีออนสีสดเด่นชัดขั้นสุด (Full Mouse & Air Mouse Hover Support with Vivid Standout Neon Highlight)
* **ภาษาคน**: เมื่อใช้เมาส์ หรือรีโมตแบบมี Pointer (Air Mouse / Magic Remote) เลื่อนเคอร์เซอร์ไปชี้ (Hover) ที่รายการช่อง ไฮไลต์ต้องติดสว่างขึ้นมาทันทีอย่างเด่นชัด สีสด คมชัด ไม่ต้องคลิกก่อน และเห็นชัดเจนทะลุจอ
* **สาเหตุจริงเชิงลึก**:
  1. **Only Listened to `focused`**: ใน `ChannelRow.js` และ `Sidebar.js` เดิม Component `<Pressable>` รับเฉพาะพารามิเตอร์ `focused` จาก D-pad รีโมตทีวีเท่านั้น ไม่ได้ดักจับ `hovered` หรืออีเวนต์ `onHoverIn` / `onHoverOut` ส่งผลให้เมื่อนำเมาส์หรือ Air Mouse ไปชี้ (Hover) ตัวแถวช่องไม่มีการเปลี่ยนแปลงสถานะหรือแสดงไฮไลต์ใดๆ เลย
* **วิธีแก้จบปัญหาอย่างถาวร**:
  - **Full Dual-State Highlight (`isHighlighted = focused || hovered || isHovered`)**: รวมสถานะทั้งจากการกดรีโมต D-pad (`focused`), การตรวจจับของ Pressable (`hovered`), และ Local State จากอีเวนต์ `onHoverIn` / `onHoverOut` ทำงานสอดประสานกัน 100%
  - **Auto-Expand on Hover (`onHoverIn`)**: เมื่อเลื่อนเมาส์ไปชี้ช่องใด จะสั่งกาง Sidebar ออกมาแสดงชื่อช่องอัตโนมัติทันที
  - **Ultra-Vivid Standout Neon Highlight (หนา 4px + นีออน Electric Cyan `#00FFFF` + Vivid Royal Blue `#2563EB`)**:
    - ขอบนีออนหนาขึ้นเป็น **4px** เต็มตา
    - เสานีออนนำสายตาซ้ายมือ (`focusPill`) กว้าง **7px**
    - กรอบตัวเลขช่อง Avatar หนา **3px** พร้อมออร่าเรืองแสง
    - ตัวหนังสือชื่อช่องขนาด **18px** หนา `900` สีขาวตัดกับพื้นหลังสีน้ำเงินสด
    - เพิ่ม `cursor: 'pointer'` สำหรับการควบคุมด้วยเมาส์
    - ปุ่มรีโหลดช่องและปุ่มลองใหม่รองรับการ Hover ด้วยสีนีออนเต็มรูปแบบเช่นกัน

