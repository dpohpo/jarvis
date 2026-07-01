/**
 * Split composer attachments for submit — paseo-compatible stub.
 */

export interface ComposerAttachment {
  kind: "image" | "file";
  id: string;
  uri: string;
  mimeType?: string;
}

export function splitComposerAttachmentsForSubmit(attachments: ComposerAttachment[]) {
  return {
    attachments: attachments.filter(a => a.kind === "file"),
    images: attachments.filter(a => a.kind === "image"),
  };
}
