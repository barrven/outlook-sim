import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ComposeWindow from './ComposeWindow'
import MessagePopoutWindow from './MessagePopoutWindow'
import CalendarPopoutWindow from './CalendarPopoutWindow'
import AttachmentPopoutWindow from './AttachmentPopoutWindow'
import type { ComposeIntent } from '../../shared/data-types'
import { applyCachedTheme, applyTheme } from './theme'
import './styles/tokens.css'
import './styles/base.css'
import './styles/global.css'

const params = new URLSearchParams(window.location.search)
const isCompose = params.get('compose') === '1'
const draftId = params.get('draftId') ?? undefined
const sourceMessageId = params.get('sourceMessageId') ?? undefined
const intent = (params.get('intent') as ComposeIntent | null) ?? undefined
const isMessagePopout = params.get('messagePopout') === '1'
const messageId = params.get('messageId') ?? undefined
const isCalendarPopout = params.get('calendarPopout') === '1'
const seriesId = params.get('seriesId') ?? undefined
const originalStartTimeParam = params.get('originalStartTime')
const originalStartTime = originalStartTimeParam !== null ? Number(originalStartTimeParam) : undefined
const isAttachmentPopout = params.get('attachmentPopout') === '1'
const attachmentMessageId = params.get('messageId') ?? undefined
const attachmentIndexParam = params.get('attachmentIndex')
const attachmentIndex = attachmentIndexParam !== null ? Number(attachmentIndexParam) : undefined

// Every window (main, Compose, pop-outs) is its own document, so each one
// applies the theme itself: straight away from the last-used theme cached
// in localStorage (no flash of the default), then from the persisted
// config, and afterwards from the cross-window broadcast whenever the
// theme is changed anywhere.
applyCachedTheme()
window.api.data.appearance.get().then(({ colorScheme }) => {
  applyTheme(colorScheme)
})
window.api.onAppearanceChanged((colorScheme) => {
  applyTheme(colorScheme)
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isCompose ? (
      <ComposeWindow draftId={draftId} sourceMessageId={sourceMessageId} intent={intent} />
    ) : isMessagePopout && messageId ? (
      <MessagePopoutWindow messageId={messageId} />
    ) : isCalendarPopout && seriesId && originalStartTime !== undefined ? (
      <CalendarPopoutWindow seriesId={seriesId} originalStartTime={originalStartTime} />
    ) : isAttachmentPopout && attachmentMessageId && attachmentIndex !== undefined ? (
      <AttachmentPopoutWindow messageId={attachmentMessageId} attachmentIndex={attachmentIndex} />
    ) : (
      <App />
    )}
  </React.StrictMode>
)
