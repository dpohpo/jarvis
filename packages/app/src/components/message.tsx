/**
 * Message 组件 - 从 paseo components/message.tsx 像素级复刻
 *
 * Port 规则：
 * 1. 直接复制 paseo JSX、样式、动画
 * 2. 改 import：@getpaseo/* → jarvis 相对路径
 * 3. 改 theme：unistyles → jarvis C tokens
 * 4. 改类型：Message → jarvis types.Message
 *
 * 源文件: /tmp/paseo-ref/packages/app/src/components/message.tsx (3205 行)
 *
 * 当前版本: 核心骨架 + UserMessage + AssistantMessage
 * TODO: 后续补全 SpeakMessage、ActivityLog、ToolCall、ExpandableBadge 等
 */
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  type GestureResponderEvent,
  type LayoutChangeEvent,
  StyleProp,
  ViewStyle,
  type TextStyle,
} from "react-native";
import * as React from "react";
import {
  useState,
  useEffect,
  useRef,
  memo,
  useMemo,
  useCallback,
  createContext,
  useContext,
} from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Check,
  Copy,
  ChevronRight,
  ChevronDown,
  X,
  FileText,
  Circle,
  Info,
  CheckCircle,
  XCircle,
  Scissors,
  MicVocal,
  TriangleAlertIcon,
  CheckSquare,
} from "lucide-react-native";
import { StyleSheet } from "react-native-unistyles";
import { C, SP, RD, FS, FW } from "../theme";
import type { Message, Attachment, ImageAttachment, RewindMode } from "../types";
import { useIsCompactFormFactor } from "../constants/layout";
import { isWeb, isNative } from "../constants/platform";
import { formatDuration, formatMessageTimestamp } from "../utils/time";

// ============================================================================
// Context & Utilities
// ============================================================================

const MessageOuterSpacingContext = createContext(false);

export function MessageOuterSpacingProvider({
  disableOuterSpacing,
  children,
}: {
  disableOuterSpacing: boolean;
  children: ReactNode;
}) {
  return (
    <MessageOuterSpacingContext.Provider value={disableOuterSpacing}>
      {children}
    </MessageOuterSpacingContext.Provider>
  );
}

function useDisableOuterSpacing(disableOuterSpacing: boolean | undefined) {
  const contextValue = useContext(MessageOuterSpacingContext);
  return disableOuterSpacing ?? contextValue;
}

// 常量
const STREAM_METADATA_FONT_SIZE = 13;
const MARKDOWN_TOP_LEVEL_MAX_EXCEEDED_ITEM = <Text key="dotdotdot">...</Text>;

// ============================================================================
// UserMessage
// ============================================================================

interface UserMessageProps {
  serverId?: string;
  agentId?: string;
  messageId?: string;
  message: string;
  images?: ImageAttachment[];
  attachments?: Attachment[];
  timestamp: number;
  capabilities?: any; // AgentCapabilityFlags
  client?: any; // DaemonClient | null
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  disableOuterSpacing?: boolean;
}

const userMessageStylesheet = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "flex-end",
    ...(isWeb ? { userSelect: "text" as const } : {}),
  },
  content: {
    alignItems: "flex-end",
    maxWidth: "100%",
    cursor: "auto",
  },
  containerSpacing: {
    marginBottom: SP[2],
  },
  containerFirstInGroup: {
    marginTop: SP[4],
  },
  containerLastInGroup: {
    marginBottom: SP[4],
  },
  bubble: {
    backgroundColor: C.surface3,
    borderRadius: RD["2xl"],
    borderTopRightRadius: RD.sm,
    paddingHorizontal: SP[4],
    paddingVertical: SP[4],
    minWidth: 0,
    flexShrink: 1,
  },
  text: {
    color: C.fg,
    fontSize: FS.base,
    ...(isWeb ? { lineHeight: 22, overflowWrap: "anywhere" as const } : {}),
  },
  imagePreviewContainer: {
    flexDirection: "row",
    gap: SP[2],
    flexWrap: "wrap",
  },
  attachmentPreviewContainer: {
    flexDirection: "row",
    gap: SP[2],
    flexWrap: "wrap",
  },
  imagePreviewSpacing: {
    marginBottom: SP[2],
  },
  copyButton: {
    alignSelf: "center",
    padding: SP[1],
    paddingTop: SP[1],
    marginTop: 0,
    marginRight: -SP[1],
  },
  trailingRow: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    marginTop: SP[2],
  },
  trailingRowHidden: {
    opacity: 0,
  },
  trailingRowVisible: {
    opacity: 1,
  },
  timestampText: {
    color: C.fgMuted,
    fontSize: STREAM_METADATA_FONT_SIZE,
  },
});

