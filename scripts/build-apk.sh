#!/usr/bin/env bash
# Build the Jarvis Android APK locally (no Expo account, no cloud).
# Prereqs (already on this Mac): temurin@21, android-commandlinetools + platform-tools/build-tools/platforms.
set -euo pipefail

export JAVA_HOME="${JAVA_HOME_OVERRIDE:-/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export PATH="$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"
# ~/.gradle is a dangling symlink to an unmounted migration volume, and the
# project volume is exFAT (no POSIX perms — gradle caches break there), so the
# cache lives on the internal APFS disk under its own name.
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$HOME/.gradle-jarvis}"

cd "$(dirname "$0")/../packages/app"

echo "==> expo prebuild (android)"
npx expo prebuild --platform android --no-install

echo "==> gradle assembleRelease"
cd android
./gradlew assembleRelease --console=plain

APK="$(pwd)/app/build/outputs/apk/release/app-release.apk"
echo ""
echo "✅ APK: $APK"
ls -lh "$APK"
echo ""
echo "安装到手机: adb install -r '$APK'  （或把 APK 发到手机直接安装）"
