// ==UserScript==
// @name    自定义素材字段
// @version    0.0.1
// @author    hunmer
// @icon      pentagram:yellow
// @description    支持给素材设置自定义字段信息，并支持过滤与查询
// @updateURL    https://neysummer2000.fun/mCollection/scripts/自定义素材字段.js
// @primary    10
// @namespace    734287cd-b724-459e-8f10-33c727a4d035

// ==/UserScript==
var g_field = {
    fields: {},
    getData: async d => g_data.getMetaInfo(d, 'custom_field'),
    setData: (fid, data) => {
        let table = 'custom_field_meta'
        let key = 'fid'
        console.log(data)
        if(Object.entries(data.data).filter(([name, _data]) => {
            return Object.entries(_data).some(([k, v]) => k != '_' && v != '')
        }).length == 0){
            // 删除空值
            return g_data.data_remove2({ table, key, value: fid })
        }
        return g_data.data_set2({ table, key, value: fid, data: { fid, data: JSON.stringify(data.data) } })
    },
    removeData: (fid) => g_data.data_remove2({ table: 'custom_field_meta', key: 'fid', value: fid }),
    async getItemData(item) {
        return JSON.parse((await this.getData(item) || { data: '{}' }).data)
    },
    getField() {
        return this.getData({ id: -1 })
    },
    saveFields() {
        return this.setData(-1, { data: this.fields })
    },
    editField(id = '') {
        let create = isEmpty(id)
        let d = this.fields?.[id] || {}
        g_form.confirm1({
            title: (create ? '新建' : '编辑') + '表单',
            id: 'form_custom_fields',
            elements: {
                nid: {
                    title: '名称',
                    value: id,
                    required: true,
                },
                fields: {
                    title: '字段信息',
                    type: 'textarea',
                    rows: 10,
                    value: JSON.stringify(JSON.parse(d.fields || `{"key1": {"title": "测试", "type": "text"}}`), null, 2),
                },
                icon: {
                    title: '图标',
                    type: 'icon',
                    value: d.icon || '',
                },
                actions: {
                    title: '其他操作',
                    type: 'html',
                    class: create ? 'hide' : '',
                    value: `
                        <button class="btn btn-danger" data-action="custom_field,delete,${id}" title="删除"><i class="ti ti-trash"></i></button>
                    `
                }
            },
            callback: ({ vals: { nid, icon, fields } }) => {
                if (create && this.fields[nid]) {
                    toast('此名称已经存在！', 'danger')
                    return false
                }
                try {
                    fields = JSON.stringify(JSON.parse(fields))
                } catch (err) {
                    toast('错误字段信息 ' + err.toString(), 'danger')
                    return false
                }
                this.fields[nid] = { fields, icon }
                this.saveFields() & toast('保存成功！', 'success')
            },

        })
    },
    getFieldElements(title, vals = {}) {
        let elements = {}
        let fields = this.fields[title].fields
        Object.entries(fields).forEach(([k, v]) => {
            v = {...v}
            if (vals[k]) v.value = vals[k]
            elements[k] = v
        })
        return elements
    },
    showField(title, vals, callback) {
        g_form.confirm1({
            title,
            callback,
            elements: this.getFieldElements(title, vals),
            id: 'form_show_field',
        })
    },
    saveitemFields({ field, vals, item, data }) {
        if (vals == undefined) {
            delete data[field]
            toast('成功删除', 'success')
        } else {
            vals._ = Date.now()
            data[field] = vals
            toast('保存成功', 'success')
        }
        this.setData(item.id, { data }).then(() => g_item.item_update(item.md5))
    },
    listFieldsFrom(data, action = 'item_field') {
        // TODO field自带的过滤器（指定格式）
        let ids = []
        let list = Object.entries(this.fields).map(([k, v]) => {
            ids.push([k, this.getFieldElements(k, data[k])])
            return {
                title: `
                    ${v.icon ? `<i class="ti ti-${v.icon} fs-2 me-2"></i>` : ''}
                    <b>${k}</b>
                `,
                html: `
                <div data-field="${k}" class="p-2">
                    <div class="placeholder col-9"></div>
                    <div class="placeholder col-11"></div>
                    <div class="placeholder col-8"></div>
                    <div class="placeholder col-12"></div>
                    <div class="mt-3">
                        <a class="btn btn-primary disabled placeholder col-8"></a>
                        <a class="btn btn-primary disabled placeholder col-4"></a>
                    </div>
                </div>`
            }
        })
        let id = 'fields_list_accordion_' + action
        return {
            html: g_tabler.build_accordion1({
                id,
                list,
                buttonClass: 'p-1',
                showAll: action == 'item_field',
                classes: 'accordion-flush',
                itemClass: 'p-0',
            }),
            cb: () => {
                ids.forEach(([title, elements]) => {
                    let target = $(`#${id} div[data-field="${title}"]`).html(`
                        <div class="field_form"></div>
                        ${action == 'item_field' ? `<div class="mt-3 d-flex w-full justify-content-end">
                            ${data[title] ? `<button class="btn btn-ghost-danger" data-action="${action},delete">删除</button>` : ''}
                            <button class="btn btn-ghost-success" data-action="${action},save">保存</button>
                        </div>` : ''}
                    `)
                    g_form.build(action + '_' + title, {
                        elements,
                        class: 'p-0 m-0',
                        target: target.find('.field_form')
                    })
                })
            },
            ids
        }
    },

    init() {
        const self = this
        g_hotkey.register({
            'alt+keyr': {
                title: "当前素材自定义字段",
                content: "g_detail.selectedByMouse() && g_dropdown.quickShow('custom_field_menu')",
                type: 1
            },
        })
        g_menu.list.datalist_item.items.push(...[
            { text: '自定义字段', icon: 'article', action: 'dropdown_show,custom_field_menu' },
        ])
        g_dropdown.register('custom_field_menu', {
            position: 'end-top',
            offsetLeft: 5,
            list: async () => {
                let list = {}
                let item = (await g_detail.getSelectedItems())[0]
                let data = await this.getItemData(item)
                let keys = Object.keys(this.fields)
                keys.forEach(name => list[name] = {
                    html: `
                    <div class="d-flex w-full p-2">
                        <div class="flex-fill" data-action="custom_field,apply,${name}">
                            <span class="status-dot status-${data[name] ? 'success' : 'secondary'} me-2"></span>
                            <a href='#'>添加到 ${name}</a>
                        </div>
                        <div class="ms-auto">
                           <a href='#' data-action="custom_field,edit,${name}"><i class="ti ti-dots"></i></a>
                        </div>
                    </div>
                    `,
                })
                if (keys.length) list['drive'] = { type: 'divider' }
                return {
                    ...list, ...{
                        add: {
                            title: '添加新字段',
                            icon: 'plus',
                            action: 'custom_field,add',
                        },
                        delete: {
                            title: '清空项目的字段',
                            icon: 'trash',
                            class: 'text-danger',
                            action: 'custom_field,reset',
                        },
                    }
                }
            }
        })

        // 在翻页的时候给有数据的素材添加标记
        g_plugin.registerEvent('datalist_insertedItems', async ({list, elements}) => {
            let ids = (await g_data.all('SELECT fid FROM custom_field_meta')).map(({fid}) => fid)
            list.forEach(({id}, i) => {
                if(ids.includes(id)){
                    $(`
                        <div class="ribbon">
                            <i class="ti ti-star fs-2"></i>
                        </div>
                    `).appendTo(elements.get(i).querySelector('.card-preview'))
                }
            })
        })

        const getSelectedData = async () => {
            let item = (await g_detail.getSelectedItems())[0]
            let data = await this.getItemData(item)
            return { item, data }
        }
        g_action
            .registerAction({
                ['plugin_734287cd-b724-459e-8f10-33c727a4d035']: () => {
                    dialog(
                        g_tabler.buildButtonGroup([
                        {
                            title: '清空所有字段',
                            action: 'field_clearAll',
                            classes: 'btn-danger',
                            icon: 'trash'
                        }
                    ]))
                },
                field_clearAll: () => confirm('确定要删除所有字段吗？此操作不可逆！', {type: 'danger', delayFooter: 3000}).then(() => {
                    g_data.run('DELETE FROM custom_field_meta').then(() => toast('成功删除！', 'success'))
                })
            })
            .registerAction('custom_field', async (dom, action) => {
                let { item, data } = await getSelectedData()
                g_dropdown.hide('custom_field_menu') & g_menu.hideMenu('datalist_item')
                let field = action[2]
                switch (action[1]) {
                    case 'apply':
                        return this.showField(field, data[field], ({ vals }) => this.saveitemFields({ field, vals, item, data }))
                    case 'edit':
                        return this.editField(field)
                    case 'add':
                        return this.editField()
                    case 'delete':
                        return confirm('确定要删除表单:' + field + '吗？此操作将会移除所有使用此表单的相关记录！！！', { type: 'danger' }).then(() => {
                            // TODO 删除素材的相关表单数据
                            delete this.fields[field]
                            this.saveFields()
                            g_modal.remove('form_custom_fields') & toast('成功删除！', 'success')
                        })
                }
            })
            .registerAction('item_field', async (dom, action) => {
                let field = getParentData(dom, 'field')
                let { item, data } = await getSelectedData()
                let form = g_form.get('item_field_' + field)
                switch (action[1]) {
                    case 'save':
                        let vals = form.getVals()
                        return this.saveitemFields({ field, vals, item, data })
                    case 'delete':
                        return this.saveitemFields({ field, item, data }) & g_detail.update()
                }
            })

        g_data.table_indexs.custom_field_meta = ['fid', 'data']
        g_plugin.registerEvent('db_connected', async ({ db }) => {
            db.exec(`
            CREATE TABLE IF NOT EXISTS custom_field_meta(
                fid    INTEGER PRIMARY KEY,
                data   TEXT
            );`)
            this.fields = {
                '喜欢': {
                    fields: {
                        like: {
                            title: '喜欢',
                            type: 'radios',
                            inline: true,
                            list: ['喜欢', '不喜欢', '']
                        },
                    },
                    icon: 'heart',
                },
                '评级': {
                    fields: {
                        val: {
                            type: 'radios',
                            title: '评级',
                            list: ['R12', 'R15', 'R18', ''],
                            value: '',
                        },
                    },
                    icon: 'star',
                },
                '任务状态': {
                    fields: {
                        status: {
                            type: 'select',
                            title: '任务状态',
                            list: ['已完成', '计划中', '未开始', '已放弃', ''],
                            value: '',
                        },
                    },
                    icon: 'clock-hour-4',
                },
                '完成进度': {
                    fields: {
                        progress: {
                            type: 'range',
                            title: '完成进度',
                            value: 0,
                            max: 100,
                        },
                    },
                    icon: 'battery-3',
                },
                '灵感': {
                    fields: {
                        title: {
                            title: '标题',
                            placeHolder: '输入标题',
                        },
                        text: {
                            type: 'textarea',
                            title: '正文',
                            rows: 8,
                            placeHolder: '记录灵感...',
                        },
                    },
                    icon: 'brain',
                },
            }
            try {
                Object.entries(JSON.parse((await this.getField() || { data: '{}' }).data)).forEach(([k, v]) => this.fields[k] = JSON.parse(v))
            } catch(err){}
            g_plugin.callEvent('field.inited', {})
        })

        g_detail.inst.custom_field = { set: this.setData, get: this.getData, remove: this.removeData }
        g_detail.tabs_inst['fields'] = {
            tab: {
                icon: 'align-justified',
                alt: '信息',
                html: `<div id="fields_list" class="p-2 d-flex flex-wrap align-content-start"></div>`,
            },
            onShow: async ({ items }) => {
                var html = '', cb, cnt = items.length
                const setText = text => `<h4 class="text-center w-full">${text}</h4>`
                if (cnt == 0) {
                    html = setText('请选择一个素材')
                } else
                    if (cnt > 1) {
                        html = setText('多个素材不展示')
                    } else {
                        var { html, cb } = this.listFieldsFrom(await this.getItemData(items[0]))
                        setCssVar('--offset-right', '350px')
                    }
                $('#fields_list').html(html)
                cb && cb()
            }
        }
        // $(() => setTimeout(() => g_search.show('fields'), 500))
    },

    parseQueryString(s) {
        let list = []
        let [arr, replaced] = stringSplit(s, ['AND', 'OR'])
        arr.forEach(word => {
            let [key, value] = word.split('=').map(str => str.trim())
            if (key.indexOf('.') == -1) return
            if (value != undefined) {
                if (value == '') return
                if (!value.startsWith("'")) {
                    if (!['true', 'false'].includes(value)) return // 未输入完整
                } else {
                    value = "'" + cutString(value, "'", "'") + "'"
                }
                list.push([key, value])
            }
        })
        return { list, replaced }
    }
}
g_field.init()

