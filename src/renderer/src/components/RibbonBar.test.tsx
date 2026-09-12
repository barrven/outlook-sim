// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RibbonBar from './RibbonBar'

describe('RibbonBar', () => {
  it('renders ribbon tabs and mail actions as disabled placeholders', () => {
    render(<RibbonBar activeModule="mail" />)

    expect(screen.getByRole('button', { name: 'Home' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'New Email' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'New Event' })).not.toBeInTheDocument()
  })

  it('swaps to calendar actions when the calendar module is active', () => {
    render(<RibbonBar activeModule="calendar" />)

    expect(screen.getByRole('button', { name: 'New Event' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New Email' })).not.toBeInTheDocument()
  })

  it('leaves New Event disabled when no onNewEvent handler is provided', () => {
    render(<RibbonBar activeModule="calendar" />)

    expect(screen.getByRole('button', { name: 'New Event' })).toBeDisabled()
  })

  it('enables New Event and calls onNewEvent when a handler is provided', async () => {
    const user = userEvent.setup()
    const onNewEvent = vi.fn()
    render(<RibbonBar activeModule="calendar" onNewEvent={onNewEvent} />)

    const button = screen.getByRole('button', { name: 'New Event' })
    expect(button).toBeEnabled()

    await user.click(button)

    expect(onNewEvent).toHaveBeenCalledTimes(1)
  })

  it('hides New Meeting until meeting invites/RSVP are actually built', () => {
    render(<RibbonBar activeModule="calendar" onNewEvent={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'New Meeting' })).not.toBeInTheDocument()
  })

  it('does not duplicate the Today/Day/Work Week/Week/Month view switcher in the ribbon', () => {
    render(<RibbonBar activeModule="calendar" onNewEvent={vi.fn()} />)

    for (const label of ['Today', 'Day', 'Work Week', 'Week', 'Month']) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
    }
  })

  it('enables New Email and calls onNewEmail when a handler is provided', async () => {
    const user = userEvent.setup()
    const onNewEmail = vi.fn()
    render(<RibbonBar activeModule="mail" onNewEmail={onNewEmail} />)

    const button = screen.getByRole('button', { name: 'New Email' })
    expect(button).toBeEnabled()

    await user.click(button)

    expect(onNewEmail).toHaveBeenCalledTimes(1)
  })

  it('leaves Delete disabled when no onDelete handler is provided', () => {
    render(<RibbonBar activeModule="mail" />)

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('enables Delete and calls onDelete when a handler is provided', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    render(<RibbonBar activeModule="mail" onDelete={onDelete} />)

    const button = screen.getByRole('button', { name: 'Delete' })
    expect(button).toBeEnabled()

    await user.click(button)

    expect(onDelete).toHaveBeenCalledTimes(1)
  })
})
