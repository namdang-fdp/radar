# Radar for Android

Native Flutter reader for the existing Radar backend. Light theme is fixed even when Android uses dark mode. Includes recommendations, search, topic/source filters, saved articles, pagination, native HTML reading, adjustable reader font size and original links. Pull to refresh reloads the library; the server worker continues collecting articles on its daily schedule. No AI or translation calls.

## USB test

```sh
adb reverse tcp:4321 tcp:4321
cd mobile
flutter pub get
flutter build apk --release --target-platform android-arm64
adb install -r build/app/outputs/flutter-apk/app-release.apk
adb shell am start -n com.dorriss.radar_app/.MainActivity
```

Default backend: `http://127.0.0.1:4321`. The computer's Docker stack must be running and USB connected for this address to work. The connection button in the app changes and remembers the server URL. HTTPS is required for remote hosts; cleartext HTTP is allowed only for loopback USB testing.

For a deployed backend, build with `--dart-define=RADAR_API_URL=https://your-radar-host` or change the saved server URL in the app. The backend needs the same hostname in Astro's allowed domains. The current personal backend has no user authentication: set up private access/authentication before exposing it publicly. No database credentials are included in the APK.

This local test APK uses the Android debug signing key with release compilation. Configure a private release keystore before store distribution. The launcher package is `com.dorriss.radar_app`.

## Verification and design

```sh
flutter analyze
flutter test
```

UI polish follows ui-ux-pro-max mobile readability, native controls and touch-target guidance. Transitions.dev CSS cannot run in a native Flutter widget tree: its 250 ms icon/page timing and smooth-out curve are adapted in `lib/theme.dart`, with system reduced-motion support. Flutter provides native route, snackbar and navigation transitions. Font: Be Vietnam Pro, bundled locally under the SIL Open Font License in `assets/fonts/OFL.txt`.

The API uses the existing same-origin validation for state changes by sending the configured server origin; it does not weaken the web check. New read-only endpoints: `/api/sources`, `/api/recommendations`, `/api/articles/:id`. HTML remains sanitized on the server before native rendering.
