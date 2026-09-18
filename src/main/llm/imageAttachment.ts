import { readFileSync } from 'fs'
import { extname } from 'path'

// Minimum required by AC1; kept small on purpose rather than guessing at
// every format each provider's vision endpoint happens to accept.
const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
}

export interface ImageAttachmentData {
  mimeType: string
  base64Data: string
}

/**
 * Reads a real image attachment's raw bytes off disk for multimodal LLM
 * input (feature 064) — never OCR'd or text-extracted, matching the spec's
 * Non-goals. Never throws: an unsupported extension, missing file, or any
 * other read failure all resolve to `undefined`, the same convention
 * `extractAttachmentText` (feature 063) uses.
 */
export function readImageAttachment(filePath: string): ImageAttachmentData | undefined {
  const mimeType = IMAGE_MIME_TYPES[extname(filePath).toLowerCase()]
  if (!mimeType) return undefined
  try {
    return { mimeType, base64Data: readFileSync(filePath).toString('base64') }
  } catch {
    return undefined
  }
}