interface UserMessageImagePillProps {
  image: ImageAttachment;
  onOpen: (image: ImageAttachment) => void;
  accessibilityLabel: string;
}

function UserMessageImagePill({ image, onOpen, accessibilityLabel }: UserMessageImagePillProps) {
  const handlePress = useCallback(() => {
    onOpen(image);
  }, [onOpen, image]);
  return (
    <AttachmentFrame onPress={handlePress} accessibilityLabel={accessibilityLabel}>
      <AttachmentThumbnail metadata={image} />
    </AttachmentFrame>
  );
}

export const UserMessage = memo(function UserMessage({
  serverId,
  agentId,
  messageId,
  message,
  images = [],
  attachments = [],
  timestamp,
  capabilities,
  client,
  isFirstInGroup = true,
  isLastInGroup = true,
  disableOuterSpacing,
}: UserMessageProps) {
  const isCompact = useIsCompactFormFactor();
  const [isHovered, setIsHovered] = useState(false);
  const [lightboxMetadata, setLightboxMetadata] = useState<ImageAttachment | null>(null);
  const handleLightboxClose = useCallback(() => setLightboxMetadata(null), []);
  const resolvedDisableOuterSpacing = useDisableOuterSpacing(disableOuterSpacing);
  const hasText = message.trim().length > 0;
  const hasImages = images.length > 0;
  const hasAttachments = attachments.length > 0;
  const showTrailingRow = hasText && (isCompact || isNative || isHovered);
  const formattedTimestamp = useMemo(
    () => formatMessageTimestamp(new Date(timestamp)),
    [timestamp],
  );

  // TODO: rewind integration
  // const rewindMutation = useRewindAgentMutation({ serverId, agentId, client, messageId });

  const handlePointerEnter = useCallback(() => setIsHovered(true), []);
  const handlePointerLeave = useCallback(() => setIsHovered(false), []);
  const getMessageContent = useCallback(() => message, [message]);

  const containerStyle = useMemo(
    () => [
      userMessageStylesheet.container,
      !resolvedDisableOuterSpacing && [
        isFirstInGroup ? userMessageStylesheet.containerFirstInGroup : null,
        isLastInGroup ? userMessageStylesheet.containerLastInGroup : null,
        !isFirstInGroup || !isLastInGroup ? userMessageStylesheet.containerSpacing : null,
      ],
    ],
    [resolvedDisableOuterSpacing, isFirstInGroup, isLastInGroup],
  );
  const imagePreviewContainerStyle = useMemo(
    () => [
      userMessageStylesheet.imagePreviewContainer,
      hasText || hasAttachments ? userMessageStylesheet.imagePreviewSpacing : undefined,
    ],
    [hasAttachments, hasText],
  );
  const attachmentPreviewContainerStyle = useMemo(
    () => [
      userMessageStylesheet.attachmentPreviewContainer,
      hasText ? userMessageStylesheet.imagePreviewSpacing : undefined,
    ],
    [hasText],
  );
  const trailingRowStyle = useMemo(
    () => [
      userMessageStylesheet.trailingRow,
      showTrailingRow
        ? userMessageStylesheet.trailingRowVisible
        : userMessageStylesheet.trailingRowHidden,
    ],
    [showTrailingRow],
  );

  return (
    <View style={containerStyle} testID="user-message">
      <View
        style={userMessageStylesheet.content}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <View style={userMessageStylesheet.bubble}>
          {hasImages ? (
            <View style={imagePreviewContainerStyle}>
              {images.map((image) => (
                <UserMessageImagePill
                  key={image.id}
                  image={image}
                  onOpen={setLightboxMetadata}
                  accessibilityLabel="Open image"
                />
              ))}
            </View>
          ) : null}
          {hasAttachments ? (
            <View style={attachmentPreviewContainerStyle}>
              {attachments.map((attachment, index) => {
                // TODO: Attachment pill content
                return (
                  <AttachmentFrame
                    key={`${attachment.type}:${"number" in attachment ? attachment.number : index}`}
                  >
                    <Text style={{ color: C.fgMuted, fontSize: FS.sm }}>
                      {attachment.name || `Attachment ${index + 1}`}
                    </Text>
                  </AttachmentFrame>
                );
              })}
            </View>
          ) : null}
          {hasText ? (
            <Text selectable style={userMessageStylesheet.text}>
              {message}
            </Text>
          ) : null}
        </View>
        {hasText ? (
          <View style={trailingRowStyle} pointerEvents={showTrailingRow ? "auto" : "none"}>
            <Text style={userMessageStylesheet.timestampText}>{formattedTimestamp}</Text>
            {/* TODO: RewindMenu */}
            <TurnCopyButton
              getContent={getMessageContent}
              containerStyle={userMessageStylesheet.copyButton}
              accessibilityLabel="Copy message"
            />
          </View>
        ) : null}
      </View>
      {/* TODO: AttachmentLightbox */}
    </View>
  );
});

