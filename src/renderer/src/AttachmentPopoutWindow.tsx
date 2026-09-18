import { useEffect, useState, type ReactElement } from 'react'
import type { MailMessage, MessageAttachment } from '../../shared/data-types'
import { renderMarkdown } from './markdown'

interface AttachmentPopoutWindowProps {
  messageId: string
  attachmentIndex: number
}

// Feature 067 — a separate window for viewing one attachment, opened from
// either the main window's Reading Pane or a message pop-out window
// (feature 041), reusing this same component either way. An attachment
// isn't its own addressable record — only the parent message and an index
// into its `attachments` array — so this window fetches the message the
// same way MessagePopoutWindow does and reads just the one entry out of it.
function AttachmentPopoutWindow({ messageId, attachmentIndex }: AttachmentPopoutWindowProps): ReactElement {
  const [message, setMessage] = useState<MailMessage | null>(null)
  const [hasFetched, setHasFetched] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.data.messages.get(messageId).then((result) => {
      if (cancelled) return
      setMessage(result)
      setHasFetched(true)
    })
    return () => {
      cancelled = true
    }
  }, [messageId])

  const attachment: MessageAttachment | undefined = message?.attachments[attachmentIndex]

  // The message (or this specific attachment) is gone — deleted elsewhere
  // while this window was open, or the app restarted into stale state.
  // Nothing left to show.
  useEffect(() => {
    if (hasFetched && !attachment) {
      window.close()
    }
  }, [hasFetched, attachment])

  if (!attachment) return <div className="attachment-popout-window" />

  // AC2: an LLM-generated document (065) always ends in `.html` and always
  // carries its Markdown source as `extractedText` — feature 063's real-
  // attachment extraction never supports `.html`, so this combination can
  // only be a generated document, no separate flag needed. Rendered via the
  // same `renderMarkdown` FileVine's note view (and 066's "Save to
  // FileVine") already use, so it looks identical wherever it's viewed.
  const isGeneratedDocument = attachment.filename.toLowerCase().endsWith('.html') && attachment.extractedText !== undefined

  function handleOpenWithDefaultApp(): void {
    if (attachment?.path) void window.api.attachments.open(attachment.path)
  }

  return (
    <div className="attachment-popout-window">
      <div className="attachment-popout-header">{attachment.filename}</div>
      {isGeneratedDocument ? (
        <div
          className="attachment-popout-rendered"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(attachment.extractedText as string) }}
        />
      ) : attachment.extractedText !== undefined ? (
        // AC3: a real attachment's extracted content (063) is plain text,
        // not Markdown source — shown verbatim, not run through a Markdown
        // renderer that could misinterpret incidental special characters.
        <div className="attachment-popout-text">{attachment.extractedText}</div>
      ) : (
        <div className="attachment-popout-fallback">
          <p>No preview is available for this file.</p>
          {attachment.path && (
            <button type="button" onClick={handleOpenWithDefaultApp}>
              Open with your default application
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default AttachmentPopoutWindow
