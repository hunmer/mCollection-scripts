// ==UserScript==
// @name        悬浮图标
// @namespace   5f9a5222-743b-4fe5-bf8b-6a020f29e576
// @version     0.0.1
// @author      hunmer
// @description 支持拖入文件
// @updateURL               
// @primary     1
// ==/UserScript==

(() => {
    const resourcesPath = g_plugin.getSciptPath() + '悬浮图标/'
    const win = new nodejs.remote.BrowserWindow({
        width: 50,
        height: 50,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizeable: false,
        webPreferences: {
            nodeIntegration: true,
            preload: 'file://'+resourcesPath + 'preload.js',
        }
    })
    console.log(win)
   
    win.loadFile(resourcesPath + 'index.html')
    // remote.ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    //     const win = BrowserWindow.fromWebContents(event.sender)
    //     win.setIgnoreMouseEvents(ignore, options)
    //  })
    // win.on('dragstart', (event) => {
    //     event.preventDefault()
    // })
    // win.on('mousedown', (event) => {
    //     if (event.button === 0) {
    //         win.setIgnoreMouseEvents(true)
    //         win.webContents.send('dragging')
    //     }
    // })
    // win.on('mouseup', (event) => {
    //     if (event.button === 0) {
    //         win.setIgnoreMouseEvents(false)
    //     }
    // })
    win.webContents.openDevTools()
    //   const contextMenu = Menu.buildFromTemplate([
    //     { label: '菜单项1', click: () => console.log('点击了菜单项1') },
    //     { label: '菜单项2', click: () => console.log('点击了菜单项2') },
    //     { type: 'separator' },
    //     { label: '退出', role: 'quit' }
    //   ])
    //   tray.setContextMenu(contextMenu)
})()
