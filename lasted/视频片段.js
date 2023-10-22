// ==UserScript==
// @name        视频片段
// @namespace   b37cfa25-8a77-4af2-8fb9-dfa2d3522789
// @version     0.0.1
// @author      hunmer
// @description 【前置:自定义素材字段】给视频标注一段片段，支持裁剪
// @primary     1
// ==/UserScript==

var g_clips = {
    // 获取片段数据
    async getData(item, defV = {}) {
        return (await g_field.getItemData(item) || {})['片段'] || defV
    },
    // 设置片段数据
    async setData(fid, data) {
        let raw = await g_field.getItemData({ fid })
        raw['片段'] = data
        return g_field.setData(fid, { data: raw })
    },
    // 移除所有片段数据
    async removeData(fid) {
        let raw = await this.getData(fid)
        delete raw['片段']
        if (Object.keys(raw) == 0) {
            g_field.removeData(fid)
        } else {
            g_field.setData(fid, raw)
        }
    },
    // 获取片段存储路径
    getClipFile({ md5, start, end }) {
        return g_db.getSaveTo(md5) + 'clips/' + start + '-' + end
    },
    // 获取片段文件
    getClipFiles(data) {
        let clipFile = this.getClipFile(data)
        return { videoFile: clipFile + '.mp4', coverFile: clipFile + '.jpg' }
    },
    // 保存片段更改
    async saveClip({ item, key, start, end, data = {} }) {
        this.editingClip = '0-0'
        item ??= this.getDataSource()
        let clips = await this.getData(item)
        let newKey = start + '-' + end
        let create = newKey != key
        let { videoFile, coverFile } = this.getClipFiles({ md5: item.md5, start, end })

        delete clips[key]
        // 删除片段文件
        try {
            nodejs.files.remove(videoFile)
            nodejs.files.remove(coverFile)
        } catch (err) { }

        console.log({ create, start, end })
        if (create) {
            clips[newKey] = Object.assign({
                title: '',
                desc: '',
                date: Date.now()
            }, data)
            this.cutClip({
                start, end,
                coverFile,
                input: item.file,
                output: videoFile,
            })
        }
        return this.setData(item.id, clips)
    },
    // 当前编辑的片段
    editingClip: '0-0',
    // 获取指定片段元素
    getCard(clip) {
        return clip == '0-0' ? $('#clip_inputs') : getEle({ clip }, '#clip_list ')
    },
    progressing: {},
    // 裁剪片段
    cutClip({ input, output, start, end, coverFile }) {
        let key = start + '-' + end
        const findEl = selector => this.getCard(key).find(selector)
        const setProgress = progress => {
            let done = progress == undefined
            done ? delete this.progressing[key] : this.progressing[key] = progress
            findEl('.ribbon').toggleClass('hide', done).html(progress || '')
        }

        g_ffmpeg.video_cut({
            input, output, duration: end - start,
            args: [
                `-ss ${start}`,
                `-t ${end - start}`,
                // '-c:v copy', '-c:a copy',
                // '-avoid_negative_ts make_zero',
            ],
        }, setProgress, err => {
            !err && g_ffmpeg.video_cover({
                input: output,
                output: coverFile,
                time: 0,
            }, () => {
                findEl('img').removeClass('lazyload').attr('src', coverFile)
                setProgress()
            })
        })
    },
    // 删除片段
    removeClip(key) {
        this.saveClip({ key }).then(() => {
            // this.refresh()
            this.getCard(key).remove()
        })
    },

    init() {
        const self = this
        g_plugin.registerEvent('field.inited', () => {
            g_field.fields['片段'] = {
                fields: {
                    clips: {
                        title: '片段列表',
                        type: 'clip_list',
                        // data: { ...clips },
                    }
                },
                icon: 'cut',
            }
            g_plugin.registerEvent('item_fullPreviewed', () => this.refresh())
            g_preview.tabs_inst.clip = {
                tab: {
                    id: 'clip',
                    icon: 'cut',
                    title: '片段',
                    html: `
                    <div class="position-relative h-full">
                        <div class="row w-full position-absolute bottom-0 start-0">
                            ${this.clearInputs()}
                            <div class="d-flex w-full col-12">
                                <button class="btn" data-action="clip_check">
                                    <i class="ti ti-check me-2"></i>检查丢失
                                </button>
                                <button class="btn" data-action="clip_addAll">
                                    <i class="ti ti-share me-2"></i>添加到素材库
                                </button>
                                <button class="btn" data-action="clip_clear">
                                    <i class="ti ti-trash text-danger me-2"></i>清空
                                </button>
                            </div>
                        </div>
                        <div id="clip_list" class="overflow-y-auto overflow-x-hide" style="height: calc(100% - 270px);">
                            <div class="text-center d-block mt-3">
                                <div class="spinner-grow" role="status"></div>
                            </div>
                        </div>
                    </div>
                    `
                },
                onShow: () => {

                },
                onHide() {
                    $('#preview_tabs').replaceClass('col-md-', 'col-md-5')
                }
            }
        })

        g_menu.registerMenu({
            name: 'clip_item',
            selector: '[data-clip]',
            dataKey: 'data-clip',
            items: g_menu.buildMenuItems([
                ['编辑', 'pencil', 'clip_edit'],
                ['删除片段', 'trash', 'clip_delete', 'text-danger'],
                ['重新裁剪', 'cut', 'clip_cut'],
            ])
        })

        g_form.registerPreset('clip_list', {
            setVal: (dom, val) => {
                $(dom).html(toVal(val)).find('.lazyload').lazyload()
            },
            getVal: dom => { },
            getValue() {
                if (!this.data) return
                let { md5 } = self.getDataSource()
                let html = Object.entries(this.data).map(([key, val], index) => {
                    let times = key.split('-')
                    let { title, desc, date } = val
                    if (title == '') title = '无标题'
                    let { videoFile, coverFile } = self.getClipFiles({ md5, start: times[0], end: times[1] })
                    let progress = self.progressing[key] || 0
                    return `
                        <div class="col-6 col-lg-4 mb-2 p-0 position-relative" data-clip="${key}" draggable="true" data-file="${videoFile}">
                            <div class="p-2">
                                <div class="ribbon ${progress ? '' : 'hide'}">
                                    ${progress}
                                </div>
                                <a data-hover="item_previewVideo" class="position-relative card-preview text-center" data-props="data-action='clip_method,play' data-dbclick='clip_method,open'">
                                    <img src="./res/loading.gif" data-src="${coverFile}" class="rounded lazyload w-full" style="object-fit: cover;" >
                                </a>
                                <span class="badge bg-primary position-absolute top-0 start-0">
                                    ${(times[0] * 1).toFixed(2)} - ${(times[1] * 1).toFixed(2)}
                                </span>
                                <span class="badge bg-primary position-absolute bottom-0 end-0" title="${desc}\n${getFormatedTime(5, date)}">
                                    ${title}
                                </span>
                            </div>
                        </div>
                    `
                }).join('')
                return `<div class="row w-full p-0 m-0">${html}</div>`
            },
            getPreset: `<div id="{id}" class="form_input" {props}></div>`
        })

        g_menu.list.subtitle_menu && g_menu.list.subtitle_menu.items.push(...[
            { text: '片段起点', icon: 'brackets-contain-start', action: 'clip_fromSubtitle,start' },
            { text: '片段终点', icon: 'brackets-contain-end', action: 'clip_fromSubtitle,end' },
        ])

        g_action.registerAction({
            clip_clear: () => {
                confirm('确定要清空当前片段列表', { type: 'danger' }).then(async () => {
                    let data = this.getDataSource()
                    this.removeData(data.id);
                    (await this.getClips(data)).forEach(({ videoFile, coverFile }) => {
                        nodejs.files.remove(videoFile)
                        nodejs.files.remove(coverFile)
                    })
                    this.refresh()
                    toast('成功清空当前片段列表', 'success')
                })
            },
            clip_addAll: async () => {
                let folders = await g_folders.getItemFolder(g_preview.previewing.data.data.id)
                let list = (await this.getClips(this.getDataSource())).map(({ videoFile}) => {
                    return {
                        meta: {folders},
                        file: videoFile
                    }
                })
                console.log(list)
                g_data.file_revice(list).then(() => {
                    toast('成功添加'+list.length+'个素材到素材库', 'success')
                })
            },

            clip_check: async () => {
                let loseCut = 0, loseCover = 0;
                (await this.getClips(this.getDataSource())).forEach(({ videoFile, coverFile, start, end, file }) => {
                    let key = start + '-' + end
                    if (!nodejs.files.exists(videoFile)) {
                        loseCut++
                        this.cutClip({
                            start, end,
                            coverFile,
                            input: file,
                            output: videoFile,
                        })
                    } else
                        if (!nodejs.files.exists(coverFile)) {
                            loseCover++
                            g_ffmpeg.video_cover({ input: videoFile, output: coverFile }, err => {
                                !err && setTimeout(() => this.getCard(key).find('img').attr('src', coverFile), 1000)
                            })
                        }
                })
                toast(loseCover + loseCut ? `正在修复${loseCut}个片段丢失,${loseCover}个封面丢失` : '没有缺少任何文件')
            },

            clip_method: (dom, action, ev) => this.doMethod({ dom, ev, method: action[1] }),
            clip_fromSubtitle: (d, a) => {
                let type = a[1]
                let subtitle = g_preview.subtitles[g_menu.key]
                this.setPos({ type, val: subtitle[type + 'Time'] })
                g_menu.hideMenu('subtitle_menu')
                toast('成功设置' + (type == 'start' ? '起点' : '终点'))
            },
            clip_hotkey: (dom, action) => {
                let { saveBtn, title_input } = this.getInputs()
                g_preview.tabs.setActive('clip')
                switch (action[1]) {
                    case 'start':
                    case 'end':
                        return this.setPos({ type: action[1] })
                    case 'add':
                        return saveBtn.click()
                    case 'focus':
                        return title_input.focus()
                }
            },
            clip_input: (dom, a, ev) => {
                g_preview[a[1] == 'focus' ? 'tryPause' : 'tryPlay']()
            },
            // clip_title_input: dom => this.doMethod({dom}),
            // clip_desc_input: dom => this.doMethod({dom}),
            clip_edit: () => this.doMethod({ key: g_menu.key, method: 'edit' }),
            clip_cut: () => this.doMethod({ key: g_menu.key, method: 'cut', delay: 250 }),
            clip_delete: (dom, a, ev) => this.doMethod({ key: g_menu.key, method: 'remove', ev }),
            clip_save: () => this.doMethod({ key: this.editingClip, cb: () => this.refresh() }),

            clip_range_focus: dom => {
                let time = toTime(dom.value)
                if (time > 0) g_preview.video.currentTime = time
            },
            clip_range_scroll: (dom, action, ev) => {
                clearEventBubble(ev)
                this.setPos({ dom, type: action[1], val: toTime(dom.value) + (ev.deltaY < 0 ? 1 : -1) * 0.5 })
            }
        })

        g_hotkey.register1([
            ['alt+1', '设置片段起点', `doAction('clip_hotkey,start')`, 2],
            ['alt+2', '设置片段终点', `doAction('clip_hotkey,end')`, 2],
            ['alt+3', '设置片段标题', `doAction('clip_hotkey,focus')`, 2],
            ['alt+4', '添加片段', `doAction('clip_hotkey,add')`, 2]
        ])

        // 片段搜索
        g_search.tabs_register('clip', {
            tab: {
                icon: 'cut',
                title: '片段',
                // TODO 搜索对象(名称,注释)
                html: g_search.replaceHTML(`%search_bar%<div class="search_result row p-2 m-0"></div>`)
            },
            async onSearch(s) {
                return !isEmpty(s) ? await g_data.all(`
                SELECT fid, json_extract(json_each.value, '$') AS data, json_each.key AS key
                FROM custom_field_meta, json_each(data, '$.片段')
                WHERE json_extract(json_each.value, '$.title') Like '%${s}%';`) : []
            },
            async onParse({ fid, data, key }) {
                let [start, end] = key.split('-')
                let { title, desc, date } = JSON.parse(data)
                let item = await g_data.data_getDataByID(fid)
                let { videoFile, coverFile } = self.getClipFiles({ md5: item.md5, start, end })
                Object.assign(item, {
                    file: videoFile,
                    cover: coverFile
                })
                return g_datalist.initElementHTML(`
                    <div class="col-12 col-lg-6 p-2" data-mousedown="" data-dbclick="" {md5} {dargable}>
                        <div class="card">
                            <div class="card-header align-items-start">
                                <a data-hover="item_previewVideo" class="position-relative card-preview text-center col-6" data-props=" data-action='clip_method,play' data-dbclick='clip_method,open'">
                                    <img src="./res/loading.gif" data-src="${coverFile}" class="rounded lazyload w-full" style="object-fit: cover;" >
                                </a>
                                <div class="flex-fill align-self-start ps-2">
                                    <h3 class="card-title">
                                        <b>${title}</b>
                                        <span class="card-subtitle">${key}</span>
                                    </h3>
                                    <small class="ps-2">${desc || '无注释...'}</small>
                                </div>
                            </div>
                            <div class="card-footer d-flex">
                                <div class="ms-auto">${getFormatedTime(5, date)}</div>
                            </div>
                        </div>
                    </div>
                `, item)
            }
        })
    },

    async setInputs({ start, end, title = '', desc = '' }) {
        this.editingClip = '0-0'
        const { title_input, desc_input } = this.getInputs()
        title_input.val(title).focus()
        desc_input.val(desc)
        if (start != undefined) await this.setPos({ type: 'start', val: start })
        if (end != undefined) setTimeout(() => this.setPos({ type: 'end', val: end }), 1000)
    },
    // 获取所有片段
    async getClips(data) {
        let { md5, file } = data
        return Object.entries(await this.getData(data)).map(([k, v]) => {
            let [start, end] = k.split('-')
            return { ...v, ...this.getClipFiles({ md5, start, end }), start, end, file }
        })
    },
    // 设置起始点
    setPos({ dom, val, type, key = '0-0' }) {
        return new Promise(reslove => {
            if (dom) key = getParentData(dom, 'clip')

            let duration
            let video = g_preview.video
            val ??= video.currentTime

            const { card, start_input, start_img, end_input, end_img } = this.getInputs()
            dom ??= (type == 'start' ? start_input : end_input)[0]

            if (val < 0) {
                val = 0
            } else
                if (val > (duration = video.duration)) val = duration
            dom.value = getTime(val)
            video.currentTime = val
            g_pp.setTimeout('clip_cover_' + type, () => {
                getImgBase64(video, 250).then(imgData => {
                    (type == 'start' ? start_img : end_img).attr('src', imgData)
                    reslove(imgData)
                })
            }, 500)
        })

    },
    // 还原输入框
    clearInputs(clear) {
        let fun = type => `data-focus="clip_input,focus,${type}" data-blur="clip_input,blur,${type}"`
        const buildInput = (pos, i) => `
        <div class="position-relative text-center mb-2" id="clip_input_${pos}">
            <img src="${g_plugin.getSciptPath() + '视频片段/' + pos + '.png'}" class="rounded w-full" style="height: 100px;object-fit: cover;" >
            <div class="position-absolute bottom-0 end-0">
                <input ${fun(pos)} onmousewheel="doAction('clip_range_scroll,${pos}', this, event)"  class="form-control form-control-sm text-center">
            </div>
        </div>`
        let html = `<div class="d-flex w-full col-12" id="clip_inputs">
            <div class="col-6 d-flex flex-column p-2">
                ${['start', 'end'].map(buildInput).join('')}
            </div>
            <div class="col-6">
                <input ${fun('title')} data-input="clip_title_input" class="form-control form-control-flush fw-bold text-center mb-1" placeholder="标题" value="" tabindex="1">
                <textarea ${fun('desc')} data-input="clip_desc_input" data-bs-toggle="autosize" class="form-control"  placeholder="输入注释..." tabindex="2"></textarea>
                <div class="mt-2 text-end">
                    <button class="btn btn-primary" data-action="clip_save">保存</button>
                </div>
            </div>
        </div>`
        if (clear) this.getCard('0-0').html(html)
        return html
    },
    // 获取所有输入框
    getInputs() {
        let card = this.getCard('0-0')
        let ret = {
            card,
            title_input: card.getEle({ input: 'clip_title_input' }),
            desc_input: card.getEle({ input: 'clip_desc_input' }),
            saveBtn: card.getEle('clip_save')
        };
        ['start', 'end'].forEach(pos => {
            let div = card.find('#clip_input_' + pos)
            ret[pos + '_input'] = div.find('input')
            ret[pos + '_img'] = div.find('img')
        })
        return ret
    },
    // 执行操作
    doMethod({ dom, key, method = 'save', delay = 0, cb, ev = {} }) {
        g_menu.hideMenu('clip_item')

        if (dom) key = getParentData(dom, 'clip')
        g_pp.setTimeout('clip_' + method + ',' + key, () => {
            var [start, end] = key.split('-')
            const { start_input, start_img, end_input, title_input, desc_input } = this.getInputs()
            const setTimes = (start, end) => start_input.val(getTime(start)) & end_input.val(getTime(end))

            if (key == '0-0') {
                var { start, end } = getMinMax(toTime(start_input.val()), toTime(end_input.val()))
                setTimes(start, end)
            }

            let { md5, file } = this.getDataSource()
            let { videoFile, coverFile } = this.getClipFiles({ md5, start, end })
            switch (method) {
                case 'remove':
                    const done = () => this.removeClip(key)
                    return ev.shiftKey ? done() : confirm('是否删除片段?', { type: 'danger' }).then(done)
                case 'edit':
                    this.editingClip = key
                    start_img.src = coverFile
                    return setTimes(start, end)
                case 'open':
                    return ipc_send('openFile', videoFile)
                case 'play':
                    return g_preview.setCurrentTime(ev.altKey ? end : start)
                case 'save':
                    return this.saveClip({
                        key, start, end,
                        data: {
                            title: title_input.val(),
                            desc: desc_input.val(),
                            date: Date.now()
                        }
                    }).then(() => cb && cb()) & this.clearInputs(true)
                case 'cut':
                    return this.cutClip({
                        start, end,
                        coverFile,
                        input: file,
                        output: videoFile,
                        duration: g_preview.video.duration,
                    })
            }
        }, delay)
    },
    data: {},
    // 设置数据来源
    setDataSource(data) {
        this.data = { ...data }
    },
    getDataSource() {
        return this.data
    },
    // 刷新
    async refresh() {
        let data = g_preview.previewing.data.data
        this.setDataSource(data)
        let clips = await this.getData(data, {
            // '1-3': {
            //     title: 'clip1',
            //     desc: 'this is clip 1',
            //     date: Date.now()
            // },
        })
        g_form.build('form_clips', {
            elements: {
                clips: {
                    title: '片段列表',
                    type: 'clip_list',
                    data: { ...clips },
                }
            },
            class: 'p-0',
            target: $('#clip_list').html('')
        })
    },

}
g_clips.init()
