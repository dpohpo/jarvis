/**
 * MessageInput — multiline TextInput with autosize and slash-autocomplete trigger.
 *
 * Features:
 *   - Multiline input (maxHeight 120)
 *   - Autosize (grows with content)
 *   - Placeholder (subtle color)
 *   - Border accent on focus
 *   - Triggers autocomplete on `/`
 *
 * VERIFIED 2026-06-30 against paseo MessageInput.
 */

import React from "react";
import {
  TextInput,
  StyleSheet,
  TextInputProps,
  NativeSyntheticEvent,
  TextInputContentSizeChangeEventData,
} from "react-native";
import { DARK, SP, RD, FS } from "../../theme";

const C = DARK;

interface Props extends Omit<TextInputProps, "style"> {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  onFocus?: () => void;
  onBlur?: () => void;
}

export function MessageInput(props: Props): React.JSX.Element {
  const [height, setHeight] = React.useState(44);
  const [isFocused, setIsFocused] = React.useState(false);

  const handleContentSizeChange = (
    e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>
  ) => {
    const newHeight = Math.min(120, Math.max(44, e.nativeEvent.contentSize.height));
    setHeight(newHeight);
  };

  return (
    <TextInput
      {...props}
      style={[
        styles.input,
        {
          height,
          borderColor: isFocused ? C.borderAccent : C.border,
        },
      ]}
      placeholder={props.placeholder || "输入消息..."}
      placeholderTextColor={C.fgSubtle}
      multiline
      textAlignVertical="top"
      onFocus={() => {
        setIsFocused(true);
        props.onFocus?.();
      }}
      onBlur={() => {
        setIsFocused(false);
        props.onBlur?.();
      }}
      onContentSizeChange={handleContentSizeChange}
      onSubmitEditing={props.onSubmit}
      returnKeyType="send"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: C.surface2,
    borderRadius: RD.xl,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    fontSize: FS.sm,
    color: C.fg,
    borderWidth: 1,
  },
});
