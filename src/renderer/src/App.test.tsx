import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App shell', () => {
  it('renders the classic three-pane layout with a ribbon on launch', () => {
    render(<App />)

    expect(screen.getByRole('tablist', { name: 'Ribbon tabs' })).toBeInTheDocument()
    expect(screen.getByText('Mailbox')).toBeInTheDocument() // left folder pane
    expect(screen.getByText('Inbox', { selector: '.message-list-header' })).toBeInTheDocument() // center message list
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

    expect(screen.getByText('Mailbox')).toBeInTheDocument()
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

    expect(screen.getByText('Inbox', { selector: '.message-list-header' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Drafts' }))

    expect(screen.getByText('Drafts', { selector: '.message-list-header' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drafts' })).toHaveClass('selected')
  })
})
