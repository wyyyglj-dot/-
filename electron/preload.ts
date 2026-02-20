import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  showSaveDialog: (options?: Record<string, unknown>) =>
    ipcRenderer.invoke('dialog:save', options),
  showOpenDialog: (options?: Record<string, unknown>) =>
    ipcRenderer.invoke('dialog:open', options),
})