// ============================================================================
// AssistantMessage
// ============================================================================

interface AssistantMessageProps {
  message: string;
  timestamp: number;
  workspaceRoot?: string;
  serverId?: string;
  client?: any; // DaemonClient | null
  spacing?: "default" | "compactTop" | "compactBottom" | "compactBoth";
}

export const assistantMessageStylesheet = StyleSheet.create({
  container: {
    paddingVertical: SP[3],
    ...(isWeb ? { userSelect: "text" as const } : {}),
  },
  containerCompactTop: {
    paddingTop: 0,
  },
  containerCompactBottom: {
    paddingBottom: 0,
  },
  imageFrame: {
    width: "100%",
    minHeight: 160,
    marginHorizontal: -SP[1],
  },
  imageSurface: {
    width: "100%",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imageState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SP[4],
    paddingVertical: SP[6],
    gap: SP[2],
  },
  imageErrorText: {
    color: C.fgMuted,
    fontSize: FS.sm,
    textAlign: "center",
  },
});

export const AssistantMessage = memo(function AssistantMessage({
  message,
  timestamp: _timestamp,
  workspaceRoot,
  serverId,
  client,
  spacing = "default",
}: AssistantMessageProps) {
  // 简化版：先不使用完整的 MarkdownRenderer，改用轻量级渲染
  // TODO: 后续补全 MarkdownRenderer + 完整 markdown 渲染
  const { renderMarkdownLite } = require("../lib/markdown");

  const assistantContainerStyle = useMemo(
    () => [
      assistantMessageStylesheet.container,
      (spacing === "compactTop" || spacing === "compactBoth") &&
        assistantMessageStylesheet.containerCompactTop,
      (spacing === "compactBottom" || spacing === "compactBoth") &&
        assistantMessageStylesheet.containerCompactBottom,
    ],
    [spacing],
  );

  return (
    <View testID="assistant-message" style={assistantContainerStyle}>
      {renderMarkdownLite(message)}
    </View>
  );
});

// ============================================================================
// TurnCopyButton
// ============================================================================

const turnCopyButtonStylesheet = StyleSheet.create({
  container: {
    alignSelf: "flex-start",
    padding: SP[2],
    paddingTop: 0,
    marginTop: SP[2],
  },
  iconColor: {
    color: C.fgMuted,
  },
  iconHoveredColor: {
    color: C.fg,
  },
});

interface TurnCopyButtonProps {
  getContent: () => string;
  containerStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  copiedAccessibilityLabel?: string;
}

export const TurnCopyButton = memo(function TurnCopyButton({
  getContent,
  containerStyle,
  accessibilityLabel,
  copiedAccessibilityLabel,
}: TurnCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(async () => {
    const content = getContent();
    if (!content) {
      return;
    }

    // TODO: 使用 Clipboard.setStringAsync
    // await Clipboard.setStringAsync(content);
    setCopied(true);

    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }

    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      copyTimeoutRef.current = null;
    }, 1500);
  }, [getContent]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const pressableStyle = useMemo(
    () => [turnCopyButtonStylesheet.container, containerStyle],
    [containerStyle],
  );

  return (
    <Pressable
      onPress={handleCopy}
      style={pressableStyle}
      accessibilityRole="button"
      accessibilityLabel={copied ? copiedAccessibilityLabel ?? "Copied" : accessibilityLabel ?? "Copy"}
    >
      {({ pressed }) => {
        const iconColor = pressed
          ? turnCopyButtonStylesheet.iconHoveredColor.color
          : turnCopyButtonStylesheet.iconColor.color;
        return copied ? (
          <Check size={16} color={iconColor} />
        ) : (
          <Copy size={16} color={iconColor} />
        );
      }}
    </Pressable>
  );
});

