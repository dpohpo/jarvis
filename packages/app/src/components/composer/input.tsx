/**
 * MessageInput — paseo-style input with dictation support.
 *
 * Features:
 *   - Autosize multiline input
 *   - Dictation button (uses jarvis voice.ts)
 *   - Slash command trigger
 *   - Submit button
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  TextInput,
  StyleSheet,
  View,
  Pressable,
  Text,
  ActivityIndicator,
  TextInputProps,
} from "react-native";
import { C, SP, RD, FS, FW } from "../../theme";
import { ArrowUp, Mic, MicOff } from "lucide-react-native";
import { startCapture, stopCapture } from "../../voice";

// C is imported from theme

export interface MessageInputRef {
  focus: () => void;
  blur: () => void;
  runKeyboardAction: (action: string) => boolean;
}

export interface AttachmentMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}

interface Props extends Omit<TextInputProps, "style"> {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  disabled?: boolean;
  isProcessing?: boolean;
  dictationEnabled?: boolean;
  submitIcon?: "arrow" | "return";
  onPickAttachment?: () => void;
  attachmentMenuItems?: AttachmentMenuItem[];
  cwd?: string;
}

export const MessageInput = forwardRef<MessageInputRef, Props>(
  (props, ref) => {
    const {
      value,
      onChangeText,
      onSubmit,
      placeholder = "输入消息...",
      disabled = false,
      isProcessing = false,
      dictationEnabled = true,
      submitIcon = "arrow",
      onPickAttachment,
      attachmentMenuItems = [],
      cwd = "",
      ...textInputProps
    } = props;

    const [height, setHeight] = useState(44);
    const [isFocused, setIsFocused] = useState(false);
    const [isDictating, setIsDictating] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const dictationChunksRef = useRef<string[]>([]);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        blur: () => inputRef.current?.blur(),
        runKeyboardAction: (action: string) => {
          switch (action) {
            case "send":
              onSubmit?.();
              return true;
            case "dictation-toggle":
              toggleDictation();
              return true;
            case "dictation-cancel":
              if (isDictating) {
                // Stop dictation handled by toggle function
                return true;
              }
              return false;
            default:
              return false;
          }
        },
      }),
      [onSubmit, isDictating]
    );

    const handleContentSizeChange = useCallback(
      (e: any) => {
        const newHeight = Math.min(120, Math.max(44, e.nativeEvent.contentSize.height));
        setHeight(newHeight);
      },
      []
    );

    const handleSubmit = useCallback(() => {
      if (disabled || isProcessing) return;
      onSubmit?.();
    }, [disabled, isProcessing, onSubmit]);

    const toggleDictation = useCallback(async () => {
      if (!dictationEnabled) return;

      if (isDictating) {
        await stopCapture();
        setIsDictating(false);
      } else {
        dictationChunksRef.current = [];
        setIsDictating(true);

        try {
          const ok = await startCapture({
            onChunk: (b64: string) => {
              dictationChunksRef.current.push(b64);
            },
            onAutoEnd: () => {
              setIsDictating(false);
            },
            vad: true,
          });

          if (!ok) {
            setIsDictating(false);
          }
        } catch (error) {
          console.error("[MessageInput] Dictation failed:", error);
          setIsDictating(false);
        }
      }
    }, [dictationEnabled, isDictating]);

    const canSubmit = !disabled && !isProcessing && value.trim().length > 0;

    return (
      <View style={styles.container}>
        <TextInput
          ref={inputRef}
          {...textInputProps}
          style={[
            styles.input,
            {
              height,
              borderColor: isFocused ? C.accent : C.border,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={C.fgSubtle}
          multiline
          textAlignVertical="top"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onContentSizeChange={handleContentSizeChange}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          editable={!disabled}
          autoCorrect={false}
        />

        <View style={styles.buttonRow}>
          {/* Dictation button */}
          {dictationEnabled && (
            <Pressable
              onPress={toggleDictation}
              style={[
                styles.iconButton,
                isDictating && styles.dictationButtonActive,
              ]}
              disabled={disabled}
            >
              {isDictating ? (
                <MicOff size={18} color={C.accent} />
              ) : (
                <Mic size={18} color={C.fgMuted} />
              )}
            </Pressable>
          )}

          {/* Submit button */}
          <Pressable
            onPress={handleSubmit}
            style={[
              styles.submitButton,
              !canSubmit && styles.submitButtonDisabled,
            ]}
            disabled={!canSubmit}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="white" />
            ) : submitIcon === "arrow" ? (
              <ArrowUp size={18} color="white" />
            ) : (
              <Text style={styles.submitButtonText}>↵</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SP[2],
  },
  input: {
    flex: 1,
    backgroundColor: C.surface2,
    borderRadius: RD.xl,
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    fontSize: FS.sm,
    color: C.fg,
    borderWidth: 1,
    maxHeight: 120,
  },
  buttonRow: {
    flexDirection: "row",
    gap: SP[2],
    alignItems: "center",
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: RD.md,
    backgroundColor: C.surface3,
    justifyContent: "center",
    alignItems: "center",
  },
  dictationButtonActive: {
    backgroundColor: C.accentDim,
  },
  submitButton: {
    width: 32,
    height: 32,
    borderRadius: RD.md,
    backgroundColor: C.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: C.surface3,
    opacity: 0.5,
  },
  submitButtonText: {
    color: "white",
    fontSize: FS.base,
    fontWeight: FW.bold,
  },
});
