/**
 * Composer types — paseo-compatible types for jarvis.
 */

export interface AttachmentMetadata {
  id: string;
  uri: string;
  mimeType: string;
  fileName?: string;
  size?: number;
}

export interface ComposerAttachment {
  kind: "image" | "file" | "github_pr" | "github_issue";
  id: string;
  uri: string;
  mimeType?: string;
  metadata?: AttachmentMetadata;
  attachment?: {
    type: "uploaded_file";
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    path: string;
  };
  item?: {
    kind: "pr" | "issue";
    number: number;
    title: string;
    state?: string;
  };
}

export interface ImageAttachment {
  id: string;
  uri: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface MessagePayload {
  text: string;
  attachments: ComposerAttachment[];
  cwd: string;
  forceSend?: boolean;
}

export interface QueuedComposerMessage {
  id: string;
  text: string;
  attachments: ComposerAttachment[];
}
