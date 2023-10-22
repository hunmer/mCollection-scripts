// ==UserScript==
// @name    批量字幕识别
// @version    1.1
// @author    hunmer
// @description    配合剪映实现批量字幕识别
// @updateURL   https://neysummer2000.fun/mCollection/scripts/批量字幕识别.js
// @namespace    39b8b9d1-457f-472a-8554-fd0c65b13acf

// ==/UserScript==


(() => {

    const _selectedClass = 'item_selected table-primary'
    const get_path = () => getConfig('jianyin_path', '')
    g_menu.list['datalist_item'].items.push(...[{ 
        icon: 'plus',
        text: '添加到字幕识别列表',
        action: 'subtitle_setSource'
    }])

    g_plugin.registerEvent('onBeforeShowingDetail', async ({ columns, type, items }) => {
        if (type != 'sqlite') return
        // TODO 异步
        let list = []
        await Promise.all(items.map(async item => {
            let subtitle = await g_item.item_getVal('subtitle', item)
            if(nodejs.files.exists(subtitle)){
                item.subtitle = subtitle
                list.push(item)
            }
        }))

        let cnt = list.length
        if(cnt){
            columns.status.list['subtitle_actions'] = {
                title: '字幕文件',
                class: 'bg-indigo-lt',
                getVal: () => {
                    return `
                    <div class="dropdown">
                        <span class="dropdown-toggle" data-bs-toggle="dropdown" data-bs-auto-close="outside">${cnt}</span>
                        <div class="dropdown-menu ">
                            <a class="dropdown-item" data-action="subtitle_exports">导出字幕</a>
                            <a class="dropdown-item text-danger" data-action="subtitle_delete">删除字幕</a>
                        </div>
                    </div>
                    `
                }
            }
        }
    })

    g_setting.tabs.plugins.elements['jianyin_path'] = {
        title: '剪映草稿目录',
        type: 'file_chooser',
        required: true,
        help: '打开剪映-全局设置-草稿位置',
        placeholder: 'JianyingPro Drafts目录',
        value: get_path,
        opts: {
            title: '选择剪映草稿目录',
            properties: ['openDirectory'],
        },
    }

    var _selectedMd5 = []
    g_plugin.registerEvent('beforeDragingFile', ({ keys, dom }) => {
        if(dom.parents('#modal_subtitle1').length){
            _selectedMd5 = keys
            // 重新开始监视
            if(g_form.getInputVal('modal_subtitle1', 'start') && !_timer) _setTimer(true)
        }
    })

    const _reset = () => {
        _sourceList = []
        _selectedMd5 = []
        g_modal.hide('modal_subtitle1')
        $('#badge_subList').remove()
        _setTimer(false)
    }

    const _selectAll = select => {
        let items = _getElement()
        let selected = items.filter((i, el) => el.classList.contains('item_selected'))
        select ??= selected.length == 0
        items.filter((i, el) => el.dataset.action == 'subtitle_item_selected').toggleClass(_selectedClass, select)
        _updateSelected()
    }

    const _getElement = (selector = '') => g_modal.modal_get('modal_subtitle1').find('tr'+selector)
    const _getItem = md5 => _sourceList.find(item => item.md5 == md5)
    const _updateTable = () => g_form.update('modal_subtitle1', 'table') // 更新显示

    var _timer = 0
    g_input.bind('subtitle_timer', ({selected}) => _setTimer(selected))
    const _setTimer = enable => {
        clearInterval(_timer)
        _timer = enable ? setInterval(() => {
            let file = nodejs.path.join(g_form.getInputVal('modal_subtitle1', 'target'), 'draft_content.json')
            if(nodejs.files.exists(file)){
                let json = nodejs.fs.readJSONSync(file)
                let tracks = []
                json.tracks.forEach(track => track.type == 'text' && tracks.push(...track.segments))
                let subtitls = json.materials.texts.map((sub, i) => {
                    if(sub.type == 'subtitle'){
                        let text = $(sub.content).text()
                        text = text.substr(1, text.length - 2) // 去除左右括号
                        let {start, duration} = tracks.find(track => track.material_id == sub.id).target_timerange
                        return {text, start: start / 1000000, end: (start + duration) / 1000000}
                    }
                })
                if(!subtitls.length) return
                
                // 获取片段对应的时长写入srt
                let start = 0
                let done = 0
                // TODO 字幕太多导致的bug？
                _selectedMd5.forEach(md5 => {
                    let item = _getItem(md5)
                    let end = start + item.duration
                    let matched = subtitls
                    .filter(sub => sub.start != undefined && sub.start >= start && sub.end <= end)
                    .map(sub => {
                        sub.start -= start
                        sub.end -= start
                        return sub
                    }).sort((a, b) => a.start - b.start)

                    if(matched.length){
                        done++
                        item.status = matched.length+'条字幕'
                        nodejs.files.write(item.subtitle, 
                            `WEBVTT` + '\r\n\r\n' + 
                            matched.map(sub => `${getTime(sub.start, ':', ':', '', false, 3)} --> ${getTime(sub.end, ':', ':', '',false, 3)}\r\n${sub.text}\r\n\r\n`).join('')
                        ); // 写入vtt
                    }else{
                        item.status = '没有捕获字幕'
                    }
                    start = end
                })
                _setTimer(false)
                _updateTable()
                showMessage('字幕写入成功', `成功写入【${done}】个字幕文件`)
            }
        }, 1000) : 0
    }

    // 设置文件列表
    var _sourceList = []
    const addToList = list => {
        let added = list.filter(({md5}) => !_sourceList.find(item => item.md5 == md5))
        let i_add = added.length
        if(!i_add) return toast('文件已经在列表中...', 'danger')

        let total = _sourceList.push(...added)
        insertEl({tag: 'span', text: '', props: { id: 'badge_subList', class: 'badge bg-primary me-2 h-fit', 'data-action': 'subtitle_SourceList'}}, {target: $('#traffic'), method: 'prependTo'}).html(`字幕队列:${total}`)
        if(total == list.length){
            showModal() & toast('现在你可以从标记拖动文件到剪映里识别字幕') // 首次添加
        }else{
            toast('成功添加'+i_add+'个字幕', 'success')
        }
    }

    // 更新选中
    const _updateSelected = () => {
        let selected = Array.from(_getElement('.table-primary').map((i, el) => el.dataset.key))
        let duration = 0
        selected.forEach(md5 => duration += _getItem(md5).duration)

        g_form.setElementVal('modal_subtitle1', 'tip', `选中【${selected.length}】个文件，总时长【${getTime(duration)}】`)
    }

    // 展示选中列表
    const showModal = () => {
        g_form.confirm1({
            id: 'modal_subtitle1',
            title: '字幕识别列表',
            elements: {
                target: {
                    title: '选择目标草稿',
                    type: 'file_chooser',
                    help: '剪映标题可以看到当前草稿名称',
                    placeholder: '当前正在识别字幕的草稿路径',
                    value: () => '',
                    opts: {
                        title: '选择剪映草稿目录',
                        properties: ['openDirectory'],
                        defaultPath: get_path()
                    }
                },
                table: {
                    type: 'html',
                    props: `style="max-height: 400px;overflow-y: auto;"`,
                    value: () => {
                        let items = {}
                        let i = 0
                        _sourceList.forEach(({md5, title, file, duration, status, subtitle}) => {
                            let finished = status != '队列中'
                            let exists = nodejs.files.exists(subtitle)
                            items[md5] = {
                                // 判断是否存在字幕
                                props: `data-action="${exists ? 'openFile' : 'subtitle_item_selected'}" data-file="${exists ? subtitle : file}" data-md5="${md5}" draggable="true"`,
                                row: [++i, title, getTime(duration), status],
                                class: finished ? 'table-success' : ''
                            }
                        })
                        return g_tabler.build_table({
                            items,
                            headerClass: 'sticky-top',
                            headers: [{title: 'ID'}, {title: '文件名'}, {title: '时长'}, {title: '状态'}],
                        })
                    }
                },
                btnlist: {
                    type: 'html',
                    value: `
                    <div class="btn-list text-center w-full">
                        <button class="btn btn-pill" data-action="subtitle_selectAll">全选/全不选</button>
                        <button class="btn btn-pill" data-action="subtitle_selectByTime">自动选择</button>
                        <button class="btn btn-pill" data-action="subtitle_clearComepleted">清除已完成</button>
                    </div>
                    `
                },
                tip: {
                    type: 'html',
                    tip: `选择草稿->单击项目切换选中->拖动文件到剪映->开始识别->开启捕获->等待识别完成提示->继续下一组`,
                    value: '',
                },
                start: {
                    title: '开启捕获',
                    type: 'switch',
                    value: _timer > 0,
                    props: 'name="subtitle_timer"',
                },
            },
        }, {
            buttons: [{
                text: `获取最新草稿`,
                class: 'btn-info',
                onClick: () => {
                    let last = [0, 0]
                    nodejs.files.filterFiles(get_path(), ({stat, file}) => {
                        if(stat.isDirectory() && stat.mtime > last[1]){
                            last = [file, stat.mtime]
                        }
                    })
                    last[1] && g_form.setElementVal('modal_subtitle1', 'target', last[0])
                    return false
                }
            }, {
                text: '清空',
                class: 'btn-danger',
                onClick: () => _reset(),
            }],
            once: false,
            width: '80%',
            overwrite: false,
            scrollable: true,
            onShow: () => g_setting.apply('jianyin_autoTarget')
        })
        _updateTable()
    }

    g_action.registerAction({
        subtitle_delete: () => {
            closeAllDropdown()
            let keys = g_detail.selected_keys
            confirm('确定删除【'+keys.length+'】个字幕文件嘛？', {type: 'danger'}).then(() => {
                Promise.all(keys.map(async md5 => {
                    let subfile = await g_item.item_getVal('subtitle', md5)
                    if(nodejs.files.exists(subfile)) nodejs.files.remove(subfile)
                })).then(() => toast('成功删除字幕文件', 'success') & g_detail.clear())
            })
        },
        subtitle_exports: () => {
            closeAllDropdown()
            let i = 0
            let list = {}
            Promise.all(g_detail.selected_keys.map(async md5 => {
                let subfile = await g_item.item_getVal('subtitle', md5)
                if(nodejs.files.exists(subfile)){
                    i++
                    let data = await g_data.data_get(md5)
                    let title = getFileName(data.title, false)

                    if(list[title]) title += '('+i+')'
                    list[title] = {subfile, ...data}
                }
            })).then(() => {
                if(i == 0) return toast('没有找到任何字幕！', 'danger')
                let opts = getConfig('sub_export') || {path: '', format: 'vtt'}
                g_form.confirm1({
                    id: 'sub_export',
                    title: '导出字幕',
                    elements: {
                        path: {
                            title: '选择导出位置',
                            type: 'file_chooser',
                            required: true,
                            value: opts.path,
                            opts: {properties: ['openDirectory']},
                        },
                        format: {
                            title: '格式',
                            type: 'select',
                            list: g_format.getCategory('subtitle'),
                            value: opts.format
                        }
                    },
                    async callback({vals}){
                        let {path, format} = vals
                        setConfig('sub_export', vals)

                        let res = Object.entries(list).map(([title, item]) => {
                            let file = item.subfile
                            let saveTo = path+'/'+title+'.'+format
                            format == 'vtt' && nodejs.files.copySync(file, saveTo)
                            return {key: file, saveTo, title: '【字幕】'+getFileName(item.title, false), desc: renderSize(nodejs.files.stat(file).size), format  }
                        })
                        if(format == 'vtt') return  toast('成功导出'+i+'个字幕文件！', 'success')
                        if(typeof(g_convert) == 'undefined') return toast('必须安装格式转换插件！', 'danger')
                                
                        g_convert.addTask(res, added => {
                            added.forEach(item => {
                                g_convert.mgr.add(item.key, {
                                    ...item, type: 'subtitle',
                                    onStatusChange(status, cb, id) {
                                        if (status == TASK_RUNNING) {
                                            let ffmpeg = new nodejs.cli.ffmpeg(id)
                                            .on('start', cmd => g_convert.setItemStatus(id, '运行中'))
                                            .on('error', () => cb(TASK_ERROR))
                                            .on('end', () => cb(TASK_COMPLETED))
                                            .save(this.saveTo)
                                        }
                                        g_convert.setItemStatus(id, g_convert.mgr.toStauts(status))
                                    }
                                })
                            })
                            return added.length
                        }, true)
                    }
                })
            })
        },
        subtitle_clearComepleted: () => {
            _sourceList = _sourceList.filter(({status}) => status == '队列中')
            _updateTable()
        },
        subtitle_selectByTime: () => {
            prompt('300', {title: '输入上限时长/分钟'}).then(max => {
                max = parseInt(max) * 60
                if(max <= 0) return

                let total = 0
                _selectAll(false)
                _sourceList
                .filter(({status}) => status == '队列中')
                .sort((a, b) => a.duration - b.duration) // 优选短的
                .every(({md5, duration}) => {
                    total += duration
                    _getElement(`[data-key="${md5}"]`).addClass(_selectedClass)
                    return total < max
                })
                _updateSelected()
            })
        },
        subtitle_selectAll: () => _selectAll(),
        subtitle_item_selected: dom => {
            $(dom).toggleClass('item_selected table-primary')
            _updateSelected()
        },
        subtitle_SourceList: () => showModal(),
        subtitle_setSource: async () => {

            let path = get_path()
            if(!nodejs.files.exists(path)) return doAction('settings,plugins') & toast('请先在设置->插件里面设置剪映草稿目录', 'danger')

            let err = 0
            let list = await Promise.all((await g_detail.getSelectedTarget()).map(async item => {
                let {id, md5, title} = item
                let {file, subtitle} = await g_item.item_getVal(['file', 'subtitle'], item)

                let duration = (await g_detail.inst.media.get(id))?.duration || 0
                if(duration <= 0){
                    g_detail.inst.media.load(item, id) // 重新读取媒体时长
                    err++
                }
                return {md5, title, file, duration,subtitle, status: '队列中'+(nodejs.files.exists(subtitle) ? '(有字幕)' : '')}
            }))
            g_menu.hideMenu('datalist_item')

            if(err) return toast('有'+err+'个媒体还未完成初始化加载，正在尝试加载，请稍后再试一次！', 'danger')
            addToList(list)
        }
    })

})()
