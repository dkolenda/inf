// Most między edytorem a procesem głównym: folder projektu (zapis, otwieranie) i klasy TypeScript (kompilacja, pliki .ts, VS Code).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jsgameNative', {
  project: {
    create: (name) => ipcRenderer.invoke('project:create', { name }),
    open: () => ipcRenderer.invoke('project:open'),
    save: (file, json) => ipcRenderer.invoke('project:save', { file, json }),
    saveSync: (file, json) => ipcRenderer.sendSync('project:save-sync', { file, json }),
    loadSync: (file) => ipcRenderer.sendSync('project:load-sync', { file }),
    reveal: (dir) => ipcRenderer.invoke('project:reveal', { dir })
  },
  ts: {
    // place — { project, dir }: z nim wynik ma mapę źródeł do pliku .ts (debuger VS Code).
    compile: (source, name, place) => ipcRenderer.invoke('ts:compile', { source, name, ...place }),
    open: (info) => ipcRenderer.invoke('ts:open', info),
    write: (info) => ipcRenderer.invoke('ts:write', info),
    forget: (id) => ipcRenderer.invoke('ts:forget', { id }),
    onChanged: (callback) => ipcRenderer.on('ts:changed', (event, data) => callback(data)),
    // Zadanie „Kompiluj i odśwież” z VS Code: reload czyta klasy z plików, refreshed odpowiada zadaniu.
    onRefresh: (callback) => {
      ipcRenderer.on('ts:refresh', (event, data) => callback(data));
      ipcRenderer.invoke('ts:listen');
    },
    reload: (info) => ipcRenderer.invoke('ts:reload', info),
    refreshed: (id, ok, message) => ipcRenderer.invoke('ts:refreshed', { id, ok, message })
  }
});
