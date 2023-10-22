// ==UserScript==
// @name        网页格式支持
// @namespace   99545686-aab1-4e8b-a118-2bd7c5eb1ba1
// @version     0.0.1
// @author      hunmer
// @description 解析网页封面，使用内嵌浏览器浏览网页
// @updateURL               
// @primary     1
// ==/UserScript==
$(() => {
    const resourcesPath = g_plugin.getSciptPath() + '网页格式支持/'
    let exts = ['webloc', 'html', 'htm', 'mhtml', 'url']
    g_format.data.category['webpage'] = exts

    const getWebScreenshot = (url, callback) => {
        let win = new nodejs.remote.BrowserWindow({
            show: false,
            width: 1920,
            height: 1080,
            webPreferences: {
                offscreen: true,
                sandbox: true,
                devTools: false,
            }
        })
        let timeout
        win.loadURL(url)
        win.webContents.setAudioMuted(true)
        let done = (a, b, image) => {
            clearTimeout(timeout) & callback(image)
            // win.webContents.capturePage().then(callback).catch(console.error)
            win.close() & win.destroy()
        }
        timeout = setTimeout(done, 1000 * 20)
        win.webContents.on('paint', done)
        win.webContents.setFrameRate(30)
    }

    // g_setting.tabs.plugins.elements['showWebScreenshot'] = {
    //     title: '显示网页封面图',
    //     type: 'switch',
    //     value: () => getConfig('showWebScreenshot', false),
    // }
    // if(getConfig('showWebScreenshot')) 

    const getWebURL = file => {
        let url
        switch (getExtName(file)) {
            case 'webloc':
                let xml = parseXML(nodejs.files.read(file))
                url = xml.getElementsByTagName("string")[0].childNodes[0].nodeValue;
                break
            case 'url':
                let ini = parseINI(nodejs.files.read(file))
                url = ini['InternetShortcut']['URL']
                break

            case 'html':
            case 'mhtml':
            case 'htm':
                url = 'file://' + file
                break;
        }
        console.log(url)
        return url
    }

    g_plugin.registerEvent('markCover', ({ type, args, cb }) => {
        if (type == 'webpage') {
            let queue = g_queue.list['webpage']
            if (!queue) queue = new Queue('webpage', {
                max: 1,
                interval: 1000,
                timeout: 1000 * 20,
                title: '网页封面解析',
            })
            let { input, output } = args
            queue.add(input, {
                output,
                onStatusChange(status, taskCB, file) {
                    if (status != TASK_RUNNING) return
                    let url = getWebURL(file)
                    if (!isEmpty(url) && url.startsWith('http')) {
                        return getWebScreenshot(url, image => {
                            // TODO towebp
                            let isEmpty = !image || image.isEmpty()
                            if (!isEmpty) nodejs.files.write(this.output, image.toJPEG(60))
                            cb(!isEmpty ? this.output : resourcesPath + '404.jpg') & taskCB(TASK_COMPLETED)
                        })
                    }
                    taskCB(TASK_ERROR)
                }
            })
            return false
        }
    })

    const test = cb => g_preview.webview && cb(g_preview.webview)
    g_plugin.registerEvent('webview_openURL', ({ webContents, data }) => {
        let id = webContents.id
        test(webview => {
            if (webview.getWebContentsId() == id) {
                webview.src = data.url
            }
        })
    })

    g_action.registerAction({
        webview_back: () => test(web => web.canGoBack() && web.goBack()),
        webview_forward: () => test(web => web.canGoForward() && web.goForward()),
        webview_input_url: (d, a, e) => e.keyCode == 13 && test(web => web.src = checkStartsWith(d.value, 'http', 'http://')),
        ['plugin_99545686-aab1-4e8b-a118-2bd7c5eb1ba1']: () => {
            g_form.confirm1({
                title: '导入收藏夹',
                id: 'importBookmarks',
                elements: {
                    path: {
                        title: '目标书签夹',
                        type: 'file_chooser',
                        help: '由浏览器导出的书签夹',
                        opts: { properties: ['openFile'], filters: [{ name: '网页文件', extensions: ['html'] }] },
                        value: '',
                    },
                },
                callback({ vals }) {
                    let { path } = vals
                    if (!nodejs.files.exists(path)) {
                        toast('文件不存在')
                        return false
                    }
                    toast('正在解析并写入书签，请耐心等待...')
                    let items = []
                    let $_ = parseHtml(nodejs.files.read(path))
                    let cachePath = nodejs.dir + '/cache/bookmarks/'
                    for (let dt of $_.find('h3')) {
                        let folder = safeFileName(dt.outerText)
                        if (isEmpty(folder)) folder = '未命名收藏夹'
                        for (let a of dt.nextElementSibling.querySelectorAll('dl dt a')) {
                            let url = a.href
                            if (url.startsWith('http')) {
                                let title = safeFileName(a.outerText)
                                let path = cachePath + folder + '/' + title
                                let saveTo, ended = '', i = 0
                                while (nodejs.files.exists((saveTo = path + ended + '.url'))) ended = '_' + (++i)
                                let err = nodejs.files.write(saveTo, '[InternetShortcut]\nURL=' + url)
                                if (!err) items.push({
                                    file: saveTo,
                                    meta: { folders: [folder], url }
                                })
                            }
                        }
                    }
                    console.log(items)
                    let len = items.length
                    if (!len) return toast('没有在收藏夹内找到任何网址!', 'danger')
                    toast('开始导入【' + len + '】个书签中...') & g_data.file_revice(items).then(({ added, exists, error }) => {
                        alert(`${len}个书签中，导入【${added.length}】条,已存在【${exists.length}】条,失败【${error.length}】条`)
                        nodejs.files.removeDir(cachePath)
                    })
                }
            })
        }
    })

    g_preview.register(exts, {
        onFullPreview(ev) {
            let url = getWebURL(ev.data.file)
            if (isEmpty(url)) return toast('没有找到合法的链接', 'danger')
            ev.html = `
            <div class="row w-full m-0">
                <div class="page page-center">
                    <div class="container container-slim py-4">
                        <div class="text-center">
                            <div class="mb-3">
                                <a class="navbar-brand navbar-brand-autodark">
                                    <i class="ti ti-world-www" style="font-size: 4rem;"></i>
                                </a>
                            </div>
                            <div class="mb-3">正在加载网页中...</div>
                            <div class="progress progress-sm">
                                <div class="progress-bar progress-bar-indeterminate"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <webview id="web_preview" data-src="${url}" class="w-full h-full hide" conte≈xtIsolation="false" disablewebsecurity allowpopups spellcheck="false" useragent="Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.134 Safari/537.36 Edg/103.0.1264.71"></webview>
            </div>
        `
            ev.cb = modal => {
                // TODO 触发事件，让高级浏览器接替
                let header = $(`<div class="me-auto flex-fill">
                <div class="d-flex p-2 align-items-center" style="gap: 6px;">
                    <img src="./res/loading.svg" width="20" height="20">
                    <b class="text-nowrap text-center app-region-darg" style="max-width: 200px;min-width: 50px;">loading...</b>
                    <a href='#' title="后退" data-action="webview_back">
                        <i class="ti ti-arrow-left fs-2"></i>
                    </a>
                    <a href='#' title="前进" data-action="webview_forward">
                        <i class="ti ti-arrow-right fs-2"></i>
                    </a>
                    <input class="form-control flex-fill form-control-sm app-nodarg " value="" placeholder="https://" data-keydown="webview_input_url">
                </div>
            </div>`).prependTo('#fullPreview_header')
                let webview = g_preview.webview = $('#web_preview')[0]
                webview.src = webview.dataset.src

                webview.addEventListener('dom-ready', function (e) {
                    // this.openDevTools()
                    modal.find('.page').remove()
                    webview.classList.remove('hide')
                })
                webview.addEventListener('page-favicon-updated', e => header.find('img').attr('src', e.favicons[0]))
                webview.addEventListener('page-title-updated', e => header.find('b').text(e.title).attr('title', e.title))
                webview.addEventListener('did-start-navigation', e => header.find('input').val(e.url))
                webview.addEventListener('did-start-loading', e => header.find('img').attr('src', './res/loading.svg'))
            }
        }
    })
})

