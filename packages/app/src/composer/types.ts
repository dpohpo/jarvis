/**
 * Composer types — main types file.
 */

export interface ComposerAttachment {
  kind: "image" | "file";
  id: string;
  uri: string;
  mimeType?: string;
}

export interface MessagePayload {
  text: string;
  attachments: ComposerAttachment[];
  cwd: string;
  forceSend?: boolean;
}
