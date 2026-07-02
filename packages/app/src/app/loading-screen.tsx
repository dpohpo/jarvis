import { ActivityIndicator, View } from "react-native";
import { C } from "../theme";

export function LoadingScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={C.accent} />
    </View>
  );
}