// ============================================================================
// AttachmentFrame & AttachmentThumbnail (stub)
// ============================================================================

interface AttachmentFrameProps {
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  children: ReactNode;
}

export function AttachmentFrame({
  onPress,
  accessibilityLabel,
  testID,
  children,
}: AttachmentFrameProps) {
  if (!onPress) {
    return (
      <View testID={testID} style={attachmentStyles.frame}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={attachmentStyles.frame}
    >
      {children}
    </Pressable>
  );
}

export function AttachmentThumbnail({ metadata }: { metadata: ImageAttachment }) {
  const source = useMemo(() => ({ uri: metadata.uri }), [metadata.uri]);
  if (!metadata.uri) {
    return <View style={attachmentStyles.thumbnailPlaceholder} />;
  }
  return <Image source={source} style={attachmentStyles.thumbnail} />;
}

const attachmentStyles = StyleSheet.create({
  frame: {
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: C.borderAccent,
    overflow: "hidden",
  },
  thumbnail: {
    width: 48,
    height: 48,
  },
  thumbnailPlaceholder: {
    width: 48,
    height: 48,
    backgroundColor: C.surface1,
  },
});

// ============================================================================
// AssistantTurnFooter
// ============================================================================

interface AssistantTurnFooterProps {
  getContent: () => string;
  completedAt?: Date;
  durationMs?: number;
  forkBoundaryMessageId?: string;
  onFork?: (input: {
    target: any; // AssistantForkTarget
    boundaryMessageId?: string;
  }) => Promise<void> | void;
}

const assistantTurnFooterStylesheet = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  copyButton: {
    alignSelf: "center",
    padding: SP[1],
    paddingTop: SP[1],
    marginTop: 0,
    marginLeft: -SP[1],
  },
  labelWrapper: {
    position: "relative",
  },
  labelSizer: {
    color: C.fgMuted,
    fontSize: STREAM_METADATA_FONT_SIZE,
    opacity: 0,
  },
  labelOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    color: C.fgMuted,
    fontSize: STREAM_METADATA_FONT_SIZE,
  },
});

const TIMESTAMP_REVEAL_MS = 3000;

export const AssistantTurnFooter = memo(function AssistantTurnFooter({
  getContent,
  completedAt,
  durationMs,
  forkBoundaryMessageId,
  onFork,
}: AssistantTurnFooterProps) {
  const [hovered, setHovered] = useState(false);
  const [pressedReveal, setPressedReveal] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, []);

  const durationLabel = useMemo(
    () => (durationMs !== undefined ? `Worked for ${formatDuration(durationMs)}` : ""),
    [durationMs],
  );
  const timestampLabel = useMemo(
    () => (completedAt ? formatMessageTimestamp(completedAt) : ""),
    [completedAt],
  );

  const canSwap = Boolean(timestampLabel);
  const showTimestamp = canSwap && (isWeb ? hovered : pressedReveal);

  const handleHoverIn = useCallback(() => setHovered(true), []);
  const handleHoverOut = useCallback(() => setHovered(false), []);
  const handlePress = useCallback(() => {
    if (isWeb || !canSwap) return;
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
    }
    setPressedReveal((prev) => !prev);
    revealTimerRef.current = setTimeout(() => {
      setPressedReveal(false);
      revealTimerRef.current = null;
    }, TIMESTAMP_REVEAL_MS);
  }, [canSwap]);

  return (
    <View style={assistantTurnFooterStylesheet.container}>
      <TurnCopyButton
        getContent={getContent}
        containerStyle={assistantTurnFooterStylesheet.copyButton}
      />
      {/* TODO: ForkMenu */}
      {durationLabel ? (
        <Pressable
          onPress={handlePress}
          onHoverIn={handleHoverIn}
          onHoverOut={handleHoverOut}
          accessibilityRole={canSwap ? "button" : undefined}
          accessibilityLabel={canSwap ? `${durationLabel}, ended ${timestampLabel}` : durationLabel}
        >
          <View style={assistantTurnFooterStylesheet.labelWrapper}>
            <Text style={assistantTurnFooterStylesheet.labelSizer} aria-hidden>
              {durationLabel.length >= timestampLabel.length ? durationLabel : timestampLabel}
            </Text>
            <Text style={assistantTurnFooterStylesheet.labelOverlay}>
              {showTimestamp ? timestampLabel : durationLabel}
            </Text>
          </View>
        </Pressable>
      ) : null}
    </View>
  );
});

