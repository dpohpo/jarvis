/**
 * Composer — input + attachments + dictation, paseo-style.
 *
 * Ported from paseo composer with jarvis-specific adaptations:
 *   - Uses jarvis voice.ts for dictation
 *   - Uses jarvis theme system
 *   - Simplified attachments (image only for now)
 *   - Slash autocomplete integration
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  View,
  Pressable,
  Text,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { C, SP, RD, FS, FW, SH } from "../../theme";
import { ArrowUp, Mic, MicOff, Square, X, Image as ImageIcon } from "lucide-react-native";

// Jarvis voice integration
import { startCapture, stopCapture } from "../../voice";

// Slash autocomplete
import { SlashAutocomplete } from "./slash-autocomplete";

// Types
export interface ComposerAttachment {
  kind: "image" | "file";
  id: string;
  uri: string;
  mimeType?: string;
  metadata?: any;
}

export interface MessagePayload {
  text: string;
  attachments: ComposerAttachment[];
  cwd: string;
  forceSend?: boolean;
}

interface Props {
  agentId: string;
  serverId: string;
  cwd: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: (payload: MessagePayload) => void;
  attachments: ComposerAttachment[];
  onChangeAttachments: (attachments: ComposerAttachment[]) => void;
  isAgentRunning?: boolean;
  isProcessing?: boolean;
  isConnected?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

// Slash commands
const SLASH_COMMANDS = [
  { id: "clear", icon: "🗑️", name: "clear", description: "清空对话" },
  { id: "agents", icon: "🤖", name: "agents", description: "切换 Agent" },
  { id: "settings", icon: "⚙️", name: "settings", description: "打开设置" },
  { id: "new", icon: "✨", name: "new", description: "新对话" },
  { id: "help", icon: "❓", name: "help", description: "帮助" },
];

export function Composer(props: Props): React.JSX.Element {
  const {
    agentId,
    serverId,
    cwd,
    value,
    onChangeText,
    onSubmit,
    attachments,
    onChangeAttachments,
    isAgentRunning = false,
    isProcessing = false,
    isConnected = true,
    disabled = false,
    placeholder = "输入消息...",
  } = props;

  const [isDictating, setIsDictating] = useState(false);
  const [inputHeight, setInputHeight] = useState(44);
  const [isFocused, setIsFocused] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ x: 0, y: 0 });
  const dictationChunksRef = useRef<string[]>([]);

  // Dictation handling with jarvis voice.ts
  const startDictation = useCallback(async () => {
    if (!isConnected) return;

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
      console.error("[Composer] Dictation failed:", error);
      setIsDictating(false);
    }
  }, [isConnected]);

  const stopDictation = useCallback(async () => {
    if (isDictating) {
      await stopCapture();
      setIsDictating(false);
    }
  }, [isDictating]);

  // Text input height calculation
  const handleContentSizeChange = useCallback(
    (e: any) => {
      const newHeight = Math.min(120, Math.max(44, e.nativeEvent.contentSize.height));
      setInputHeight(newHeight);
    },
    []
  );

  // Slash command detection
  const handleTextChange = useCallback((text: string) => {
    onChangeText(text);

    // Show autocomplete when typing "/" at the start or after space
    const lastSlashIndex = text.lastIndexOf("/");
    const atStart = lastSlashIndex === 0;
    const afterSpace = lastSlashIndex > 0 && text[lastSlashIndex - 1] === " ";

    if (atStart || afterSpace) {
      setShowAutocomplete(true);
      setAutocompletePosition({ x: SP[3], y: inputHeight + 60 });
    } else {
      setShowAutocomplete(false);
    }
  }, [onChangeText, inputHeight]);

  // Submit handling
  const handleSubmit = useCallback(() => {
    if (disabled || isProcessing) return;

    const trimmedText = value.trim();
    const hasContent = trimmedText.length > 0 || attachments.length > 0;

    if (!hasContent) return;

    onSubmit({
      text: trimmedText,
      attachments,
      cwd,
    });
  }, [value, attachments, cwd, disabled, isProcessing, onSubmit]);

  // Attachment removal
  const handleRemoveAttachment = useCallback(
    (index: number) => {
      onChangeAttachments(attachments.filter((_, i) => i !== index));
    },
    [attachments, onChangeAttachments]
  );

  // Cancel agent
  const handleCancelAgent = useCallback(() => {
    console.log("[Composer] Cancel agent:", agentId);
  }, [agentId]);

  // Slash command selection
  const handleSelectCommand = useCallback((command: any) => {
    console.log("[Composer] Selected command:", command);
    setShowAutocomplete(false);

    // Remove the "/" from the input
    const textWithoutSlash = value.replace(/\/[^/]*$/, "");
    onChangeText(textWithoutSlash + command.name + " ");

    // Execute command action if needed
    command.action?.();
  }, [value, onChangeText]);

  // Check if can submit
  const canSubmit = useMemo(() => {
    return !disabled && !isProcessing && (value.trim().length > 0 || attachments.length > 0);
  }, [disabled, isProcessing, value, attachments]);

  const showCancelButton = isAgentRunning && !canSubmit && !isProcessing;

  return (
    <View style={styles.container}>
      {/* Attachment tray */}
      {attachments.length > 0 && (
        <View style={styles.attachmentTray}>
          {attachments.map((attachment, index) => (
            <View key={attachment.id} style={styles.attachmentPill}>
              {attachment.kind === "image" ? (
                <Image
                  source={{ uri: attachment.uri }}
                  style={styles.attachmentThumbnail}
                />
              ) : (
                <View style={styles.fileIcon}>
                  <ImageIcon size={16} color={C.fgMuted} />
                </View>
              )}
              <TouchableOpacity
                onPress={() => handleRemoveAttachment(index)}
                style={styles.removeButton}
              >
                <X size={14} color={C.fgMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Input row */}
      <View style={styles.inputRow}>
        {/* Cancel button (when agent running) */}
        {showCancelButton ? (
          <TouchableOpacity
            onPress={handleCancelAgent}
            style={[styles.iconButton, styles.cancelButton]}
            disabled={!isConnected}
          >
            <Square size={20} color="white" fill="white" />
          </TouchableOpacity>
        ) : null}

        {/* Text input */}
        <TextInput
          style={[styles.input, { height: inputHeight }]}
          value={value}
          onChangeText={handleTextChange}
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

        {/* Dictation/Submit button */}
        <View style={styles.buttonGroup}>
          {/* Dictation button */}
          {!isAgentRunning && isConnected && (
            <TouchableOpacity
              onPress={isDictating ? stopDictation : startDictation}
              style={[
                styles.iconButton,
                isDictating && styles.dictationButtonActive,
              ]}
              disabled={disabled}
            >
              {isDictating ? (
                <MicOff size={20} color={C.accent} />
              ) : (
                <Mic size={20} color={C.fgMuted} />
              )}
            </TouchableOpacity>
          )}

          {/* Submit button */}
          <TouchableOpacity
            onPress={handleSubmit}
            style={[
              styles.submitButton,
              (!canSubmit || !isConnected) && styles.submitButtonDisabled,
            ]}
            disabled={!canSubmit || !isConnected}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <ArrowUp size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Slash autocomplete */}
      <SlashAutocomplete
        visible={showAutocomplete}
        onSelect={handleSelectCommand}
        position={autocompletePosition}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SP[3],
    paddingVertical: SP[2],
    backgroundColor: C.surface0,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  attachmentTray: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SP[2],
    marginBottom: SP[2],
  },
  attachmentPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface2,
    borderRadius: RD.md,
    paddingHorizontal: SP[2],
    paddingVertical: SP[1],
    gap: SP[2],
  },
  attachmentThumbnail: {
    width: 40,
    height: 40,
    borderRadius: RD.sm,
  },
  fileIcon: {
    padding: SP[1],
  },
  removeButton: {
    padding: SP[1],
  },
  inputRow: {
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
    borderColor: C.border,
    maxHeight: 120,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: SP[2],
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: RD.lg,
    backgroundColor: C.surface2,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: C.destructive,
  },
  dictationButtonActive: {
    backgroundColor: C.accentDim,
  },
  submitButton: {
    width: 36,
    height: 36,
    borderRadius: RD.lg,
    backgroundColor: C.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: C.surface3,
    opacity: 0.5,
  },
});
