#!/usr/bin/env bash
# Build the Jarvis Android APK locally (no Expo account, no cloud).
#
# The repo lives on /Volumes/金阳 (exFAT), which is hostile to Android builds:
# no POSIX perms (gradle cache corruption) and AppleDouble ._* files appear in
# compiled output (ASM ClassReader crashes). So we sync sources to an APFS
# build sandbox in $HOME, build there, and copy the APK back.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="${JARVIS_BUILD_DIR:-$HOME/.jarvis-build}"

export JAVA_HOME="${JAVA_HOME_OVERRIDE:-/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export PATH="$ANDROID_HOME/platform-tools:$JAVA_HOME/bin:$PATH"
# ~/.gradle is a dangling symlink to an unmounted migration volume — use our own
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$HOME/.gradle-jarvis}"

# RN's gradle-plugin pins foojay-resolver 0.5.0, which crashes on Gradle 9
# (JvmVendorSpec.IBM_SEMERU was removed). Register local JDKs and forbid
# toolchain auto-download so foojay is never invoked.
mkdir -p "$GRADLE_USER_HOME"
cat > "$GRADLE_USER_HOME/gradle.properties" <<EOF
org.gradle.java.installations.auto-download=false
org.gradle.java.installations.paths=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home,$JAVA_HOME
EOF

echo "==> sync workspace to APFS sandbox: $SANDBOX"
mkdir -p "$SANDBOX"
rsync -a --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude dist \
  --exclude "*.tsbuildinfo" \
  --exclude .gradle-home \
  --exclude "packages/app/android" \
  --exclude "packages/app/ios" \
  --exclude "packages/app/.expo" \
  --exclude "._*" \
  "$REPO/" "$SANDBOX/"

cd "$SANDBOX"
echo "==> pnpm install (sandbox, hardlinked from store)"
pnpm install --prefer-offline 2>&1 | tail -2

echo "==> build @jarvis/protocol"
pnpm --filter @jarvis/protocol build

cd "$SANDBOX/packages/app"
echo "==> expo prebuild (android)"
npx expo prebuild --platform android --no-install

echo "==> gradle assembleRelease"
cd android
./gradlew assembleRelease --console=plain

APK_SRC="$(pwd)/app/build/outputs/apk/release/app-release.apk"
APK_DST="$REPO/dist-apk/jarvis-$(date +%Y%m%d-%H%M).apk"
mkdir -p "$REPO/dist-apk"
cp "$APK_SRC" "$APK_DST"
echo ""
echo "✅ APK: $APK_DST"
ls -lh "$APK_DST"
echo ""
echo "安装到手机: adb install -r '$APK_DST'  （或把 APK 发到手机直接安装）"
