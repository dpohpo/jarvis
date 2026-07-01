/**
 * 平台检测常量 - 从 paseo constants/platform 提取
 */
import { Platform } from "react-native";

export const isWeb = Platform.OS === "web";
export const isNative = Platform.OS === "ios" || Platform.OS === "android";
export const isIOS = Platform.OS === "ios";
export const isAndroid = Platform.OS === "android";
