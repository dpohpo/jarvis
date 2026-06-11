#!/usr/bin/env bash
# Boot an emulator, install the latest APK, launch it, capture the crash.
set -uo pipefail

export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
APK="$(ls -t /Volumes/金阳/jarvis/dist-apk/*.apk | head -1)"
AVD=jarvis-test

if ! avdmanager list avd 2>/dev/null | grep -q "$AVD"; then
  echo no | avdmanager create avd -n "$AVD" \
    -k "system-images;android-35;google_apis;arm64-v8a" -d pixel_6
fi

echo "==> booting emulator"
emulator -avd "$AVD" -no-snapshot -no-audio -no-boot-anim -gpu swiftshader_indirect \
  > /tmp/jarvis-emu.log 2>&1 &
adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do sleep 2; done
echo "==> booted"

adb logcat -c
adb install -r "$APK"
adb shell am start -n com.poincare.jarvis/.MainActivity
sleep 6
echo "==> crash dump:"
adb logcat -d -t 400 | grep -iE "AndroidRuntime|FATAL|libsodium|com.poincare.jarvis|ReactNative|Hermes|JNI|tombstone" | tail -80
