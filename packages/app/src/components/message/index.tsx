/**
 * ChatBubble — picks the right sub-component by Bubble.kind.
 *
 *  user      → UserMessage (right-aligned, accent fill)
 *  assistant → AssistantMessage (left-aligned, markdown)
 *  tool      → ToolUseBlock (left-aligned, collapsible, purple bar)
 *  error     → ErrorBubble (left-aligned, red bar)
 *  system    → SystemBubble (centered, pill chip)
 *  local     → UserMessage (treat local echoes like user bubbles)
 *  approval  → ApprovalBubble (Phase 15-v10; inline Tier 3 approval card)
 */
import type { Bubble } from "../../stores/session-store";
import { UserMessage } from "./user-message";
import { AssistantMessage } from "./assistant-message";
import { ToolUseBlock } from "./tool-use-block";
import { ErrorBubble } from "./error-bubble";
import { SystemBubble } from "./system-bubble";
import { ApprovalBubble } from "./approval-bubble";

export function ChatBubble({ bubble }: { bubble: Bubble }) {
  switch (bubble.kind) {
    case "user":
    case "local":
      return <UserMessage bubble={bubble} />;
    case "assistant":
      return <AssistantMessage bubble={bubble} />;
    case "tool":
      return <ToolUseBlock bubble={bubble} />;
    case "error":
      return <ErrorBubble bubble={bubble} />;
    case "system":
      return <SystemBubble bubble={bubble} />;
    case "approval":
      return <ApprovalBubble bubble={bubble} />;
  }
}