assignInstance(g_field, {
    init() {
        const self = this
        g_search.tabs_register('fields', {
            tab: {
                icon: 'article',
                title: '字段',
                getTabIndex: () => -1,
                html: g_search.replaceHTML(`
                    %search_bar%
                    <div class="row m-0 w-full">
                        <div class="col-4 p-0 border-end scrollable" id='search_listFields' ></div>
                        <div class="col-8 search_result list-group list-group-flush p-2"></div>
                    </div>
                `)
            },
            onShow: () => {
                // setTimeout(() => g_search.getInput('fields').val(`喜欢.like=true`), 250)
                let { html, cb, ids } = this.listFieldsFrom({ 喜欢: { like: true } }, 'search_field')
                $('#search_listFields').html(html) & cb()

                let forms = self.search_forms = ids.map(([id]) => [id, g_form.get('search_field_' + id)])
                let inited = {}
                let lastVals = {}
                g_pp.setInterval('field_search', () => {
                    let vals = {}
                    forms.forEach(([id, form]) => {
                        Object.entries(form.getVals()).forEach(([k, v]) => {
                            if (!isEmpty(v)) {
                                let key = id+'.'+k
                                if((v === false || v === 0) && !inited[key]){
                                    return // 初次忽略一些默认参数
                                }
                                inited[key] = true
                                vals[key] = v
                            }
                        })
                    })
                    if (!isObjEqual(vals, lastVals)) {
                        lastVals = { ...vals }
                        g_search.getInput('fields').val(Object.entries(vals).map(([k, v]) => k + '=' + (typeof (v) == 'boolean' ? String(v) : `'${v}'`)).join(' AND ')).trigger('input')
                    }
                }, 1000)
            },
            onHide: () => Object.entries(self.search_forms).forEach(([id, form]) => form.clear()),
            async onSearch(s) {
                // 喜欢.like = ture AND 评级.val = 'R15'
                let { list, replaced } = self.parseQueryString(s)
                let str = `SELECT * FROM custom_field_meta INNER JOIN files ON custom_field_meta.fid = files.id WHERE ` +
                    mergeArrayJoin(list.map(([k, v]) => `json_extract(data, '$.${k.trim()}') = ${v.trim()}`), replaced, ' ')
                console.log(str)
                return list.length ? await g_data.all(str) : []
            },
            async onParse({ fid, data }) {
                let d = await g_data.data_getDataByID(fid)
                console.log({fid, d})
                Object.assign(d, await g_item.item_getVal(['file', 'cover'], d))
                let { tags, media: { width, height } } = await g_detail.getDetail(d, ['tags', 'media'])
                let { newWidth, newHeight } = adjustSize(width, height, { newWidth: 200 })
                // {preview}

                return g_datalist.initElementHTML(`
                    <div class="list-group-item" data-mousedown="item_click" data-dbclick="item_dbclick" {md5} {dargable}>
                        <div class="row">
                            <div class="col-auto">
                                <a class="card-preview">    
                                    <img class="thumb rounded" style="width: ${newWidth}px;height: ${newHeight}px;" src="${d.cover}" >
                                </a>
                            </div>
                            <div class="col text-truncate">
                                <a data-action="files_load" class="text-body d-block">
                                    ${g_tabler.build_badges(tags.slice(0, 3).map(tid => g_tags.folder_getValue(tid, 'title')))}
                                    ${d.title}
                                </a>
                                <div class="d-flex flex-wrap" style="gap: 5px;">
                                    ${Object.entries(JSON.parse(data)).map(([k, v]) => {
                                        let date = getFormatedTime(5, v['_'])
                                        return Object.entries(v).map(([k1, v1]) => {
                                            if(k1 == '_') return ''
                                            return `
                                            <span class="badge-group" role="group" title="${date}">
                                                <a class="badge bg-success badge-pill">${self.fields[k].fields[k1]?.title || k + '.' + k1 }</a>
                                                <a class="badge bg-secondary badge-pill">
                                                    <span class="text-nowrap" style="max-width: 200px;">${checkEmpty(v1, '空')}</span>
                                                </a>
                                            </span>
                                            `
                                        }).join('')
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `, d)
            }
        })

        // g_action.registerAction('search_field', async (dom, action) => {
        //     let field = getParentData(dom, 'field')
        //     let form = g_form.get('search_field_' + field)
        //     switch (action[1]) {
        //         case 'save':
        //             return
        //     }
        // })

        // g_dropdown.register('dropdown_search_field', {
        //     position: 'up-centerX',
        //     offsetLeft: 5,
        //     dataKey: 'data-targetField',
        //     html: field => {
        //         g_pp.setTimeout('search_field_show', () => {
        //             let vals = {}
        //             this.form_dropdown = g_form.build('dropdown_field', {
        //                 class: 'p-0 m-0',
        //                 elements: this.getFieldElements(field, vals),
        //                 target: $('#dropdown_field_content').html(''),
        //             })
        //         }, 50)
        //         return `<div id="dropdown_field_content"></div>`
        //     },
        //     onHiden: () => {
        //         g_pp.clearTimeout('search_field_show')
        //     }
        // })

    }
})