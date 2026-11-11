// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTheme, THEME_TOKEN_NAMES, themeTokens } from '../../shared/themes'
import { applyCachedTheme, applyTheme } from './theme'

const root = document.documentElement

afterEach(() => {
  root.removeAttribute('style')
  delete root.dataset.theme
  delete root.dataset.themeMode
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('applyTheme', () => {
  it('sets every color token on <html>, from the chosen theme', () => {
    applyTheme('plum')

    const expected = themeTokens(getTheme('plum'))
    for (const name of THEME_TOKEN_NAMES) {
      expect(root.style.getPropertyValue(name)).toBe(expected[name])
    }
  })

  it('names the theme and its mode on <html>, and tells native controls to follow light/dark', () => {
    expect(applyTheme('midnight')).toBe('midnight')

    expect(root.dataset.theme).toBe('midnight')
    expect(root.dataset.themeMode).toBe('dark')
    expect(root.style.colorScheme).toBe('dark')

    applyTheme('sand')
    expect(root.dataset.themeMode).toBe('light')
    expect(root.style.colorScheme).toBe('light')
  })

  it('switching themes replaces every token, leaving nothing from the previous theme', () => {
    applyTheme('dark')
    applyTheme('sage')

    const expected = themeTokens(getTheme('sage'))
    for (const name of THEME_TOKEN_NAMES) {
      expect(root.style.getPropertyValue(name)).toBe(expected[name])
    }
  })

  it('falls back to the default theme for an unknown id', () => {
    expect(applyTheme('neon')).toBe('default')
    expect(root.dataset.theme).toBe('default')
  })

  it('still applies the theme when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })

    expect(applyTheme('plum')).toBe('plum')
    expect(root.dataset.theme).toBe('plum')
  })
})

describe('applyCachedTheme', () => {
  it('applies the default theme on a first run with nothing cached', () => {
    expect(applyCachedTheme()).toBe('default')
    expect(root.dataset.theme).toBe('default')
  })

  it('re-applies the last theme used, so a new window opens in it without waiting for the config', () => {
    applyTheme('midnight')
    root.removeAttribute('style')
    delete root.dataset.theme

    expect(applyCachedTheme()).toBe('midnight')
    expect(root.style.getPropertyValue('--accent')).toBe(themeTokens(getTheme('midnight'))['--accent'])
  })

  it('ignores a cached id that is no longer a theme', () => {
    window.localStorage.setItem('outlook-sim.theme', 'neon')

    expect(applyCachedTheme()).toBe('default')
  })
})
