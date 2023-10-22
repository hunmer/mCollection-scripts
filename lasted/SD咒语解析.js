// ==UserScript==
// @name    SD咒语解析
// @version    0.0.1
// @author    hunmer
// @icon      pentagram:yellow
// @description    支持解析由SD生成图片的咒语信息，支持过滤与查询
// @updateURL    https://neysummer2000.fun/mCollection/scripts/SD咒语解析.js
// @primary    1
// @namespace    734b87cd-b724-459e-8f10-33c724a4d035

// ==/UserScript==

var g_sd_prompt = {
    getData: async d => g_data.getMetaInfo(d, 'sd_prompt'),
    setData: (fid, data) => {
        if(data){
            data.fid = fid
            return g_data.data_set2({ table: 'sd_prompt_meta', key: 'fid', value: fid, data})
        }
    },
    removeData: (fid) => g_data.data_remove2({table: 'sd_prompt_meta', key: 'fid', value: fid}),

    taggerImage: (item, vals, callback) => {
        let image = toDataURL('image/png', g_item.item_get(item.md5).find('.thumb')[0], 100) //nodejs.files.getImageBase64(item.file),
        g_sd.post({
            url: 'tagger/v1/interrogate',
            data: {image, ...vals}
        }).then(data => {
            let tags = []
            Object.entries(data.caption).sort((a, b) => b[1] - a[1])
            .forEach(([tag, val]) => {
                if(val >= vals.sameless && tags.length < vals.tagmax) tags.push(tag)
            })
            g_tags.setItemFolder(item.id, g_tags.folder_toIds(tags))
            callback && callback(tags)
        })
    },
    init(){

        g_dropdown.register('sd_prompt_menu', {
            position: 'end-top',
            offsetLeft: 5,
            list: {
                copy: {
                    title: '复制咒语',
                    action: 'sd_promot,copy',
                },
                apply: {
                    title: '应用咒语',
                    action: 'sd_promot,apply',
                },
                tag: {
                    title: '应用标签',
                    action: 'sd_promot,tag',
                },
                drive: {
                    type: 'divider'
                },
                reload: {
                    title: '重读咒语',
                    icon: 'reload',
                    class: 'text-primary',
                    action: 'exif_checkSelected',
                },
                delete: {
                    title: '清除咒语',
                    icon: 'trash',
                    class: 'text-danger',
                    action: 'sd_promot,delete',
                },
            },
        })

        g_action.registerAction('sd_promot', async (dom, action) => {
            let items = await g_detail.getSelectedItems()
            g_dropdown.hide('sd_prompt_menu') & g_menu.hideMenu('datalist_item') 

            switch(action[1]){
                case 'tag':
                    var prompt = g_detail.last_columns.tags.data.titles.join(',')
                    if(isEmpty(prompt)) return toast('没有标签!', 'danger')
                    return g_sd.saveConfig({prompt})
                    
                case 'copy':
                    // TODO 选择输出格式
                    // Object.entries(data).map(([k, v]) => k == 'fid' ? '-------' : k + ': ' + v).join("\n")
                    let exif = await g_detail.inst.exif.read(items[0].file ?? await g_item.item_getVal('file', items[0]))
                    return ipc_send('copy', exif.Parameters)

                default:
                    let data = g_detail.last_columns?.sd_detail?.data || await g_detail.inst.sd_prompt.get(items[0])
                    if(!data) return toast('没有找到咒语信息', 'danger')

                    if(action[1] == 'apply'){
                    var {prompt, sampler, negative, steps, cfg_scale} = data
                    return g_sd.saveConfig({
                            prompt, sampler, steps, cfg_scale,
                            negative_prompt: negative,
                        }) 
                    }else
                    if(action[1] == 'delete'){
                        return Promise.all(items.map(item => g_detail.inst.sd_prompt.remove(item.id))).then(() => g_detail.update())
                    }
            }
        })

        g_setting.setDefault('sd_tagger', {
            model: 'wd14-vit-v2',
            threshold: 0.35,
            sameless: 0.35,
            tagmax: 30,
        })
        g_menu.list.datalist_item.items.push(...[
            {text: '读取标签', icon: 'tag', action: 'sd_tagger'},
            {text: '咒语功能', icon: 'pentagram', action: 'sd_prompt_menu'},
        ])

        g_data.table_indexs.sd_prompt_meta = ['fid', 'prompt', 'negative', 'ensd', 'model_hash', 'sampler', 'cfg_scale', 'clip_skip', 'steps']
        g_plugin.registerEvent('db_connected', ({db}) => {
            db.exec(`
            CREATE TABLE IF NOT EXISTS sd_prompt_meta(
                fid      INTEGER PRIMARY KEY,
                prompt   TEXT,
                negative TEXT,
                ensd     INT,
                model_hash  VARCHAR(10),
                sampler    VARCHAR(256),
                cfg_scale  TINYINT,
                clip_skip  TINYINT,
                steps  TINYINT
            );`)
        })
        g_detail.inst.sd_prompt = { set: this.setData, get: this.getData, remove: this.removeData }

        g_rule.register('noPrompt', {
            title: '无咒语',
            sqlite: {
                method: 'select',
                search: 'md5',
                table: 'files',
                args: {noPrompt: `LEFT JOIN sd_prompt_meta ON files.id=sd_prompt_meta.fid`},
                where: {noPrompt: 'sd_prompt_meta.fid IS NULL'}
            },
            sidebar: {
                title: '无咒语<span class="badge badge-outline text-blue ms-2" data-ruleBadge="noPrompt">0</span>',
                icon: 'stars-off',
                action: 'category,noPrompt',
                editAble: false,
            },
        }).register('hasPrompt', {
            title: '有咒语',
            sqlite: {
                method: 'select',
                search: 'md5',
                table: 'files',
                args: {hasPrompt: `LEFT JOIN sd_prompt_meta ON files.id=sd_prompt_meta.fid`},
                where: {hasPrompt: 'sd_prompt_meta.fid IS NOT NULL'}
            },
            sidebar: {
                title: '有咒语<span class="badge badge-outline text-blue ms-2" data-ruleBadge="hasPrompt">0</span>',
                icon: 'stars',
                action: 'category,hasPrompt',
                editAble: false,
            },
        })

        g_plugin.registerEvent('onBeforeShowingDetail', async args => {
            let { items, columns, type, sort, sd_meta } = args
            let len = items.length
            if(len !== 1 || /*type !== 'sqlite' ||*/ getFileType(items[0].title) !== 'image') return
            sd_meta ??= await this.getData(items[0]) // 支持外部导入数据
            if(!sd_meta) return

            sort.splice(sort.indexOf('status'), 0, 'sd_detail') // 插在staus前
            args.sort = sort
            columns.sd_detail = {
                multi: false,
                classes: 'border-top',
                data: sd_meta,
                html() {
                    let h = ''
                    let names = {prompt: '正向词', negative: '反向词', ensd: 'ensd', model_hash: 'model', sampler: 'sampler', cfg_scale: 'cfg', clip_skip: 'clip', steps: 'step'}
                    Object.entries(sd_meta).forEach(([k, v], i) => {
                        let name = names[k]
                        if(name == undefined || v == undefined) return
                        if(['prompt','negative'].includes(k)){
                            let id = `sd_prompt_${name}`
                            let tags = v.split(',').filter(s => s != '')
                            h += `
                                <div class="d-flex w-full mt-1">
                                    <div data-action="toggleCollapse,#${id},${id}">
                                        <span class="badge badge-outline text-${g_tabler.color_random(i)}">${name} ${tags.length}</span>
                                    </div>
                                    <div class="ms-auto me-2">
                                        <i class="ti ti-copy fs-2" title="复制" data-action="sd_prompt_copy,${k}"></i>
                                    </div>
                                </div>
                            
                                <div class="collapse ${getConfig(id, true) ? 'show' : ''}" id="${id}">
                                    <div id="sd_prompt_${k}" class="d-flex flex-wrap overflow-y-auto overflow-x-hidden border-primary" style="max-height: 150px" data-value="${v}">
                                        ${tags.map((tag, i1) => {
                                            // TODO 权重与特殊标签（画质）突出颜色显示
                                            return `<a data-action="toggleClass,text-primary,text-muted" class="btn-link text-muted me-2 sd_tag">${tag.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</a>`
                                        }).join('')}
                                    </div>
                                </div>`
                        }else{
                            h = `<span data-action="sd_badge_click" class="badge m-1 bg-${g_tabler.color_random(i)}-lt" data-key="${k}" data-value="${v}">${name}:${v}</span>` + h
                        }
                    })
                    return `
                        <div class="d-flex">
                            <div p-2>
                                <a data-action="toggleCollapse,#sd_detail,detail_sdprompt_show">
                                    <i class="ti ti-pentagram me-2"></i>咒语信息
                                </a>
                            </div>

                            <div class="ms-auto" >
                                <a href='#' data-target-dropdown="sd_prompt_menu" ><i class="ti ti-dots me-2"></i></a>
                            </div>
                        </div>

                        <div class="collapse ${getConfig('detail_sdprompt_show', true) ? 'show' : ''}" id="sd_detail">
                            <div class="d-flex flex-wrap justify-content-center">${h}</div>
                        </div>
                    `
                },
            }
        })

        let queue = []
        g_plugin.registerEvent('getExifData', ({data, json}) => {
           let meta = this.parsePrompt(json.Parameters)
           if(meta){
               this.setData(data.id, meta)
               queue.push(data)
           }
        })

        // 等待封面生成完成后...
        g_plugin.registerEvent('image.saveCover', ({ md5, img }) => {
            let find = queue.find(item => item.md5 == md5)
            if(find){
                setTimeout(() => this.taggerImage(find, getConfig('sd_tagger')), 2000)
            }
        })

        g_action.registerAction({
             sd_prompt_menu: dom => g_dropdown.show('sd_prompt_menu', dom) & false,
             sd_tagger: async () => {
                let items = (await g_detail.getSelectedItems()).filter(({title}) => getFileType(title) == 'image')
                g_menu.hideMenu('datalist_item')

                let len = items.length
                if(!len) return toast('没有选中图像文件！', 'danger')
                g_sd.post('tagger/v1/interrogators').then(data => {
                    let d = getConfig('sd_tagger')
                    g_form.confirm1({
                        id: 'sd_tagger',
                        title: '标签分析',
                        elements: {
                            model: {
                                title: '模型',
                                type: 'select',
                                list: data.models,
                                value: d.model,
                            },
                            threshold: {
                                title: '强度',
                                props: 'type=number min=0.1 max=1 step=0.1',
                                value: d.threshold,
                            },
                            sameless: {
                                title: '最少相似度',
                                props: 'type=number min=0.1 max=1 step=0.1',
                                value: d.sameless,
                            },
                            tagmax: {
                                title: '最多标签数',
                                props: 'type=number min=1 max=100',
                                value: d.tagmax,
                            },
                            // TODO 黑名单，中文翻译
                        },
                        callback: ({vals}) => {
                            setConfig('sd_tagger', vals)
                            
                            toast('开始分析中...')
                            let next = () => {
                                let item = items.shift()
                                if(!item) return toast('分析完成！', 'success') & g_detail.update()
                               this.taggerImage(item, vals, () => next())
                            }
                            next()
                        }
                    })
                })
            },
            sd_prompt_copy: (dom, action) => {
                let div = $('#sd_prompt_'+action[1])
                let selected = getElementsValues( div.find('.sd_tag'), badge => {
                    if(badge.classList.contains('text-primary')){
                        badge.click()
                        return badge.value ?? badge.outerText
                    }
                })
                ipc_send('copy', selected.length ? selected.join(',') : div.data('value'))
            },
            sd_badge_click: dom => {
                let {key, value} = dom.dataset
                switch(key){
                    case 'model_hash':
                        return ipc_send('url', 'https://civitai.com/?query='+value)
                }
            }
        })
    
    },

    // parsePrompt(raw){
    //     if(typeof(raw) != 'string') return
    //     let [prompt, negative, detail] = raw.split("\n")
    //     if(!detail){
    //         detail = negative
    //         negative = ''
    //     }else{
    //         negative = negative.replace('Negative prompt: ', '')
    //     }

    //     let meta = {prompt, negative}
    //     detail.split(',').forEach(item => {
    //         console.log(item)
    //         let [k, v] = item.split(':')
    //         if(v != undefined) meta[k.trim().replaceAll(' ', '_').toLowerCase()] = v.trim()
    //     })
    //     return meta
    // },

    parsePrompt(str){
        let ret = {prompt: [], negative: []}
        let negative_start
        str.split('\n').forEach(line => {

            if(line.startsWith('Negative prompt: ')){
                line = line.replace('Negative prompt: ', '')
                negative_start = true
            }

            line.split(',').forEach(tag => {
                let [k, v] = tag.split(': ')
                if(v != undefined){
                    ret[k.trim().toLowerCase().replaceAll(' ', '_')] = v
                }else
                if(negative_start){
                    return ret.negative.push(k)
                }else{
                    ret.prompt.push(k)
                }
                negative_start = false
            })
        })
        ret.prompt = ret.prompt.join(',')
        ret.negative = ret.negative.join(',')
        return ret
    }

}
g_sd_prompt.init()
