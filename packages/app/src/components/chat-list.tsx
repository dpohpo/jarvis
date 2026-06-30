import React, { useRef } from "react";
import { FlatList, View, StyleSheet, Animated } from "react-native";
import { DARK } from "../theme";

const SP = { 4: 16, 3: 12, 2: 8 };
const C = DARK;

export interface Bubble {
  id: string;
  kind: "user" | "jarvis" | "tool" | "error" | "system";
  text: string;
  ts: number;
  taskId?: string;
  taskTitle?: string;
  taskStatus?: string;
  workdir?: string;
}

interface ChatListProps {
  messages: Bubble[];
  renderItem: (item: Bubble) => React.ReactNode;
}

/**
 * 倒序 FlatList - 最新消息在最底部
 * 自动 scrollToEnd，支持 onContentSizeChange 触发滚动
 */
export function ChatList({ messages, renderItem }: ChatListProps) {
  const listRef = useRef<FlatList<Bubble>>(null);
  const scrollAnim = useRef(new Animated.Value(0)).current;

  const handleContentSizeChange = () => {
    // 自动滚动到底部
    listRef.current?.scrollToEnd({ animated: true });
  };

  const handleLayout = () => {
    // 初始布局后滚动到底部
    listRef.current?.scrollToEnd({ animated: false });
  };

  return (
    <FlatList<Bubble>
      ref={listRef}
      data={messages}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <View style={styles.messageRow}>{renderItem(item)}</View>}
      contentContainerStyle={styles.listContent}
      onContentSizeChange={handleContentSizeChange}
      onLayout={handleLayout}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
        { useNativeDriver: false }
      )}
      inverted={false}
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.surface0,
  },
  listContent: {
    padding: SP[4],
    paddingTop: SP[3],
    paddingBottom: SP[4],
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  messageRow: {
    marginBottom: SP[2],
  },
});
