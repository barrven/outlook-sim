// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { MailMessage } from '../../shared/data-types'

describe('App shell', () => {
  it('renders the classic three-pane layout with a ribbon on launch', async () => {
    render(<App />)

    expect(screen.getByRole('tablist', { name: 'Ribbon tabs' })).toBeInTheDocument()
    expect(screen.getByText('Mailbox')).toBeInTheDocument() // left folder pane
    expect(await screen.findByRole('button', { name: 'Inbox' })).toBeInTheDocument()
    expect(await screen.findByText('Inbox', { selector: '.message-list-header' })).toBeInTheDocument() // center message list
    expect(screen.getByText('Select an item to read.')).toBeInTheDocument() // right reading pane
  })

  it('exposes only Mail and Calendar as switchable modules', () => {
    render(<App />)

    const tabs = screen.getByRole('tablist', { name: 'Modules' })
    const moduleNames = Array.from(tabs.querySelectorAll('[role="tab"]')).map((el) => el.textContent)

    expect(moduleNames).toEqual(['Mail', 'Calendar'])
    for (const disallowed of ['People', 'Tasks', 'Notes']) {
      expect(screen.queryByText(disallowed)).not.toBeInTheDocument()
    }
  })

  it('switches from Mail to Calendar and renders the calendar shell', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Inbox' })).toBeInTheDocument()
    expect(screen.queryByText('My Calendars')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Calendar' }))

    expect(screen.getByText('My Calendars')).toBeInTheDocument()
    expect(screen.getByText('No calendar items to show.')).toBeInTheDocument()
    expect(screen.queryByText('Mailbox')).not.toBeInTheDocument()
    expect(screen.queryByText('Select an item to read.')).not.toBeInTheDocument()
  })

  it('switches the ribbon actions when the active module changes', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(screen.getByRole('button', { name: 'New Email' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Calendar' }))

    expect(screen.getByRole('button', { name: 'New Event' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New Email' })).not.toBeInTheDocument()
  })

  it('selecting a mail folder updates the message list header', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('Inbox', { selector: '.message-list-header' })).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Drafts' }))

    expect(await screen.findByText('Drafts', { selector: '.message-list-header' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drafts' })).toHaveClass('selected')
  })

  it('selecting a message renders it in the reading pane, and switching folders clears the selection', async () => {
    const user = userEvent.setup()
    const message: MailMessage = {
      id: 'msg-1',
      folderId: 'inbox',
      subject: 'Hello there',
      body: 'Body text',
      fromName: 'Alex',
      fromEmail: 'alex@example.com',
      toName: 'Trainee',
      toEmail: 'trainee@example.com',
      timestamp: Date.now(),
      isRead: false,
      isFlagged: false,
      categories: [],
      attachments: []
    }
    vi.mocked(window.api.data.messages.list).mockResolvedValue([message])
    vi.mocked(window.api.data.messages.get).mockResolvedValue(message)

    render(<App />)

    await user.click(await screen.findByText('Hello there'))
    expect(await screen.findByText('Body text')).toBeInTheDocument()

    await user.click(await screen.findByRole('button', { name: 'Drafts' }))
    expect(screen.getByText('Select an item to read.')).toBeInTheDocument()
    expect(screen.queryByText('Body text')).not.toBeInTheDocument()
  })
})