// ============================================================================
// LiveElapsed
// ============================================================================

interface LiveElapsedProps {
  startedAt: Date;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export const LiveElapsed = memo(function LiveElapsed({
  startedAt,
  style,
  testID,
}: LiveElapsedProps) {
  const startedAtMs = startedAt.getTime();
  const [elapsedMs, setElapsedMs] = useState(() => Math.max(0, Date.now() - startedAtMs));

  useEffect(() => {
    setElapsedMs(Math.max(0, Date.now() - startedAtMs));
    const handle = setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - startedAtMs));
    }, 100);
    return () => clearInterval(handle);
  }, [startedAtMs]);

  return (
    <Text style={style} testID={testID}>
      {formatDuration(elapsedMs)}
    </Text>
  );
});

// ============================================================================
// SpeakMessage
// ============================================================================

interface SpeakMessageProps {
  message: string;
  timestamp: number;
  disableOuterSpacing?: boolean;
}

const speakMessageStylesheet = StyleSheet.create({
  container: {
    paddingVertical: SP[3],
  },
  containerSpacing: {
    marginBottom: SP[4],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
    marginBottom: SP[2],
  },
  headerLabel: {
    fontSize: FS.base,
    fontWeight: FW.normal,
    color: C.fgMuted,
  },
  text: {
    fontSize: FS.base,
    lineHeight: 22,
    color: C.fg,
  },
});

export const SpeakMessage = memo(function SpeakMessage({
  message,
  timestamp: _timestamp,
  disableOuterSpacing,
}: SpeakMessageProps) {
  const resolvedDisableOuterSpacing = useDisableOuterSpacing(disableOuterSpacing);
  const containerStyle = useMemo(
    () => [
      speakMessageStylesheet.container,
      !resolvedDisableOuterSpacing && speakMessageStylesheet.containerSpacing,
    ],
    [resolvedDisableOuterSpacing],
  );

  return (
    <View testID="speak-message" style={containerStyle}>
      <View style={speakMessageStylesheet.header}>
        <MicVocal size={12} color={C.fgMuted} />
        <Text style={speakMessageStylesheet.headerLabel}>Voice Output</Text>
      </View>
      <Text style={speakMessageStylesheet.text}>{message}</Text>
    </View>
  );
});

// ============================================================================
// ActivityLog
// ============================================================================

interface ActivityLogProps {
  type: "system" | "info" | "success" | "error" | "artifact";
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  artifactId?: string;
  artifactType?: string;
  title?: string;
  onArtifactClick?: (artifactId: string) => void;
  disableOuterSpacing?: boolean;
}

