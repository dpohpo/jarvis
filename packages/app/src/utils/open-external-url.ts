/**
 * Open external URL 工具 - 从 paseo utils/open-external-url 提取
 */
import { Linking, Platform } from "react-native";

export async function openExternalUrl(url: string): Promise<boolean> {
  try {
    if (Platform.OS === "web") {
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    }
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to open URL:", error);
    return false;
  }
}
