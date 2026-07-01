/**
 * Attachment Pill 组件 - 从 paseo components/attachment-pill.tsx 提取
 *
 * 源文件: /tmp/paseo-ref/packages/app/src/components/attachment-pill.tsx
 */
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { X } from "lucide-react-native";
import { isNative } from "../constants/platform";
import { useIsCompactFormFactor } from "../constants/layout";
import { C, SP, RD, FS } from "../theme";
import type { AttachmentMetadata } from "../types";

const ATTACHMENT_CONTENT_HEIGHT = 48;

interface AttachmentPillProps {
  onOpen: () => void;
  onRemove: () => void;
  openAccessibilityLabel: string;
  removeAccessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
  children: ReactNode;
}

export function AttachmentPill({
  onOpen,
  onRemove,
  openAccessibilityLabel,
  removeAccessibilityLabel,
  disabled = false,
  testID,
  children,
}: AttachmentPillProps) {
  const isCompact = useIsCompactFormFactor();
  const [isBodyHovered, setIsBodyHovered] = useState(false);
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const alwaysShow = isNative || isCompact;
  const showRemove = alwaysShow || isBodyHovered || isCloseHovered;
  const closeButtonStyle = useMemo(
    () => [styles.closeButton, !showRemove && styles.closeButtonHidden],
    [showRemove],
  );
  const handleBodyHoverIn = useCallback(() => setIsBodyHovered(true), []);
  const handleBodyHoverOut = useCallback(() => setIsBodyHovered(false), []);
  const handleCloseHoverIn = useCallback(() => setIsCloseHovered(true), []);
  const handleCloseHoverOut = useCallback(() => setIsCloseHovered(false), []);
  return (
    <View style={styles.wrapper}>
      <Pressable
        testID={testID}
        onPress={onOpen}
        disabled={disabled}
        onHoverIn={handleBodyHoverIn}
        onHoverOut={handleBodyHoverOut}
        accessibilityRole="button"
        accessibilityLabel={openAccessibilityLabel}
        style={styles.frame}
      >
        {children}
      </Pressable>
      <Pressable
        onPress={onRemove}
        disabled={disabled}
        onHoverIn={handleCloseHoverIn}
        onHoverOut={handleCloseHoverOut}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={removeAccessibilityLabel}
        style={closeButtonStyle}
      >
        <X size={12} color={C.fgMuted} />
      </Pressable>
    </View>
  );
}

interface AttachmentFrameProps {
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  children: ReactNode;
}

/** Bare attachment frame for read-only surfaces (sent messages) — no remove button. */
export function AttachmentFrame({
  onPress,
  accessibilityLabel,
  testID,
  children,
}: AttachmentFrameProps) {
  if (!onPress) {
    return (
      <View testID={testID} style={styles.frame}>
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
      style={styles.frame}
    >
      {children}
    </Pressable>
  );
}

interface AttachmentLabelProps {
  icon?: ReactNode;
  title: string;
  subtitle: string;
}

/** Two-line labelled pill body: attachment name over its type. */
export function AttachmentLabel({ icon, title, subtitle }: AttachmentLabelProps) {
  return (
    <View style={styles.labelBody}>
      {icon ? <View style={styles.labelIcon}>{icon}</View> : null}
      <View style={styles.labelTextColumn}>
        <Text style={styles.labelTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.labelSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

/** Square image preview pill body. */
export function AttachmentThumbnail({ metadata }: { metadata: AttachmentMetadata }) {
  const uri = metadata.uri;
  const source = useMemo(() => ({ uri: uri ?? "" }), [uri]);
  if (!uri) {
    return <View style={styles.thumbnailPlaceholder} />;
  }
  return <Image source={source} style={styles.thumbnail} />;
}

const styles = {
  wrapper: {
    position: "relative" as const,
  },
  frame: {
    borderRadius: RD.md,
    borderWidth: 1,
    borderColor: C.borderAccent,
    overflow: "hidden" as const,
  },
  labelBody: {
    height: ATTACHMENT_CONTENT_HEIGHT,
    maxWidth: 260,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: SP[2],
    paddingHorizontal: SP[3],
    backgroundColor: C.surface1,
  },
  labelIcon: {
    width: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  labelTextColumn: {
    minWidth: 0,
    flexShrink: 1,
  },
  labelTitle: {
    color: C.fg,
    fontSize: FS.sm,
  },
  labelSubtitle: {
    color: C.fgMuted,
    fontSize: FS.xs,
  },
  thumbnail: {
    width: ATTACHMENT_CONTENT_HEIGHT,
    height: ATTACHMENT_CONTENT_HEIGHT,
  },
  thumbnailPlaceholder: {
    width: ATTACHMENT_CONTENT_HEIGHT,
    height: ATTACHMENT_CONTENT_HEIGHT,
    backgroundColor: C.surface1,
  },
  closeButton: {
    position: "absolute" as const,
    top: -8,
    left: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 1,
  },
  closeButtonHidden: {
    opacity: 0,
    pointerEvents: "none" as const,
  },
};
