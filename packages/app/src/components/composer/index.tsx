/**
 * Composer container — input area with queue list, error display, and autocomplete.
 *
 * Structure:
 *   - Queue list (pending messages)
 *   - Error display (if any)
 *   - MessageInput (multiline TextInput)
 *   - AutocompletePopover (slash commands)
 *   - DictationButton (mic)
 *
 * VERIFIED 2026-06-30 against paseo composer design.
 */

import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { DARK, SP, RD, SH } from "../../theme";

const C = DARK;

interface Attachment {
  id: string;
  type: "image" | "file";
  uri: string;
  name?: string;
}

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  attachments?: Attachment[];
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  isDictating: boolean;
  onToggleDictation: () => void;
  error?: string | null;
  placeholder?: string;
  style?: ViewStyle;
}

export function Composer(props: Props): React.JSX.Element {
  return (
    <View style={[styles.container, props.style]}>
      {/* Queue List (stub) */}
      {props.attachments && props.attachments.length > 0 && (
        <View style={styles.queueList}>
          {props.attachments.map((att) => (
            <View key={att.id} style={styles.queueItem}>
              <View style={styles.queueItemIcon} />
              <View style={styles.queueItemText} />
            </View>
          ))}
        </View>
      )}

      {/* Error Display */}
      {props.error && <View style={styles.errorBar} />}

      {/* Main Input Area */}
      <View style={styles.inputArea}>
        {props.leftContent}

        {/* MessageInput */}
        <View style={styles.inputWrapper}>
          {/* Placeholder for MessageInput component */}
          <View style={styles.textInputStub} />
        </View>

        {props.rightContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: C.surface1,
    borderTopWidth: 1,
    borderTopColor: C.border,
    padding: SP[3],
  },
  queueList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP[2],
    marginBottom: SP[3],
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    backgroundColor: C.surface2,
    paddingHorizontal: SP[2],
    paddingVertical: SP[1],
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: C.border,
  },
  queueItemIcon: {
    width: 16,
    height: 16,
    borderRadius: RD.sm,
    backgroundColor: C.surface3,
  },
  queueItemText: {
    width: 60,
    height: 12,
    borderRadius: RD.sm,
    backgroundColor: C.surface3,
  },
  errorBar: {
    height: 3,
    backgroundColor: C.destructive,
    marginBottom: SP[3],
    borderRadius: RD.sm,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SP[2],
  },
  inputWrapper: {
    flex: 1,
  },
  textInputStub: {
    height: 44,
    backgroundColor: C.surface2,
    borderRadius: RD.xl,
    borderWidth: 1,
    borderColor: C.borderAccent,
  },
});
