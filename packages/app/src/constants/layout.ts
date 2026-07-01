/**
 * 布局常量 - 从 paseo constants/layout 提取
 */
import { useWindowDimensions, Platform } from "react-native";

/** 小尺寸设备阈值（px） */
const COMPACT_MAX_WIDTH = 768;

/** 检测当前是否为小尺寸设备（mobile/portable） */
export function useIsCompactFormFactor(): boolean {
  const { width } = useWindowDimensions();
  const isNative = Platform.OS === "ios" || Platform.OS === "android";
  // Native 永远是 compact；web 根据 viewport 宽度判断
  return isNative || width < COMPACT_MAX_WIDTH;
}
