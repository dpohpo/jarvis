/**
 * SlashAutocomplete — dropdown that shows above the Composer input when
 * the user has typed "/" at the start of the input. Selecting a slash
 * fills the Composer input.
 *
 * Phase 12 ships UI with a fixed option list. Phase 14 will pull the
 * real command registry from daemon (commands-registry payload).
 */
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { C, FS, RD, SP } from "../theme";
import { useInputStore } from "../stores/input-store";

interface Props {
  visible: boolean;
  options: string[];
}

export function SlashAutocomplete({ visible, options }: Props) {
  const setInput = useInputStore((s) => s.setInput);
  if (!visible) return null;
  return (
    <View style={styles.wrap}>
      {options.map((o) => (
        <Pressable
          key={o}
          style={styles.row}
          onPress={() => setInput(o + " ")}
        >
          <Text style={styles.rowText}>{o}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: C.surface2,
    borderRadius: RD.md,
    marginHorizontal: SP[2],
    marginBottom: SP[1],
    padding: SP[1],
    maxHeight: 200,
  } as ViewStyle,
  row: {
    paddingVertical: SP[1],
    paddingHorizontal: SP[2],
    borderRadius: RD.sm,
  },
  rowText: {
    color: C.fg,
    fontSize: FS.sm,
    fontFamily: "Menlo",
  },
});
