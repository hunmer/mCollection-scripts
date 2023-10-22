// ==UserScript==
// @name        剪切板增强
// @namespace   3c5dcc16-2da0-4aa9-aaa8-bb05500d7937
// @version     0.0.1
// @author      hunmer
// @description ctrl+c复制选中文件，ctrl+v导入复制的文件
// @updateURL               
// @primary     1
// ==/UserScript==

({
    path: g_plugin.getSciptPath() + '剪切板增强/',
    init() {
        this.inst = nodejs.require(this.path + 'node_modules/electron-clipboard-ex')

        g_hotkey.register({
            'ctrl+keyc': {
                title: '复制文件',
                content: "doAction('files_copy')",
                type: 2,
            },
            'ctrl+keyv': {
                title: '粘贴文件',
                content: "doAction('files_paste')",
                type: 2,
            },
        })

        g_action.registerAction({
            files_copy: async () => {
                let list = (await g_detail.getSelectedItems()).map(({file}) => file)
                if(list.length){
                    this.inst.writeFilePaths(list)
                    toast('成功复制'+list.length+'个文件到剪切板', 'success')
                }
            },
            files_paste: async () => {
                let list = this.inst.readFilePaths().filter(file => nodejs.files.exists(file))
                if(list.length){
                    toast('正在导入'+list.length+'个文件')
                    return g_data.file_revice(list)
                }
                let img = nodejs.clipboard.readImage()
                if(!img.isEmpty()){
                    toast('正在导入剪切板图片')
                    let {type, value} = g_datalist.tab_getData()
                    value = parseInt(value)
                    
                    let tags = type == 'tags' && !isNaN(value) && (await confirm('是否复制到当前标签?')) ? [value] : []
                    let folders = type == 'folders' && !isNaN(value) && (await confirm('是否复制到当前目录?')) ? [value] : []
                    return g_data.file_revice([{
                        file: img.toDataURL(),
                        meta: {url: '', folders, tags}
                    }])
                }
                
            }
        })
    },

}).init()