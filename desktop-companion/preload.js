const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('igrisCompanion', {
  // Settings & Window Management
  getSettings: () => ipcRenderer.invoke('companion:get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('companion:save-settings', settings),
  setSize: (size) => ipcRenderer.invoke('companion:set-size', size),
  setOpacity: (opacity) => ipcRenderer.invoke('companion:set-opacity', opacity),
  setAlwaysOnTop: (alwaysOnTop) => ipcRenderer.invoke('companion:set-always-on-top', alwaysOnTop),
  minimize: () => ipcRenderer.invoke('companion:minimize'),
  close: () => ipcRenderer.invoke('companion:close'),
  openSettingsWindow: () => ipcRenderer.invoke('companion:open-settings'),
  
  // Commands & Communications
  sendAiCommand: (commandText) => ipcRenderer.invoke('companion:send-ai-command', commandText),
  restartConnection: () => ipcRenderer.invoke('companion:restart-connection'),
  
  // Event Listeners from Main Process / Socket.IO
  onStateUpdate: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('companion:state-update', handler);
    return () => ipcRenderer.removeListener('companion:state-update', handler);
  },
  onTaskProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('companion:task-progress', handler);
    return () => ipcRenderer.removeListener('companion:task-progress', handler);
  },
  onAgentStatus: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('companion:agent-status', handler);
    return () => ipcRenderer.removeListener('companion:agent-status', handler);
  },
  onVoiceTrigger: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('companion:voice-trigger', handler);
    return () => ipcRenderer.removeListener('companion:voice-trigger', handler);
  }
});
