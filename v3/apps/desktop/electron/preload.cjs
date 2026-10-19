const { contextBridge, ipcRenderer, webUtils } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('squikDesktop', {
  pathForFile: (file) => webUtils.getPathForFile(file),
  probe: (path) => ipcRenderer.invoke('video:probe', path),
  runJob: (jobId, job) => ipcRenderer.invoke('video:run-job', jobId, job),
  cancelJob: () => ipcRenderer.invoke('video:cancel'),
  onJobProgress: (callback) => subscribe('video:progress', callback),
  onOutputSaved: (callback) => subscribe('output:saved', callback),
  revealOutput: (path) => ipcRenderer.invoke('output:reveal', path),
  shareOutput: (outputUrl, target) => ipcRenderer.invoke('output:share', outputUrl, target),
  onFullScreenChange: (callback) => subscribe('window:fullscreen', callback),
  setTheme: (theme) => ipcRenderer.invoke('theme:set', theme),
});
