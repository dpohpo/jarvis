/**
 * LoginScreen — 1:1 port of screenshot 1.jpg.
 *
 * Layout (top to bottom, centered):
 *  - 96px circular logo (purple 2px border, 💬 emoji)
 *  - "Jarvis" 32px bold, letter-spacing 2
 *  - "Control all computer agents from your phone" 13px muted
 *  - "Welcome screen · v0.1.0" 11px subtle
 *  - Primary button "Pair new server" (accent fill)
 *  - Secondary "Restore from backup" (text link, Phase 15 wires actual flow)
 *  - Terms caption (centered, 11px subtle)
 *
 * Pairing flow (ported from app-legacy.tsx PairingScreen, ~70 lines there):
 *  - tap Pair → request camera permission (useCameraPermissions from expo-camera)
 *  - scanner mounted (CameraView + barcodeTypes: ["qr"])
 *  - on QR detected → JSON.parse → pairWithDaemon(info, "android-phone")
 *  - saveState(s) → onPaired(s) → Root re-renders into MainScreen
 *  - failure → Alert.alert with stack trace (kept from legacy)
 *
 * Manual JSON fallback kept for the case where the daemon is on a host
 * the camera can't see (e.g. remote relay). Toggle via "手动配对信息".
 */
import { useCallback, useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import { pairWithDaemon, type PairInfo } from "../client";
import { saveState, type PhoneState } from "../store";
import { C, FS, FW, LS, RD, SP, SHADOWS } from "../theme";

interface Props {
  onPaired: (s: PhoneState) => void;
}

export function LoginScreen({ onPaired }: Props) {
  const [scanning, setScanning] = useState(false);
  const [manualPair, setManualPair] = useState(false);
  const [manualJson, setManualJson] = useState("");
  const [pairing, setPairing] = useState(false);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const scanned = useRef(false); // suppress duplicate QR events

  const onScan = useCallback(
    async (data: string) => {
      if (scanned.current) return;
      scanned.current = true;
      setScanning(false);
      setPairing(true);
      try {
        const info = JSON.parse(data) as PairInfo;
        const s = await pairWithDaemon(info, `${Platform.OS}-phone`);
        await saveState(s);
        onPaired(s);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        console.error("[pair] failed:", err.message, err.stack);
        Alert.alert(
          "配对失败",
          `${err.message}\n\n${(err.stack ?? "").slice(0, 600)}`,
        );
      } finally {
        setPairing(false);
        scanned.current = false;
      }
    },
    [onPaired],
  );

  return (
    <View style={styles.root}>
      <StatusBar style="light" />

      {scanning && camPerm?.granted ? (
        <View style={styles.scannerBox}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={(r) => void onScan(r.data)}
          />
          <View style={styles.scanFrame} />
          <Pressable style={styles.cancelBtn} onPress={() => setScanning(false)}>
            <Text style={styles.cancelText}>取消</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.logo}>
            <Text style={styles.logoEmoji}>💬</Text>
          </View>

          <Text style={styles.title}>Jarvis</Text>
          <Text style={styles.subtitle}>
            Control all computer agents from your phone
          </Text>
          <Text style={styles.version}>Welcome screen · v0.1.0</Text>

          {pairing ? null : manualPair ? (
            <View style={styles.manualWrap}>
              <TextInput
                style={styles.manualInput}
                value={manualJson}
                onChangeText={setManualJson}
                placeholder='粘贴配对 JSON（{"relayUrl":...}）'
                placeholderTextColor={C.fgSubtle}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.manualRow}>
                <Pressable
                  style={[styles.btn, styles.btnSecondary, styles.flex1]}
                  onPress={() => setManualPair(false)}
                >
                  <Text style={styles.btnSecondaryText}>返回</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.btnPrimary, styles.flex1]}
                  onPress={() => void onScan(manualJson.trim())}
                >
                  <Text style={styles.btnPrimaryText}>配对</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Pressable
                style={[styles.btn, styles.btnPrimary, pairing && styles.btnDisabled]}
                onPress={async () => {
                  if (!camPerm?.granted) {
                    const r = await requestCamPerm();
                    if (!r.granted) return;
                  }
                  scanned.current = false;
                  setScanning(true);
                }}
              >
                <Text style={styles.btnPrimaryText}>Pair new server</Text>
              </Pressable>
              <Pressable onPress={() => setManualPair(true)} style={styles.secondaryBtn}>
                <Text style={styles.btnSecondaryText}>Restore from backup</Text>
              </Pressable>
            </>
          )}

          <Text style={styles.terms}>
            By continuing you agree to our Terms of Service and Privacy Policy
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  } as ViewStyle,
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[5],
  } as ViewStyle,
  logo: {
    width: 96,
    height: 96,
    borderRadius: RD.full,
    borderWidth: 2,
    borderColor: C.accent,
    backgroundColor: C.surface1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[6],
    ...SHADOWS.md,
  } as ViewStyle,
  logoEmoji: { fontSize: 44 },
  title: {
    color: C.fg,
    fontSize: FS["3xl"],
    fontWeight: FW.bold,
    letterSpacing: LS.brand,
  },
  subtitle: {
    color: C.fgMuted,
    fontSize: FS.sm,
    textAlign: "center",
    marginTop: SP[2],
    lineHeight: 22,
    paddingHorizontal: SP[3],
  },
  version: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    marginTop: SP[1],
    marginBottom: SP[8],
  },
  btn: {
    paddingVertical: SP[3],
    paddingHorizontal: SP[5],
    borderRadius: RD.lg,
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  btnPrimary: {
    backgroundColor: C.accent,
    minWidth: 220,
    ...SHADOWS.md,
  } as ViewStyle,
  btnPrimaryText: {
    color: C.accentForeground,
    fontSize: FS.base,
    fontWeight: FW.semibold,
  },
  btnSecondary: {
    backgroundColor: C.surface1,
  } as ViewStyle,
  btnSecondaryText: {
    color: C.fgMuted,
    fontSize: FS.sm,
  },
  btnDisabled: { opacity: 0.6 } as ViewStyle,
  secondaryBtn: { marginTop: SP[2], padding: SP[2] },
  terms: {
    color: C.fgSubtle,
    fontSize: FS.xs,
    textAlign: "center",
    marginTop: SP[12],
    paddingHorizontal: SP[6],
    lineHeight: 18,
  },
  flex1: { flex: 1 } as ViewStyle,
  // QR scanner
  scannerBox: { flex: 1, overflow: "hidden" } as ViewStyle,
  scanFrame: {
    position: "absolute",
    top: "40%", left: "15%", right: "15%", bottom: "40%",
    borderWidth: 2,
    borderColor: C.accent,
    borderRadius: RD.lg,
  } as ViewStyle,
  cancelBtn: {
    position: "absolute",
    bottom: 40, alignSelf: "center",
    backgroundColor: C.surface3,
    paddingHorizontal: SP[5],
    paddingVertical: SP[2],
    borderRadius: RD.lg,
    ...SHADOWS.md,
  } as ViewStyle,
  cancelText: { color: C.fg, fontSize: FS.sm, fontWeight: FW.medium },
  // Manual JSON
  manualWrap: { width: "100%", marginTop: SP[5] },
  manualInput: {
    backgroundColor: C.surface1,
    color: C.fg,
    borderRadius: RD.lg,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    minHeight: 90,
    fontSize: FS.sm,
    textAlignVertical: "top",
  },
  manualRow: { flexDirection: "row", gap: SP[2], marginTop: SP[3] },
});
