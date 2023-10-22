const { getCurrentWindow, getCurrentWebContents } = require('@electron/remote');
const { contextBridge, ipcRenderer } = require('electron')

const _app = getCurrentWindow();
const _webContent = getCurrentWebContents();
const express = require('../../server/node_modules/express')
const app = express()

app.get('/getStatus', (req, res) => {
    res.json({success: 'ok'})
})

app.listen(12784, () => {
    console.log('Server started on port 12784, http://127.0.0.1:12784/getStatus')
})

contextBridge.exposeInMainWorld('nodejs', {
    method(data) {
        let {type, msg} = data
        switch (type) {
            case 'min':
                return _app.minimize()
            case 'max':
                return _app.isMaximized() ? _app.unmaximize() : _app.maximize()
            case 'close':
                return _app.close()
            case 'openFile':
                return shell.openPath(d.replaceAll('/', '\\'))
            case 'url':
                return shell.openExternal(msg);
            case 'reload':
                return location.reload()
            case 'copy':
                clipboard.writeText(msg)
                return toast && toast('复制成功', 'success')
            case 'toggleFullscreen':
                return _app.setFullScreen(!_app.fullScreen);
            case 'openFolder':
                return shell.showItemInFolder(msg.replaceAll('/', '\\'))
            case 'devtool':
                return _webContent.toggleDevTools()
            default:
                return send(data);
        }
    },
    files: require('../../../public/file'),
    dir: __dirname,
    path: require('path'),
    registerIPC(...args) {
        const register = ([name, cb]) => ipcRenderer.on(name, (event, args) => cb(args, event))
        if (typeof (args[0]) == 'object') {
            Object.entries(args[0]).forEach(register)
        } else {
            register(...args)
        }
    }
})

function send(channel, args = {}) {
    ipcRenderer.send(channel, args)
}