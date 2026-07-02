/**
 * LoginScreen — 1.jpg pixel-perfect port.
 *
 * Visual (sampled via PIL on the screenshot):
 *  - White canvas (#FFFFFF)
 *  - Centered circular logo (~96dp) — black vector glyph on transparent
 *    background (no border visible against white canvas)
 *  - "Paseo" title in dark green (#307040), bold, ~28pt
 *  - Subtitle "#707070", 13pt, centered
 *  - "Pair new server" button — BLACK fill (#101010), white text, pill radius
 *  - "Restore from backup" text link, #707070
 *  - Bottom terms caption, #A0A0A0, 11pt
 *
 * QR scan is triggered but onPaired is wired through; this is purely the
 * visual + scan trigger.
 */
import { useCallback, useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View, ViewStyle } from "react-native";
import { StatusBar } from "expo-status-bar";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Hexagon } from "lucide-react-native";
import { pairWithDaemon, type PairInfo } from "../client";
import { saveState, type PhoneState } from "../store";
import { C, FS, FW, RD, SP } from "../theme";

interface Props {
  onPaired: (s: PhoneState) => void;
}

export function LoginScreen({ onPaired }: Props) {
  const [scanning, setScanning] = useState(false);
  const [manualPair, setManualPair] = useState(false);
  const [manualJson, setManualJson] = useState("");
  const [pairing, setPairing] = useState(false);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const scanned = useRef(false);

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
        Alert.alert("配对失败", `${err.message}\n\n${(err.stack ?? "").slice(0, 600)}`);
      } finally {
        setPairing(false);
        scanned.current = false;
      }
    },
    [onPaired],
  );

  if (scanning && camPerm?.granted) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <View style={styles.scannerBox}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={(r) => void onScan(r.data)}
          />
          <View style={styles.scanFrame} />
          <Pressable style={styles.cancelBtn} onPress={() => setScanning(false)}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <View style={styles.logoWrap}>
          <Hexagon size={48} color={C.btnPrimary} strokeWidth={2} />
        </View>

        <Text style={styles.title}>Paseo</Text>
        <Text style={styles.subtitle}>Control all computer agents from your phone</Text>

        {pairing ? null : manualPair ? (
          <View style={styles.manualWrap}>
            <TextInput
              style={styles.manualInput}
              value={manualJson}
              onChangeText={setManualJson}
              placeholder='Paste pair JSON ({"relayUrl":...})'
              placeholderTextColor={C.fgFaint}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.manualRow}>
              <Pressable
                style={[styles.btn, styles.btnSecondary, styles.flex1]}
                onPress={() => setManualPair(false)}
              >
                <Text style={styles.btnSecondaryText}>Back</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnPrimary, styles.flex1]}
                onPress={() => void onScan(manualJson.trim())}
              >
                <Text style={styles.btnPrimaryText}>Pair</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.ctaWrap}>
            <Pressable
              style={({ pressed }) => [styles.btn, styles.btnPrimary, styles.btnBlock, pressed && styles.btnPrimaryPressed]}
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
            <Pressable onPress={() => setManualPair(true)} style={styles.secondaryLink}>
              <Text style={styles.secondaryLinkText}>Restore from backup</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.terms}>
          By continuing you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg } as ViewStyle,
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[6],
  } as ViewStyle,
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: RD.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SP[6],
  } as ViewStyle,
  title: {
    color: C.accent, // paseo dark green #307040
    fontSize: 32,
    fontWeight: FW.bold,
    marginBottom: SP[2],
  },
  subtitle: {
    color: C.fgSubtle,
    fontSize: FS.sm,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: SP[8],
    paddingHorizontal: SP[3],
  },
  ctaWrap: { width: "100%", alignItems: "stretch" } as ViewStyle,
  btn: {
    paddingVertical: SP[3],
    paddingHorizontal: SP[5],
    borderRadius: RD.full, // pill
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  btnBlock: { width: "100%" } as ViewStyle,
  btnPrimary: { backgroundColor: C.btnPrimary } as ViewStyle, // BLACK #101010
  btnPrimaryPressed: { backgroundColor: C.btnPrimaryHover } as ViewStyle,
  btnPrimaryText: {
    color: C.btnPrimaryFg,
    fontSize: FS.base,
    fontWeight: FW.semibold,
  },
  btnSecondary: { backgroundColor: C.btnSecondary } as ViewStyle,
  btnSecondaryText: { color: C.btnSecondaryFg, fontSize: FS.base },
  secondaryLink: { alignSelf: "center", marginTop: SP[3], padding: SP[2] },
  secondaryLinkText: { color: C.fgSubtle, fontSize: FS.sm },
  terms: {
    color: C.fgFaint,
    fontSize: FS.xs,
    textAlign: "center",
    marginTop: SP[12],
    paddingHorizontal: SP[6],
    lineHeight: 18,
  },
  flex1: { flex: 1 } as ViewStyle,
  // QR scanner overlay
  scannerBox: { flex: 1, width: "100%", overflow: "hidden" } as ViewStyle,
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
    backgroundColor: C.btnPrimary,
    paddingHorizontal: SP[5],
    paddingVertical: SP[2],
    borderRadius: RD.full,
  } as ViewStyle,
  cancelText: { color: C.btnPrimaryFg, fontSize: FS.sm, fontWeight: FW.semibold },
  // Manual JSON entry
  manualWrap: { width: "100%", marginTop: SP[3] },
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
