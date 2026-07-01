/**
 * Jarvis 类型定义 - 从 paseo protocol 和 jarvis 实际使用中提取
 */

// Message 类型（从 paseo @getpaseo/protocol/messages 提取核心字段）
export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  images?: ImageAttachment[];
  metadata?: Record<string, unknown>;
}

export interface Attachment {
  type: string;
  id?: string;
  number?: number;
  name?: string;
  mimeType?: string;
  size?: number;
}

export interface ImageAttachment {
  id: string;
  uri: string;
  mimeType: string;
  size?: number;
  width?: number;
  height?: number;
  alt?: string;
}

// Agent capability flags（从 paseo @getpaseo/protocol/agent-types 提取）
export interface AgentCapabilityFlags {
  rewind?: boolean;
  fork?: boolean;
  files?: boolean;
  tools?: boolean;
}

// Tool call 相关
export interface ToolCallDetail {
  type: string;
  input: unknown;
  output: unknown;
}

// Rewind 模式
export type RewindMode = "conversation" | "files" | "both";

// Fork target
export type AssistantForkTarget = "new-thread" | "branch";

// Attachment metadata（用于图片预览）
export interface AttachmentMetadata {
  id: string;
  uri?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
}
