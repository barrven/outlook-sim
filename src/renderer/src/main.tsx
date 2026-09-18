import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ComposeWindow from './ComposeWindow'
import MessagePopoutWindow from './MessagePopoutWindow'
import CalendarPopoutWindow from './CalendarPopoutWindow'
import type { ComposeIntent } from '../../shared/data-types'
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

// Feature 061 — every window (main, Compose, pop-outs) is its own document
// with its own `data-theme` attribute (058), so each one applies the
// persisted scheme on its own launch here, and stays in sync afterward via
// the same cross-window broadcast the rest of the app uses for live data.
window.api.data.appearance.get().then(({ colorScheme }) => {
  document.documentElement.dataset.theme = colorScheme
})
window.api.onAppearanceChanged((colorScheme) => {
  document.documentElement.dataset.theme = colorScheme
})

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isCompose ? (
      <ComposeWindow draftId={draftId} sourceMessageId={sourceMessageId} intent={intent} />
    ) : isMessagePopout && messageId ? (
      <MessagePopoutWindow messageId={messageId} />
    ) : isCalendarPopout && seriesId && originalStartTime !== undefined ? (
      <CalendarPopoutWindow seriesId={seriesId} originalStartTime={originalStartTime} />
    ) : (
      <App />
    )}
  </React.StrictMode>
)
