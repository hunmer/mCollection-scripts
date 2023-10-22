// ==UserScript==
// @name    视频字幕
// @version    0.0.1
// @author    hunmer
// @description    为视频添加字幕支持
// @icon      text-caption:yellow
// @primary    99
// @updateURL   https://neysummer2000.fun/mCollection/scripts/视频字幕.js
// @namespace    78d028ac-23e5-45ad-9a2c-46313445d35a

// ==/UserScript==

var g_subtitle = {
    init() {
        const self = this

	    g_format.addToCategory('subtitle', ['vtt', 'srt', 'ass', 'ssa'])
        g_plugin.registerEvent('db_connected', () => {
            this.subtitle_path = g_db.opts.path + '/subtitle/'
        })

        // 字幕样式
        g_setting.onSetConfig('subtitle_style', v => {
            g_style.getStyle('dplayer', '.dplayer-subtitle').cssText = v ?? ''
        }).apply('subtitle_style')

        // 字幕搜索
        let _searchIndex
        let _searchList = []
        const search_next = (add = 1) => {
            let index = _searchIndex + add
            if(index >= _searchList.length || index < 0) return
            _searchIndex = index
            getEle({action: 'subtitle_sub', start: _searchList[_searchIndex].startTime}).click()
        }

        g_menu.registerMenu({
            name: 'subtitle_menu',
            selector: '[data-action="subtitle_sub"]',
            dataKey: 'data-key',
            items: [{
                text: '复制文本',
                icon: 'copy',
                action: 'subtitle_copy'
            }]
        })

        let actions = ['copy'].map(k => 'subtitle_'+k)
        g_action.registerAction(actions, (dom, action, ev) => {
            let key = g_menu.key
            let subtitle = g_preview.subtitles[key]
            // let el = this.getSubTitleElement({key})

            g_menu.hideMenu('subtitle_menu')
            switch(actions.indexOf(action[0])){
                case 0:
                    return ipc_send('copy', subtitle.text)

            }
        })

        g_action.registerAction({
            subtitle_style: () => {
                prompt(getConfig('subtitle_style', `font-size: 35px !important;\nbottom: 10% !important;\ncolor: rgb(183, 218, 255) !important;`)).then(style => setConfig('subtitle_style', style))
            },
            subtitle_sub: dom => g_preview.video.currentTime = dom.dataset.start,
            subtitle_onInput: dom => {
                g_pp.setTimeout('subtitle_onInput', () => {
                    let search = dom.value
                    if(search != ''){
                        _searchList = g_preview.subtitles.filter(({text}, i) => text.indexOf(search) != -1)
                        _searchIndex = -1
                        search_next()
                    }
                }, 500)
            },
            subtitle_onInputDown: (dom, action, ev) => {
                let offset = ({38: -1, 40: 1})[ev.keyCode]
                if(offset != undefined){
                    search_next(offset)
                    clearEventBubble(ev)
                }
            },
            subtitle_clearSearch: () => _searchIndex = -1,
        })

        // 设置字幕存储规则
        g_item.setItemType('subtitle', {
            initFile: args => args.subtitle = this.subtitle_path + args.data.md5 + '.vtt',
            getFile: args => args.subtitle,
            beforeCheck: () => { },
        })

        // 侧边字幕信息
        g_plugin.registerEvent('onBeforeShowingDetail', async ({ items, columns, type }) => {
            if (!columns.status || items.length != 1 || type != 'sqlite') return
            let subtitle = await g_item.item_getVal('subtitle', items[0])
            let content = nodejs.files.read(subtitle)
            if (content) {
                columns.status.list.subtitle = {
                    title: '字幕',
                    check: i => i == 1,
                    class: 'bg-green-lt',
                    props: `data-action="openFile" data-file="${subtitle}"`,
                    getVal: () => content.split(' --> ').length - 1 + '行'
                }
            }
        })

        // 播放器显示字幕
        g_plugin.registerEvent('beforePlayerInit', async ({ config, ev }) => {
            let url = await g_item.item_getVal('subtitle', ev.data)
            if (nodejs.files.exists(url)) {
                config.contextmenu.push({
                    text: '字幕样式',
                    click: () => doAction('subtitle_style')
                })
                config.subtitle = {url, type: 'webvtt'}
            }
        })

        // 字幕搜索
        g_search.tabs_register('subtitle', {
            tab: {
                icon: 'list-numbers',
                title: '字幕',
                html: g_search.replaceHTML(`%search_bar%<div class="search_result list-group list-group-flush p-2"></div>`)
            },
            onSearch(s) {
                return new Promise(async reslove => {
                    g_search.getContent('subtitle').html(g_tabler.build_placeHolder({cnt: 3, type: 'avatar'}))
                    g_pp.setTimeout('subtitle_search', async () => {
                        let ret = []
                        if (!isEmpty(s)) {
                            await Promise.all((await self.listSubtitls()).map(async file => {
                                let data = await g_data.data_getFullData(getFileName(file, false))
                                if(data){
                                    let texts = []
                                    let subtitls = self.parseSubtitle(nodejs.files.read(file))
                                    subtitls.forEach((item, index) => {
                                        if(item.text.indexOf(s) != -1){
                                            let arr = []
                                            let start = Math.max(0, index - 2)
                                            for(let i=start;i<index + 2;i++){
                                                if(i <= subtitls.length - 1){
                                                    let {startTime, endTime, text} = subtitls[i]
                                                    arr.push([texts.length, startTime,(endTime - startTime).toFixed(1), text, i == index])
                                                }
                                            }
                                            texts.push(arr)
                                        }
                                    })
                                    texts.length && ret.push({...data, texts})
                                }
                            }))
                        }
                        reslove(ret)
                    }, 700) // 延迟搜索
                })
            },
            async onParse(item) {
                return g_datalist.initElementHTML(`
                    <div class="list-group-item" data-mousedown="item_click" data-dbclick="item_dbclick" {md5} {dargable}>
                        <div class="card">
                            <div class="card-header">
                                <div style="width: 150px;" class="card-preview">    
                                    <img class="thumb lazyload" src="./res/loading.gif" data-src="${item.cover}" {preview}>
                                </div>
                                <div class="flex-fill align-self-start ps-2">
                                    <h3 class="card-title">
                                        <b>${item.title}</b>
                                        <span class="card-subtitle">
                                        </span>
                                    </h3>
                                    <div>
                                        ${g_item.buildMetaBadges(await g_detail.getDetail(item, ['folders', 'tags']))}
                                    </div>
                                    <div class="d-flex flex-wrap mt-2" style="gap: 10px;">
                                        ${item.texts.map(texts => {
                                            let subtitle = texts.find(_item => _item[4] === true)
                                            if(!subtitle) console.log(item.texts)
                                            return subtitle ? `<a class="status status-blue" data-action="subtitle_search_item" data-json='${JSON.stringify(texts)}'>
                                                <b class="border-end">${subtitle[1]}</b>
                                                ${subtitle[3]}
                                            </a>` : ''
                                        }).join('')}
                                    </div>
                                </div>
                            </div>
                            <div class="card-body p-0">
                                
                            </div>
                        </div>
                    </div>
                `, item)
            }
        })

        g_action.registerAction({
            subtitle_search_item: dom => {
                let data = JSON.parse(dom.dataset.json)
                let div = getParent(dom, 'data-md5')
                let md5 = div.data('md5')
                div.find('.card-body').html(
                    g_tabler.build_table({
                        items: data.map(item => {
                            let isActive = item[4]
                            return {
                                row: item.slice(0, 4),
                                class: isActive ? 'table-primary' : '',
                                props: `data-action="item_play" data-md5="${md5}" data-start="${item[1]}"`
                            }
                        }),
                        headerClass: 'sticky-top',
                        headers: [{title: '*'}, {title: '时间'},  {title: '时长'}, {title: '文本'}],
                    })
                )
            }
        })
        // TODO 翻页
        //$(() => setTimeout(() => g_search.show('subtitle') & setTimeout(() => g_search.getInput('subtitle').val('容易').trigger('input'), 500), 1000)) // 易经

        // 字幕浏览器
        g_preview.tabs_inst.subtitle = {
            tab: {
                id: 'subtitle',
                icon: 'list-numbers',
                title: '字幕',
                html: `
                <div class="input-icon mb-3">
                    <input type="text" value="" class="form-control" placeholder="搜索字幕" data-input="subtitle_onInput" data-blur="subtitle_clearSearch" data-keydown="subtitle_onInputDown" />
                    <span class="input-icon-addon">
                        <i class="ti ti-search"></i>
                    </span>
                </div>
                <div class="overflow-y-auto h-full" id="subtitle_list"> </div>
            `
            },
            onShow() {
                let cues = g_preview?.video?.textTracks[0]?.cues
                if(cues){
                    let items = g_preview.subtitles = []
                    for(let i=0;i<cues.length;i++){
                        let {text, startTime, endTime} = cues[i]
                        items.push({
                            text, endTime, startTime,
                            row: [i+1, getTime(startTime), (endTime - startTime).toFixed(1), text],
                            props: `data-action="subtitle_sub" data-start="${startTime}" data-end="${endTime}"`
                        })
                    }

                    g_preview.tabs.getContent('subtitle').find('#subtitle_list').html(
                        g_tabler.build_table({
                            items,
                            headerClass: 'sticky-top',
                            headers: [{title: '*'}, {title: '时间'},  {title: '时长'}, {title: '文本'}],
                        })
                    )

                    clearInterval(self.timer)
                    let lastTime
                    self.timer = setInterval(() => {
                        // 更新字幕位置
                        let time =  g_preview.video.currentTime
                        let find = items.find(({startTime, endTime}) => time >= startTime && time <= endTime)
                        if(find && lastTime != time){
                            $('#subtitle_list .table-primary').removeClass('table-primary')
                            let el = getEle({action: 'subtitle_sub', start: find.startTime})
                            // TODO 全屏预览外的外挂显示
                            if(el.length){
                                el = el.get(0)
                                el.classList.add('table-primary')
                                el.scrollIntoViewIfNeeded()
                            }
                            lastTime = time
                        }
                    }, 500)
                }
            },
            onHide: () => {},
        }

        g_plugin.registerEvent('item_unFullPreview', () => clearInterval(self.timer))

    },
    async listSubtitls(){
        let md5_list = await g_data.getMd5List()
        let files = await nodejs.files.dirFiles(this.subtitle_path, ['vtt'])
        return files.filter(file => md5_list.includes(getFileName(file, false)))
    },
    parseSubtitle(raw){
        const cues = [];
        const lines = raw.trim().split(/\r?\n/);
        if (lines.shift() == "WEBVTT") {
            let cue = null;
            const push = ()=>{
                if (cue) {
                    cue.text = cue.text.join("\n")
                    cues.push(cue);
                }
            }
            lines.forEach(line => {
                if (!cue) {
                    if (/^\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3}/.test(line)) {
                        const [startTime,endTime] = line.split(" --> ");
                        cue = {
                            startTime: toTime(startTime),
                            endTime: toTime(endTime),
                            text: []
                        };
                    }
                } else
                if (line.trim() === "") {
                    push();
                    cue = null;
                } else {
                    cue.text.push(line);
                }
            })
            push()
        }
        return cues;
    },
    getSubTitleElement: opts => getEle({...opts, action: 'subtitle_sub'}),
    timer: 0,
}
g_subtitle.init()

