// ==UserScript==
// @name        素材参考台
// @namespace   1751343a-6357-4784-967e-e618c57fe31b
// @version     0.0.1
// @author      hunmer
// @description 支持把多个素材放在一个画布上自由调整层级大小
// @updateURL               
// @primary     1
// ==/UserScript==


var g_canvas ={
    path: g_plugin.getSciptPath() + '素材参考台/',
    init(){
        g_menu.list.datalist_item.items.push(...[
            { text: '导入到参考图', icon: 'layout-board-split', action: 'canvas_importItem' },
        ])

        g_action.registerAction({
            canvas_importItem: async () => {
                let list = (await g_detail.getSelectedItems()).map(({file}) => file)
                if(list.length){
                    toast('正在导入【'+list.length+'】张图片到参考台...')
                    this.importURL(list)
                }
                g_menu.hideMenu('datalist_item')
            },
        })

        // this.createWindow()
    },

    importURL(url){
        this.sendMsg('addURL', {url})
    },

    createWindow(){
        if(this.win && !this.win.isDestroyed()) this.win.destroy()
        const path = this.path
        const win = this.win = new nodejs.remote.BrowserWindow({
            width: 700,
            height: 700,
            frame: false,
            alwaysOnTop: false,
            skipTaskbar: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: true,
                preload: path + 'preload.js',
            }
        })
        win.loadFile(path + 'index.html')
        const contents = win.webContents
        nodejs.require("@electron/remote/main").enable(contents)
        contents.on('dom-ready', e => {
            // contents.openDevTools()
            Object.entries(this.msglist).forEach(([k, v]) => this.sendMsg(k, v))
            this.msglist = {}
        })
        contents.on('ipc-message', (e, channel, ...args) => {
            switch (channel) {
                case 'exit':
                    return win.close()
            }
        });
    },
    // API请求
    request(url, success){
        return ajax_request({url: 'http://127.0.0.1:12784/'+url, success, timeout: 3000})
    },
    // 服务端是否开启
    isAlive(){
        return new Promise(reslove => {
            this.request('getStatus', data => reslove(data.success != undefined))
        }) 
    },

    msglist: {}, // 待发送的消息队列
    async sendMsg(k, v){
        if(!this.win || this.win.isDestroyed() || !(await this.isAlive())){
            this.msglist[k] = v
            return this.createWindow()
        }
        this.win.webContents.send(k, v)
    },
}

g_canvas.init()