// ==UserScript==
// @name        图片解析下载
// @namespace   86b6291d-0725-4894-96a3-4f6790920f5f
// @version     0.0.1
// @author      hunmer
// @description 用gallery-dl(https://github.com/mikf/gallery-dl)进行图片解析下载
// @updateURL               
// @primary     1
// ==/UserScript==

({
    path: g_plugin.getSciptPath()+'图片解析下载/',
    init(){
        this.download('https://www.weibo.com/2092858922/NgDZHeTA2')
    },

    // TODO 日志显示，并显示实时下载图片，可以选择图片，下载队列
    download(url, opts = {}){
        // TODO 兼容macos
        let params = {
            'json': '-j',
            'verbose': '-v',
        }
        if(true){
            params['proxy'] = '--proxy http://127.0.0.1:7890'
        }

        let raw = ''
        let cmd = Object.values(params).join(' ') + ` "${url}" -q`
        let proc = nodejs.cli.run(this.path+'/myenv/Scripts/gallery-dl', cmd, {
            iconv: true,
        }, {
            onOutput: msg => {
                // console.log(msg)
                raw += msg
            },
            onExit: () => {
                let json = JSON.parse(raw)
                console.log(json)

                // TODO 写入一些附带属性


            }
        })
    },

}).init()