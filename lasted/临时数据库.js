// ==UserScript==
// @name        临时数据库
// @namespace   adca6359-5970-4172-90af-08d95e1708ee
// @version     0.0.1
// @author      hunmer
// @description 临时解决数据库被占用问题
// @primary     1
// ==/UserScript==
(() => {
    const find = str => ['//192.168.31.3/影视'].find(prefix=> str.startsWith(prefix) )
    const getSaveTo = url => nodejs.dir + '/fileCache/' + url.substring(2)
    const copyFile = (url, callback) => {
        return new Promise(reslove => {
            let saveTo = getSaveTo(url)
            if(!nodejs.files.exists(saveTo)){
                nodejs.files.makeSureDir(saveTo)
                nodejs.fs.copyFile(url, saveTo).then(() => reslove(saveTo)).catch((error) =>  console.error('Error copying file:', error))
            }else{
                reslove(saveTo)
            }
            callback && callback(saveTo)
        })
    }

    g_plugin.registerEvent('db_switch', data => {
        let { name, opts } = data
        if(find(opts.path) && !opts.file){
            nodejs.files.exists = file =>  find(file) ? true : nodejs.fs.existsSync(file)
            
            let saveTo = nodejs.dir+'/cache/'+name+'.db'
            nodejs.files.copySync(opts.path+'/items.db', saveTo)
            data.opts.file = saveTo
        }
    })

    g_menu.list.datalist_item.items.push(...[
        { text: '删除缓存', icon: 'trash', action: 'item_removeCache' },
    ])

    // 拦截文件并保存到本地
    // TODO 大文件不复制... 复制文件进度
    nodejs.remote.session.defaultSession.protocol.interceptFileProtocol('file', (request, callback) => {
        let url = decodeURI(request.url.substr(5))
        if(!find(url))  return callback(request)
        copyFile(url).then(saveTo => callback({path: saveTo}))
    })

    // 拖动文件时设置源文件为本地文件
    g_plugin.registerEvent('beforeDragingFile', data => {
        data.files = data.files.map(file => {
            if(find(file)){
                let saveTo = getSaveTo(file)
                if(nodejs.files.exists(saveTo)) file = saveTo
            }
            return file
        })
    })

    // 刷新的时候重新加载app（无法正常注销file protocol...)
    window.onbeforeunload = e => {
        nodejs.remote.app.relaunch()
        nodejs.remote.app.exit()
        //nodejs.remote.session.defaultSession.protocol.uninterceptProtocol('file')
    }


    g_setting.tabs.plugins.elements['tagger'] = {
        title: '临时数据库',
        type: 'html',
        value: `
            <button class="btn" data-action="jy_localize">剪映文件本地化</button>
        `
    }

    g_action.registerAction({
        item_removeCache: async () => {
            let cnt = 0;
            (await g_detail.getSelectedItems()).forEach(({file}) => {
                let cache = nodejs.dir + '/fileCache/' + file.substring(2)
                console.log({cache})
                if(nodejs.files.exists(cache)){
                    nodejs.files.remove(cache)
                    cnt++
                }
            })
            toast('成功删除'+cnt+'个缓存文件', 'success')
            g_menu.hideMenu('datalist_item')
        }, 
        jy_localize: () => {
            openFileDiaglog({
                id: 'jy_localize',
                title: '选择剪映项目目录',
                properties: ['openDirectory'],
            }, path => {
                if (!isEmpty(path[0])) {
                    let file = path[0] + '/draft_meta_info.json'
                    if(!nodejs.files.exists(file)) return toast('错误的目录', 'danger')
                    parseJson(file)
                }
            })
        }
    })

function parseJson(file){
    let json = nodejs.fs.readJSONSync(file)
    let promises = []
    json.draft_materials.forEach(data => {
        data.value.forEach(video => {
            let file = video.file_Path
            if(find(file)){
                promises.push(copyFile(file, saveTo => {
                    video.file_Path = saveTo
                    console.log({file, saveTo})
                }))
            }
        })
    })
    Promise.all(promises).then(() => {
        nodejs.fs.writeJSONSync(file, json)
        alert('任務完成')
    })
}

})()
