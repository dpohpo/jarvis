/**
 * DictationButton — mic button with voice capture state.
 *
 * States:
 *   - Idle: mic icon + accent color
 *   - Recording: stop icon + destructive color + pulse animation
 *
 * Integrates with voice.ts (startCapture/stopCapture).
 */

import React from "react";
import { TouchableOpacity, Text, StyleSheet, Animated } from "react-native";
import { DARK, SP, RD, SH } from "../../theme";

const C = DARK;

interface Props {
  isDictating: boolean;
  onPress: () => void;
}

export function DictationButton(props: Props): React.JSX.Element {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (props.isDictating) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [props.isDictating]);

  const icon = props.isDictating ? "⏹" : "🎤";
  const bgColor = props.isDictating ? C.destructive : C.accent;

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: bgColor }]}
        onPress={props.onPress}
        activeOpacity={0.8}
      >
        <Text style={styles.icon}>{icon}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: RD.full,
    alignItems: "center",
    justifyContent: "center",
    ...SH.sm,
  },
  icon: {
    fontSize: 20,
    color: C.accentForeground,
  },
});
