// ==UserScript==
// @name        文件浏览器
// @namespace   9db557b5-7e8e-46e7-a762-31716c412847
// @version     0.0.1
// @author      hunmer
// @description 基于everything的文件浏览器
// @updateURL               
// @primary     1
// ==/UserScript==

var g_fb = {
    // api: 'http://192.168.31.3:8080',
    api: 'http://127.0.0.1:8080',

    openFolder(folder) {
        if (!folder.endsWith('/')) folder += '/'
        console.log(folder)
        let { root, dir, base } = nodejs.path.parse(folder)
        g_datalist.tab_new({
            icon: 'folder-filled', title: base || root, pagePre: 30,
            maxPage: 99999,
            view: 'default',
            sqlite: {
                opts: {
                    type: 'filebrowser',
                    folder, extra: '',
                }
            }
        })
    },

    dirFiles(folder, extra) {
        return this.doSearch({
            search: this.isGlobalSearch() ? '': {
                '': folder,
                depth: folder.split('/').length - 1,
            },
            extra
        })
    },
    defaultQuery: '{search} !attrib:<!H !O> {extra}',

    doSearch(opts) {
        return new Promise(reslove => {
            Object.assign(opts, {
                //rule: {name: ' '},
                query: this.defaultQuery, // 不显示隐藏文件 不显示离线文件
                path_column: 1,
                size_column: 1,
                date_modified_column: 1,
                date_created_column: 1,
                attributes_column: 1,
            })

            this.search(opts).then(data => {
                reslove({
                    opts,
                    results: data.results.map(item => {
                        let { name, path, size, type } = item
                        let file = path + '\\' + name
                        let ext = getExtName(file)
                        let md5 = nodejs.files.getMd5(file)
                        let cover = (type == 'folder' || g_format.isThumbSupport(ext)) ? 'thumb://' + file : g_format.getFormatIcon(ext)
                        let vals = {
                            type, file, md5,
                            title: name,
                            size: parseInt(size),
                            link: file,
                            cover,
                        }
                        g_data.cache.set(md5, vals)
                        return vals
                    })
                })
            })
        })
    },

    // 设置收藏列表
    saveFavorites(list){
        console.log(list)
        setConfig('filebrowser_favorties', list)
    },

    // 获取收藏列表
    getFavorites(){
        return getConfig('filebrowser_favorties', [])
    },

    refresh() {
        let list = {}
        this.data.list.forEach(({ title, icon, path }) => {
            title ??= getFileName(path)
            list[path] = { title, icon }
        })
        g_category.set('localFolders', {
            action: 'category_localFolders',
            list,
        })
    },

    init() {
        const self = this
        const _key = 'localFolders'
        this.data = new basedata({
            name: _key,
            defaultList: [],
            primarykey: 'path',
            // list: local_readJson(_key, []),
            list: [],
            saveData: data => local_saveJson(_key, data),
        })

        g_lang.adds({
            [_key]: {
                zh: '本地目录',
                en: '',
            }
        })

        g_category.registerAction(_key, (dom, action) => {
            // _inst.menu_key = action[2]
            let { dropdown_id } = this.getInst(action[2])
            g_dropdown.show(dropdown_id, dom)
        })
        g_action.registerAction({
            ['category_' + _key]: dom => this.openFolder(dom.dataset.name),
            [_key + '_add']: () => {
                // TODO 展示类型
                // this.callInst(dom.dataset.name, 'modal_edit', -1)
                // this.modal_edit(-1)
            },
            [_key + '_clear']: () => confirm('确定清空吗？', { type: 'danger' }).then(() => this.reset())
        })

        this.toolbar_list = {
            drives: {
                desc: '盘符',
                icon: 'server',
                click: async () => {
                    return g_tabler.build_dropdown({
                        items: (await this.getDrives()).map(({icon, path}) => {
                            return {
                                title: `<i class="ti ti-${icon} me-2"></i>${path}`,
                                action: 'filebrowser_toPath',
                                props: `data-value="${path}"`
                            }
                        })
                    })
                }
            },
            favorite: {
                desc: '收藏',
                icon: 'star',
                click: () => {
                    return g_tabler.build_dropdown({
                        items: [{title: '收藏当前目录', icon: 'plus', path: this.getPath(), action: 'filebrowser_favorite'}, undefined, ...this.getFavorites()].map(data => {
                            if(!data) return
                            let {icon = 'folder', path, title, action = 'filebrowser_toPath'} = data
                            return {
                                action,
                                title: `<i class="ti ti-${icon} me-2"></i>${title || getFileName(path)}`,
                                props: `data-value="${path}"`
                            }
                        })
                    })
                },
            }
        }

        // 切换标签更新过滤器
        g_plugin.registerEvent('datalist.tabChanged', ({ tab, inst }) => {
            let tabData = inst.getData(tab)
            let sqlite = tabData?.data?.sqlite
            let isBrowser = sqlite?.type == 'filebrowser'
            $('#everything_bars').remove()

            if(isBrowser){
                let path = sqlite.opts.folder
                let toolbar = $(`
                <div id="everything_bars" class="w-full row m-0 p-0 align-items-center">
                    <div class="col-4 p-0 ps-2 d-flex" id="everything_paths">
                        
                    </div>
                    <div class="col-2 p-0 d-flex flex-nowrap justify-content-end">
                        ${Object.entries(this.toolbar_list).map(([k, { desc, icon, title }]) => {
                            return `
                            <div class="p-2" data-name="${k}">
                                <a class="nav-link dropdown-toggle" data-contenx="ef,clear" data-action="ef,click" data-bs-toggle="tooltip" data-bs-placement="top" title="${desc}">
                                    ${icon ? `<i class="ti ti-${icon}"></i>` : ''}
                                    ${title || ''}
                                    <span class="badge bg-primary ms-2 hide1"></span>
                                </a>
                            </div>`
                        }).join('')}
                    </div>
                    <div class="col-6 p-2">
                        <div class="input-group input-group-flat p-0 ">
                            <span class="input-group-text p-1">
                                <input name="everything_gsearch" class="form-check-input m-0" type="checkbox" data-bs-toggle="tooltip" data-bs-placement="top" title="全局搜索" />
                            </span>
                            <input class="form-control form-control-sm m-0" id="everything_search" placeholder="表达式..." data-input="everything_search,input">
                            <span class="input-group-text p-1 pt-0">
                                <a href="#" class="link-secondary me-2" data-action="everything_search,clear" title="清空搜索" data-bs-toggle="tooltip">
                                    <i class="ti ti-x"></i>
                                </a>
                                <a href="#" class="link-secondary" data-action="everything_search,add" title="添加搜索" data-bs-toggle="tooltip">
                                    <i class="ti ti-plus"></i>
                                </a>
                            </span>
                        </div>
                    </div>
                </div>
                `).insertAfter('#filters')
                toolbar.find('[data-bs-toggle="tooltip"]').each((i, el) => new bootstrap.Tooltip(el))
                this.toPath()
            }
            $('#filters').toggleClass('hide1', isBrowser)
        })

        g_menu.registerMenu({
            name: _key + '_item',
            selector: `[data-collapse="${_key}"]`,
            dataKey: 'data-name',
            items: [{
                icon: 'plus',
                text: '添加目录',
                action: _key + '_add'
            }, {
                icon: 'trash',
                text: '清空',
                class: 'text-danger',
                action: _key + '_clear'
            }]
        })

        nodejs.remote.session.defaultSession.protocol.uninterceptProtocol('thumb')
        nodejs.remote.session.defaultSession.protocol.interceptFileProtocol('thumb', async (request, callback) => {
            let file = decodeURI(request.url.slice('thumb://'.length))

            let md5 = nodejs.files.getMd5(file)
            let saveTo = nodejs.dir + '/cache/' + md5 + '.jpg'
            let done = () => callback(saveTo)
            if (!nodejs.files.exists(saveTo)) {
                saveThumb(file, saveTo).then(done)
            } else {
                done()
            }
        })



        // 注册结果集
        const _type = 'filebrowser'
        g_dataResult.register(_type, {
            toString() {
                return _type + '_' + this.opts.folder
            },
            all() {
                return new Promise(reslove => {
                    self.dirFiles(this.opts.folder, this.opts.extra).then(({opts, results}) => {
                        // this.opts.query = opts.search
                        self.toPath()
                        reslove(results)
                    })
                })
            },
            parseItem(md5) {
                let item = this.getItems().find(_item => _item.md5 == md5)
                if (item && !item.file_md5 && item.type == 'file') item.file_md5 = nodejs.files.getFileMd5(item.file)
                return item
            },
            async columns(items) {
                let columns = {}
                if (items.length == 1) {
                    columns = {

                    }
                }
                // let md5_list = items.map(({file_md5}) => file_md5)
                return { type: _type, items, columns, sort: ['preview', 'status'] }
            },
        })

        // 双击目录进入目录
        g_plugin.registerEvent('item_fullPreview', opts => {
            if (opts.data.type == 'folder') { // 目录对象
                // 设置目标目录为当前标签页所在目录
                opts.html = ''
                this.toPath(opts.data.file)
                return false
            }
        })

        // 注册弹出菜单
        const s_dropdown = 'filebrowser_dropdown'
        g_dropdown.register(s_dropdown, {
            position: 'end-top',
            offsetLeft: 5,
            html: '',
        })

        g_action.registerAction({
            filebrowser_favorite: dom => {
                let value = dom.dataset.value
                let favorited = this.getFavorites()
                let index = favorited.findIndex(({path}) => path == value)
                if(index == -1){
                    favorited.push({
                        path: value,
                        date: Date.now()
                    })
                    toast('成功添加到收藏列表')
                }else{
                    favorited.split(index, 1)
                    toast('成功从收藏列表移除')
                }
                this.saveFavorites(favorited)
                g_dropdown.hide('filebrowser_dropdown')
            },
            // 当前标签页跳转到指定目录
            filebrowser_toPath: dom => {
                g_dropdown.hide('filebrowser_dropdown')
                let path = dom.dataset.value
                if(isEmpty(path)){
                    let text = nodejs.remote.clipboard.readText()
                    if(!nodejs.files.isDir(text)) text = ''
                    prompt(text, {title: '输入要跳转的路径'}).then(path => {
                        if(!isEmpty(path)){
                            if(!nodejs.files.isDir(path)) return toast('错误的路径', 'danger')
                            this.toPath(path)
                        } 
                    })
                }else{
                    this.toPath(path)
                }
            },
            ef: async (dom, action) => {
                let name = getParentData(dom, 'name')
                let cb = this.toolbar_list[name]?.[action[1]]
                let html = cb ? await cb() : ''
                if(!isEmpty(html)){
                    g_dropdown.list[s_dropdown].html = html
                    g_dropdown.show(s_dropdown, dom)
                }
            },
            everything_search: (dom, action) => {
                let input = getEle({input: 'everything_search,input'})
                switch(action[1]){
                    case 'clear':
                        return input.val('').trigger('input')

                    case 'add':                       
                        let list = {}
                        this.search_preset.forEach(([name, title]) => list[name] = title)
                        return g_form.confirm1({
                            title: '添加搜索',
                            id: 'everything_addSearch',
                            elements: {
                                preset: {
                                    title: '预设',
                                    type: 'select',
                                    class: 'col-6',
                                    props: `data-change="everything_prompt,setPreset"`,
                                    list
                                },
                                key: {
                                    class: 'col-6',
                                    value: '',
                                    title: '搜索字段',
                                },
                                input: {
                                    title: '条件',
                                    type: 'html',
                                    value: '<h3 class="text-center">请选择一个预设</h3>',
                                },
                                regex: {
                                    title: '正则',
                                    type: 'switch',
                                    props: `data-change="everything_prompt,refresh"`,
                                },
                                value: {
                                    title: '结果',
                                    type: 'textarea'
                                }
                            },
                            callback: ({vals: {value}}) =>{
                                input.val(input.val() + ' ' + value).trigger('input')
                            }
                        })
                }
                g_pp.setTimeout('everything_search', () => this.applySearch(dom.value), 500)
            },
            everything_prompt: (dom, action) => {
                const form_method = (method, ...args) => g_form[method == 'get' ? 'getElement' : 'setElementVal'].call(undefined, 'everything_addSearch', ...args)
                let div = form_method('get', 'input').find('.form_input')

                switch(action[1]){
                    case 'setPreset':
                        const setInputMode = ({mode, label, select, start = '', end = ''}) => {
                            let isRange = mode == '-'
                            let lastMode = mode
                            let modes = {'': '表达式', '>': '大于', '<': '小于', '>=': '大于或等于', '<=': '小于或等于', '=': '等于', '!=': '不等于', '!': '非', '-': '指定范围'}
                            const applyInput = () => {
                                let [_mode, _start, _end = ''] = getElementsValues(div.find('[name]'), el => el.value)
                                if(lastMode != _mode){
                                    lastMode = _mode
                                    setInputMode({ mode: _mode, label, select, start: _start})
                                }
                                let key = form_method('get', 'key').find('.form_input').val()
                                form_method('set', 'value', 
                                    (form_method('get', 'regex').find('.form_input').prop('checked') ? 'case:regex:' : '') + 
                                    (_end ? `${key}:"${_start}${_mode}${_end}"` : `${key}:"${_mode}${_start}"`)
                                )
                            }
                            div.html(`
                                <label class="form-label">${label}</label>
                                <div class="input-group mb-3">
                                    ${g_tabler.build_select({
                                        list: modes,
                                        value: mode,
                                        name: '_mode,'
                                    })}
                                    <span class="input-group-text">输入</span>
                                    <input name="_start" type="text" class="form-control" placeholder="${isRange ? '起始值' : '输入值'}" value="${start}">
                                    ${isRange ? `<input name="_end" type="text" class="form-control" placeholder="终点值" value="${end}">` : ''}
                                    ${select ? g_tabler.build_select({list: select, props: 'data-change="everything_prompt,setValue"', name: '_preset'}) : ''}
                                </div>
                            `).find('[name]').on('input', applyInput)
                            applyInput()
                        }

                        let [name, title, dw, select] = this.search_preset.find(([name]) => name == dom.value)
                        form_method('set', 'key', name)
                        return setInputMode({mode: '>=', label: dw?.length ? title+'可用单位:'+dw.join(',') : '', select})

                    case 'setValue':
                        return div.find('input').val(dom.value).trigger('input')

                    case 'refresh':
                        return div.find('input').trigger('input')
                }
            },
        })

        g_input.bind('everything_gsearch', () => this.applySearch())

        $(() => {
            // 获取磁盘列表
            this.getDrives().then(list => {
                list.forEach(item => this.data.add(item.path, item))
                this.refresh()
            })
            // setTimeout(() => this.openFolder('D:/test/'), 1000)
        })

        this.search_preset = [
            ['name', '文件名'],['folder', '目录'],['path', '路径'],['child', '包含文件名的路径'],['childcount', '子目录文件数量'],
            ['size', '文件大小', ['mb', 'kb', 'gb']],
            ['dm', '文件日期', ['days', 'months', 'hours', 'today', 'yesterday']],
            ['author', '作者'], ['album', '专辑'], ['album-artist', '艺术家'],['aspect-ratio', '宽高比', ['square', 'landscape', 'portrait'], ['16:9', '1:1']],
        ]
    },

    getDrives() {
        return new Promise(reslove => {
            let ret = []
            nodejs.files.getDrives().then(list => {
                // TODO 隐藏的磁盘列表
                list.forEach(root => {
                    ret.push({
                        icon: 'brand-onedrive',
                        path: root,
                    })
                })
                reslove(ret)
            })
        })
    },

    // 应用搜索
    applySearch(value){
        value ??= getEle({input: 'everything_search,input'}).val()
        let tabOpts = g_datalist.tab_getData('sqlite').opts
        tabOpts.extra = value
        this.dirFiles(tabOpts.folder, value).then(({opts, results}) => {
            g_datalist.tab_setItems(results, undefined, true)
        })
    },

    // 获取目录
    getPath(tab){
        return g_datalist.tab_getData('sqlite', tab).opts.folder
    },

    // 跳转到目录
    toPath(path, tab) {
        let opts = g_datalist.tab_getData('sqlite', tab).opts
        path ??= opts.folder
        path = path.replaceAll('\\', '/')
        if (!path.endsWith('/')) path += '/'

        if(opts.folder != path){
            opts.folder = path
            g_datalist.tab_refresh()
        }

        let subPaths = path.split('/')
        if (subPaths.at(-1) == '') subPaths.pop()
        $('#everything_paths').html(
            `<i class="ti ti-pencil me-2 fs-2" data-action="filebrowser_toPath"></i>` + 
            g_tabler.build_breadcrumb({
                id: 'filebrowser_paths',
                action: 'filebrowser_toPath',
                list: subPaths.map((subPath, i) => {
                    return {
                        title: subPath,
                        value: subPaths.slice(0, i + 1).join('/'),
                        selected: i == subPaths.length - 1
                    }
                }),
            })
        )
        $('#everything_search').val(this.isGlobalSearch() ? opts.search : opts.extra)
    },

    isGlobalSearch(){
        return  $('[name="everything_gsearch"]').prop('checked')
    },

    http(opts) {
        console.log(opts.search)
        return new Promise(reslove => {
            $.getJSON(this.api, Object.assign({ json: 1 }, opts), (data, textStatus) => {
                reslove(textStatus == 'success' ? data : {})
            })
        })
    },

    search(opts) {
        let { search = '', rule = {}, query = '{search} {extra}', extra = '' } = spliceObjectKey(opts, ['search', 'rule', 'query', 'extra'])
        if (typeof (search) == 'object') {
            search = Object.entries(search).map(([k, v]) => {
                return toArr(v).map(val => `${isEmpty(k) ? '' : `${k}:`}"${val}"`).join(rule[k] ?? ' ')
            }).join(' ')
        }
        return this.http(Object.assign(opts, { search: query.replace('{search}', search).replace('{extra}', extra) }))
    },


}

g_fb.init()