const activityLogStylesheet = StyleSheet.create({
  pressable: {
    borderRadius: RD.md,
    overflow: "hidden",
  },
  pressableSpacing: {
    marginBottom: SP[1],
  },
  pressableActive: {
    opacity: 0.7,
  },
  systemBg: {
    backgroundColor: "rgba(39, 39, 42, 0.5)",
  },
  infoBg: {
    backgroundColor: "rgba(30, 58, 138, 0.3)",
  },
  successBg: {
    backgroundColor: "rgba(20, 83, 45, 0.3)",
  },
  errorBg: {},
  artifactBg: {
    backgroundColor: "rgba(30, 58, 138, 0.4)",
  },
  content: {
    paddingHorizontal: SP[3],
    paddingVertical: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SP[2],
  },
  iconContainer: {
    flexShrink: 0,
    height: 20,
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  messageText: {
    fontSize: FS.sm,
    lineHeight: 20,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SP[1],
  },
  detailsText: {
    color: C.fgMuted,
    fontSize: FS.xs,
    marginRight: SP[1],
  },
  metadataContainer: {
    marginTop: SP[2],
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: RD.base,
    padding: SP[2],
    borderWidth: 1,
    borderColor: C.border,
  },
  metadataText: {
    color: C.fg,
    fontSize: FS.code,
    fontFamily: "monospace",
    lineHeight: 16,
  },
});

export const ActivityLog = memo(function ActivityLog({
  type,
  message,
  timestamp: _timestamp,
  metadata,
  artifactId,
  artifactType,
  title,
  onArtifactClick,
  disableOuterSpacing,
}: ActivityLogProps) {
  const resolvedDisableOuterSpacing = useDisableOuterSpacing(disableOuterSpacing);
  const [isExpanded, setIsExpanded] = useState(false);

  const typeConfig = {
    system: {
      bg: activityLogStylesheet.systemBg,
      color: "#a1a1aa",
      Icon: Circle,
    },
    info: { bg: activityLogStylesheet.infoBg, color: "#60a5fa", Icon: Info },
    success: {
      bg: activityLogStylesheet.successBg,
      color: "#4ade80",
      Icon: CheckCircle,
    },
    error: {
      bg: activityLogStylesheet.errorBg,
      color: "#f87171",
      Icon: XCircle,
    },
    artifact: {
      bg: activityLogStylesheet.artifactBg,
      color: "#93c5fd",
      Icon: FileText,
    },
  };

  const config = typeConfig[type];
  const IconComponent = config.Icon;

  const handlePress = useCallback(() => {
    if (type === "artifact" && artifactId && onArtifactClick) {
      onArtifactClick(artifactId);
    } else if (metadata) {
      setIsExpanded((prev) => !prev);
    }
  }, [type, artifactId, onArtifactClick, metadata]);

  const displayMessage =
    type === "artifact" && artifactType && title ? `${artifactType}: ${title}` : message;

  const isInteractive = type === "artifact" || metadata;
  const pressableStyle = useMemo(
    () => [
      activityLogStylesheet.pressable,
      !resolvedDisableOuterSpacing && activityLogStylesheet.pressableSpacing,
      config.bg,
      isInteractive && activityLogStylesheet.pressableActive,
    ],
    [resolvedDisableOuterSpacing, config.bg, isInteractive],
  );
  const messageTextStyle = useMemo(
    () => [activityLogStylesheet.messageText, { color: config.color }],
    [config.color],
  );

  return (
    <Pressable onPress={handlePress} disabled={!isInteractive} style={pressableStyle}>
      <View style={activityLogStylesheet.content}>
        <View style={activityLogStylesheet.row}>
          <View style={activityLogStylesheet.iconContainer}>
            <IconComponent size={16} color={config.color} />
          </View>
          <View style={activityLogStylesheet.textContainer}>
            <Text style={messageTextStyle} selectable>
              {displayMessage}
            </Text>
            {metadata && (
              <View style={activityLogStylesheet.detailsRow}>
                <Text style={activityLogStylesheet.detailsText}>Details</Text>
                {isExpanded ? (
                  <ChevronDown size={12} color="#71717a" />
                ) : (
                  <ChevronRight size={12} color="#71717a" />
                )}
              </View>
            )}
          </View>
        </View>
        {isExpanded && metadata && (
          <View style={activityLogStylesheet.metadataContainer}>
            <Text style={activityLogStylesheet.metadataText}>
              {JSON.stringify(metadata, null, 2)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
});

// ============================================================================
// CompactionMarker
// ============================================================================

interface CompactionMarkerProps {
  status: "loading" | "completed";
  trigger?: "auto" | "manual";
  preTokens?: number;
}

const compactionStylesheet = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SP[3],
    paddingHorizontal: SP[4],
    gap: SP[2],
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  label: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  text: {
    fontSize: 13,
    color: C.fgMuted,
  },
});

export const CompactionMarker = memo(function CompactionMarker({
  status,
  trigger,
  preTokens,
}: CompactionMarkerProps) {
  const label = `${status === "loading" ? "Compacting" : "Compacted"} ${
    trigger === "auto" ? "automatically" : "manually"
  }${preTokens !== undefined ? ` ${preTokens} tokens` : ""}`;

  return (
    <View style={compactionStylesheet.container}>
      <View style={compactionStylesheet.line} />
      <View style={compactionStylesheet.label}>
        {status === "loading" ? (
          <ActivityIndicator size="small" color="#a1a1aa" />
        ) : (
          <Scissors size={12} color="#a1a1aa" />
        )}
        <Text style={compactionStylesheet.text}>{label}</Text>
      </View>
      <View style={compactionStylesheet.line} />
    </View>
  );
});

// ============================================================================
// TodoListCard (stub)
// ============================================================================

interface TodoEntry {
  text: string;
  completed: boolean;
}

interface TodoListCardProps {
  items: TodoEntry[];
  disableOuterSpacing?: boolean;
}

const todoListCardStylesheet = StyleSheet.create({
  detailsWrapper: {
    padding: SP[2],
  },
  list: {
    gap: SP[1],
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP[2],
  },
  radioBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.fgMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioBadgeIncomplete: {
    opacity: 0.55,
  },
  radioBadgeComplete: {
    opacity: 0.95,
  },
  itemText: {
    flex: 1,
    color: C.fg,
    fontSize: FS.base,
  },
  itemTextCompleted: {
    color: C.fgMuted,
    textDecorationLine: "line-through",
  },
  emptyText: {
    color: C.fgMuted,
    fontSize: FS.base,
  },
});

function TodoListItemRow({ text, completed }: { text: string; completed: boolean }) {
  const badgeStyle = useMemo(
    () => [
      todoListCardStylesheet.radioBadge,
      completed
        ? todoListCardStylesheet.radioBadgeComplete
        : todoListCardStylesheet.radioBadgeIncomplete,
    ],
    [completed],
  );
  const textStyle = useMemo(
    () => [todoListCardStylesheet.itemText, completed && todoListCardStylesheet.itemTextCompleted],
    [completed],
  );
  return (
    <View style={todoListCardStylesheet.itemRow}>
      <View style={badgeStyle}>
        {completed ? <Check size={12} color={C.fg} /> : null}
      </View>
      <Text style={textStyle}>{text}</Text>
    </View>
  );
}

export const TodoListCard = memo(function TodoListCard({
  items,
  disableOuterSpacing,
}: TodoListCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const nextTask = useMemo(() => items.find((item) => !item.completed)?.text, [items]);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const renderDetails = useCallback(() => {
    return (
      <View style={todoListCardStylesheet.detailsWrapper}>
        <View style={todoListCardStylesheet.list}>
          {items.length === 0 ? (
            <Text style={todoListCardStylesheet.emptyText}>No tasks</Text>
          ) : (
            items.map((item) => (
              <TodoListItemRow key={item.text} text={item.text} completed={item.completed} />
            ))
          )}
        </View>
      </View>
    );
  }, [items]);

  return (
    <ExpandableBadge
      label="Tasks"
      secondaryLabel={nextTask}
      icon={CheckSquare}
      isExpanded={isExpanded}
      onToggle={handleToggle}
      renderDetails={renderDetails}
      disableOuterSpacing={disableOuterSpacing}
    />
  );
});

// ============================================================================
// ExpandableBadge (stub - 完整版本需要 2000+ 行，先简化)
// ============================================================================

interface ExpandableBadgeProps {
  label: string;
  secondaryLabel?: string;
  icon?: ComponentType<{ size?: number; color?: string }>;
  isExpanded: boolean;
  style?: StyleProp<ViewStyle>;
  onToggle?: () => void;
  onOpenFile?: () => void;
  onDetailHoverChange?: (hovered: boolean) => void;
  renderDetails?: () => ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  isLastInSequence?: boolean;
  disableOuterSpacing?: boolean;
  testID?: string;
}

const expandableBadgeStylesheet = StyleSheet.create({
  container: {
    marginHorizontal: -13,
  },
  containerSpacing: {
    marginBottom: SP[1],
  },
  containerLastInSequence: {
    marginBottom: SP[4],
  },
  pressable: {
    borderRadius: RD.lg,
    borderWidth: 1,
    borderColor: "transparent",
    paddingHorizontal: SP[2],
    paddingVertical: SP[1],
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  labelRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  iconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SP[1],
    backgroundColor: "transparent",
  },
  label: {
    color: C.fgMuted,
    fontSize: FS.base,
    fontWeight: FW.normal,
    flexShrink: 0,
  },
  labelActive: {
    color: C.fg,
  },
  secondaryLabel: {
    flexShrink: 1,
    minWidth: 0,
    color: C.fgMuted,
    fontSize: FS.base,
    fontWeight: FW.normal,
    marginLeft: SP[2],
  },
  secondaryLabelActive: {
    color: C.fg,
  },
  chevron: {
    flexShrink: 0,
    transform: [{ scale: 1.3 }],
  },
  chevronExpanded: {
    transform: [{ scale: 1.3 }, { rotate: "90deg" }],
  },
  detailWrapper: {
    borderBottomLeftRadius: RD.lg,
    borderBottomRightRadius: RD.lg,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: C.border,
    padding: 0,
    gap: 0,
    flexShrink: 1,
    minWidth: 0,
    overflow: "hidden",
    ...(isWeb ? { cursor: "auto" as const, userSelect: "text" as const } : {}),
  },
});

export const ExpandableBadge = memo(function ExpandableBadge({
  label,
  secondaryLabel,
  icon,
  isExpanded,
  style,
  onToggle,
  renderDetails,
  isLoading = false,
  isError = false,
  isLastInSequence = false,
  disableOuterSpacing,
  testID,
}: ExpandableBadgeProps) {
  const resolvedDisableOuterSpacing = useDisableOuterSpacing(disableOuterSpacing);
  const [isHovered, setIsHovered] = useState(false);
  const isInteractive = Boolean(onToggle);
  const hasDetailContent = Boolean(renderDetails);
  const detailContent = hasDetailContent && isExpanded ? renderDetails?.() : null;

  const containerStyle = useMemo(
    () => [
      expandableBadgeStylesheet.container,
      !resolvedDisableOuterSpacing &&
        (isLastInSequence
          ? expandableBadgeStylesheet.containerLastInSequence
          : expandableBadgeStylesheet.containerSpacing),
      style,
    ],
    [isLastInSequence, resolvedDisableOuterSpacing, style],
  );

  const isActive = isHovered || isExpanded;

  const labelStyle = useMemo(
    () => [
      expandableBadgeStylesheet.label,
      isActive && expandableBadgeStylesheet.labelActive,
      isLoading && { opacity: 0.72 },
    ],
    [isActive, isLoading],
  );

  const secondaryLabelStyle = useMemo(
    () => [
      expandableBadgeStylesheet.secondaryLabel,
      isActive && expandableBadgeStylesheet.secondaryLabelActive,
    ],
    [isActive],
  );

  const chevronStyle = useMemo(
    () => [
      expandableBadgeStylesheet.chevron,
      isExpanded && expandableBadgeStylesheet.chevronExpanded,
    ],
    [isExpanded],
  );

  return (
    <View style={containerStyle} testID={testID}>
      <Pressable
        onPress={onToggle}
        disabled={!isInteractive}
        style={expandableBadgeStylesheet.pressable}
      >
        <View style={expandableBadgeStylesheet.headerRow}>
          <View style={expandableBadgeStylesheet.iconBadge}>
            {icon && React.createElement(icon, { size: 12, color: isActive ? C.fg : C.fgMuted })}
          </View>
          <View style={expandableBadgeStylesheet.labelRow}>
            <Text style={labelStyle} numberOfLines={1}>
              {label}
            </Text>
            {secondaryLabel ? (
              <Text style={secondaryLabelStyle} numberOfLines={1}>
                {secondaryLabel}
              </Text>
            ) : null}
          </View>
          {isInteractive ? (
            isExpanded ? (
              <ChevronDown size={12} style={chevronStyle} color={C.fgMuted} />
            ) : (
              <ChevronRight size={12} style={chevronStyle} color={C.fgMuted} />
            )
          ) : null}
        </View>
      </Pressable>
      {detailContent ? (
        <View style={expandableBadgeStylesheet.detailWrapper}>{detailContent}</View>
      ) : null}
    </View>
  );
});

// ============================================================================
// ToolCall (stub)
// ============================================================================

interface ToolCallProps {
  toolName: string;
  args?: unknown;
  result?: unknown;
  error?: unknown;
  status: "executing" | "running" | "completed" | "failed" | "canceled";
  detail?: any; // ToolCallDetail
  cwd?: string;
  metadata?: Record<string, unknown>;
  isLastInSequence?: boolean;
  disableOuterSpacing?: boolean;
  onInlineDetailsHoverChange?: (hovered: boolean) => void;
  onInlineDetailsExpandedChange?: (expanded: boolean) => void;
  onOpenFilePath?: (filePath: string) => void;
}

export const ToolCall = memo(function ToolCall({
  toolName,
  status,
  isLastInSequence = false,
  disableOuterSpacing,
}: ToolCallProps) {
  const presentation = {
    displayName: toolName,
    summary: status === "running" ? "Running..." : status === "completed" ? "Done" : "Failed",
    icon: FileText,
    isLoadingDetails: status === "running",
  };

  return (
    <ExpandableBadge
      testID="tool-call-badge"
      label={presentation.displayName}
      secondaryLabel={presentation.summary}
      icon={presentation.icon}
      isExpanded={false}
      onToggle={undefined}
      isLoading={status === "running"}
      isError={status === "failed"}
      isLastInSequence={isLastInSequence}
      disableOuterSpacing={disableOuterSpacing}
    />
  );
});
