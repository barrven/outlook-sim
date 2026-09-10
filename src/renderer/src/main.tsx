import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ComposeWindow from './ComposeWindow'
import type { ComposeIntent } from '../../shared/data-types'
import './styles/global.css'

const params = new URLSearchParams(window.location.search)
const isCompose = params.get('compose') === '1'
const draftId = params.get('draftId') ?? undefined
const sourceMessageId = params.get('sourceMessageId') ?? undefined
const intent = (params.get('intent') as ComposeIntent | null) ?? undefined

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isCompose ? (
      <ComposeWindow draftId={draftId} sourceMessageId={sourceMessageId} intent={intent} />
    ) : (
      <App />
    )}
  </React.StrictMode>
)
