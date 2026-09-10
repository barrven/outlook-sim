// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
