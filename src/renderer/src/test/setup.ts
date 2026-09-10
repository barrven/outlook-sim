import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { createMockApi } from './mockApi'

if (typeof window !== 'undefined') {
  beforeEach(() => {
    window.api = createMockApi()
  })
}

afterEach(() => {
  cleanup()
})
