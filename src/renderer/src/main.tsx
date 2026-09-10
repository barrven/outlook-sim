import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ComposeWindow from './ComposeWindow'
import './styles/global.css'

const params = new URLSearchParams(window.location.search)
const isCompose = params.get('compose') === '1'
const draftId = params.get('draftId') ?? undefined

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>{isCompose ? <ComposeWindow draftId={draftId} /> : <App />}</React.StrictMode>
)
