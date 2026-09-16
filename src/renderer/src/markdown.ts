import { marked } from 'marked'
import DOMPurify from 'dompurify'

marked.setOptions({ gfm: true, breaks: true })

// Renders Markdown source to sanitized HTML for display (feature 048's
// "formatted, not raw" note view). This is the app's first
// dangerouslySetInnerHTML use, so sanitize on principle even though note
// content is trainee-authored, single-user data.
export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(marked.parse(source, { async: false }))
}
