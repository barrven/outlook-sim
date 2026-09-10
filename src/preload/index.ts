import { contextBridge } from 'electron'

const api = {}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-expect-error (define in dts)
  window.api = api
}
