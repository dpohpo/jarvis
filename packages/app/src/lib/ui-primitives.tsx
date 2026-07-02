/**
 * UI primitives — animation-driven overlays without react-navigation.
 *
 * Why self-implemented:
 *  - jarvis MVP was already using RN's Modal + Pressable + manual layouts.
 *    Pulling in @react-navigation/{native,drawer,native-stack} adds ~6 deps
 *    + forces a prebuild --clean (10 min) for native modules.
 *  - The app's navigation surface is shallow (Login → Main with Drawer +
 *    Modal stack). react-navigation is overkill.
 *
 * Three primitives cover every screenshot:
 *  - Drawer     → LeftSidebar slides in from left (8.jpg)
 *  - BottomSheet → ProviderPicker (3.1.jpg), AddProject (2.1.jpg)
 *  - Popover     → TopBar menus (5.jpg, 6.jpg, 8.1.jpg), Composer + menu (3.2.jpg)
 *  - CenterSheet → SessionPicker (7.jpg)
 *
 * Each uses Animated.timing with useNativeDriver where possible. Backdrop
 * is a Pressable that closes on tap.
 */
import React, { useEffect, useRef } from "react";
import { Animated, Dimensions, Pressable, StyleSheet, View } from "react-native";
import { C } from "../theme";

const SCREEN_W = Dimensions.get("window").width;
const SCREEN_H = Dimensions.get("window").height;

type CommonProps = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

// ---------- Drawer (left sidebar) ----------
export function Drawer({ visible, onClose, children, width = Math.min(SCREEN_W * 0.84, 320) }: CommonProps & { width?: number }) {
  const x = useRef(new Animated.Value(visible ? 0 : -width)).current;
  useEffect(() => {
    Animated.timing(x, {
      toValue: visible ? 0 : -width,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, width, x]);
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <Animated.View style={[styles.drawer, { width, transform: [{ translateX: x }] }]}>
        {children}
      </Animated.View>
    </View>
  );
}

// ---------- BottomSheet ( Composer +, Provider picker, Add project ) ----------
export function BottomSheet({ visible, onClose, children }: CommonProps) {
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.bottomSheet}>
        <View style={styles.handle} />
        {children}
      </View>
    </View>
  );
}

// ---------- CenterSheet ( Session picker ) ----------
export function CenterSheet({ visible, onClose, children }: CommonProps) {
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.centerSheet}>{children}</View>
    </View>
  );
}

// ---------- Popover ( top-bar menus, + button menu, project context menu ) ----------
export function Popover({ visible, onClose, children, position }: CommonProps & { position?: { top?: number; right?: number; left?: number; bottom?: number } }) {
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.popover, position]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: C.backdrop,
  },
  drawer: {
    position: "absolute",
    top: 0, bottom: 0,
    left: 0,
    backgroundColor: C.surfaceSidebar,
  },
  bottomSheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    backgroundColor: C.surface3,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.fgSubtle,
    alignSelf: "center",
    marginBottom: 12,
  },
  centerSheet: {
    position: "absolute",
    left: 12, right: 12,
    top: "30%",
    backgroundColor: C.surface3,
    borderRadius: 24,
    padding: 20,
  },
  popover: {
    position: "absolute",
    backgroundColor: C.surface3,
    borderRadius: 16,
    padding: 8,
    minWidth: 180,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
});

// Re-export SCREEN dimensions for components that need them (Composer autosize, etc.)
export { SCREEN_W, SCREEN_H };
