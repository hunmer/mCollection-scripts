// ==UserScript==
// @name       ocr
// @namespace   90cc9977-97b6-4d53-aacc-3e37523ec067
// @version     0.0.1
// @author      hunmer
// @description 自动ocr识别图片并支持检索
// @updateURL               
// @primary     1
// ==/UserScript==


({
    async getData(item) {
        return (await g_field.getItemData(item) || {})['OCR']
    },
    async setData(fid, data) {
        let raw = await g_field.getItemData({ fid })
        if(data == undefined){
            delete raw['OCR']
            if (Object.keys(raw) == 0) return g_field.removeData(fid)
        }else{
            raw['OCR'] = data
            return g_field.setData(fid, { data: raw })
        }
    },
    removeData(fid) {
        return this.setData(fid)
    },
    
    init(){
        this.path = g_plugin.getSciptPath() + 'ocr/'
       
        let active = `
        background-color: rgba(0, 0, 0, .4);
        border: 1px solid red;
        `
        g_style.addStyle('ocr', `
            .ocr_div:hover {
                ${active}
            }
            .ocr_div.ocr_show {
                ${active}
            }
        `)

        g_plugin.registerEvent('item_fullPreviewed', ({ data }) => {
            if (getFileType(data.file) != 'image') return
            $(`
                <a class="btn" data-action="ocr,menu" title="OCR">
                    <i class="ti ti-scan"></i>
                </a>
            
            `).prependTo('#fullPreview_header > .ms-auto')
        })

        Object.assign(g_setting.tabs.sample.elements, {
            ocr_autoOCR: {
                title: '自动识别图片OCR',
                type: 'switch',
                value: () => getConfig('ocr_autoOCR')
            },
        })

        g_dropdown.register('ocr_menu', {
            position: 'centerX-bottom',
            autoClose: 'true',
             list: async () => {
                return Object.assign({
                    scan: {
                        title: '识别',
                        action: 'ocr,scan',
                    },
                }, await this.getData( g_preview.previewing.data.data) ? {
                    copy: {
                        title: '复制全部',
                        action: 'ocr,copy',
                    },
                    toggle: {
                        title: '切换展示',
                        action: 'ocr,toggle',
                    },
                    toggleText: {
                        title: '切换展示所有文字',
                        action: 'ocr,toggleText',
                    },
                    clear: {
                        title: '清除',
                        action: 'ocr,clear',
                    },
                } : {})
            },
        })

        g_action.registerAction('ocr', async (dom, action, ev) => {
            let ocr_data
            let data = g_preview.previewing.data.data
            const checkData = async () => {
                ocr_data = await this.getData(data)
                if(!ocr_data){
                    toast('请先扫描一次图片', 'danger')
                    return false
                }
                return true
            }
            switch (action[1]) {
                case 'toggleText':
                    return $('.ocr_div').toggleClass('ocr_show')
                case 'copy':
                    return await checkData() && ipc_send('copy', ocr_data.map(({text}) => text).join("\n"))
                case 'itemClick':
                    return ipc_send('copy', dom.dataset.bsOriginalTitle)
                case 'menu':
                    return g_dropdown.quickShow('ocr_menu')
                case 'toggle':
                    return await checkData() && this.showUI({data, ocr_data})
                case 'scan':
                    return g_form.confirm1({
                        id: 'ocr_once',
                        title: '识别设置',
                        elements: {
                            lang: {
                                title: '目标语言',
                                type: 'select',
                                list: (await nodejs.files.dirFiles(this.path+'models/', ['.txt'])).map(path => getFileName(path, false)).filter(filename => filename.startsWith('config_')).map(filename => filename.replace('config_', '')),
                                value: getConfig('ocr_lastLang', ''),
                            }
                        },
                        callback: ({vals}) => {
                            setConfig('ocr_lastLang', vals.lang)
                            toast('正在识别中...') & this.ocr_md5({...data, ...vals}).then(ocr_data => this.showUI({data, ocr_data}))
                        }
                    })
                case 'clear':
                    return this.removeData(data.id).then(() => this.showUI({remove: true}) )
            }
        })

        // g_plugin.registerEvent('field.inited', () => {
        //     g_field.fields['OCR'] = {
        //         fields: {
        //             data: {title: '数据'},
        //         },
        //         icon: 'scan',
        //     }
        // })
    },

    async showUI({ocr_data, data, remove}){
        remove ??= $('#ocr_div').length
        let {width, height} = data ? await g_detail.inst.media.get(data) : {}
        let modal = this.toggleViewer(!remove)
        let target = modal.find('.modal-body')

        const done = text => {
            insertEl({
                tag: 'div', text, props: { id: 'ocr_div', class: 'w-full d-flex align-items-center' }
            }, { target, method: 'prependTo', remove, onInit: div => div.find('[data-bs-toggle="tooltip"]').each((i, el) => new bootstrap.Tooltip(el)) })
        }
        done(remove ? '' : this.getHTML({ocr_data, file: data.file, width, height, size: {newHeight: Math.min(target.height(), height)}}))
    },

    toggleViewer(hide) {
        let modal = g_modal.getModal('fullPreview')
        modal.find('.viewer-container').toggleClass('hide', hide)
        return modal
    },

     ocr_md5({md5, id, file, lang}){
        return new Promise(async reslove => {
            file ??= await g_item.item_get('file', md5)
            this.ocr({file, lang, callback: ({code, data}) => {
                code == 100 && this.setData(id, data).then(() => reslove(data))
            }})
        })
    },

    getHTML({ocr_data, file, width, height, size}){
        let boxs = ''
        let {newWidth, newHeight} = adjustSize(width, height, size)
        ocr_data.forEach(({box, text}) => {
            // console.log({box, text})
            let [left, top] = box[0]
            boxs += `
                <div data-action="ocr,itemClick" class="ocr_div position-absolute" style="
                    left: ${left / width * 100}%;
                    top: ${top / height * 100}%;
                    width: ${(box[1][0] - left) / width * 100}%;
                    height: ${(box[2][1] - top) / height * 100}%;
                " data-bs-toggle="tooltip" data-bs-placement="bottom" title="${text}"></div>
            `
        })


        let style = `style="width: ${newWidth}px;height: ${newHeight}px"`
        return `
        <div class="position-relative mx-auto" ${style}>
            <img src="${file}" ${style}>
            ${boxs}
        </div>
        `
    },

    ocr({file, lang, callback}){
        return nodejs.cli.run(this.path+'PaddleOCR-json.exe', ` -image_path="${file}" ${lang ? `-config_path="models/config_${lang}.txt"` : ''}`, {iconv: true, cwd: this.path}, {
            onOutput: str => output = str,
            onExit: () => {
              try {
                callback(JSON.parse(output))
              } catch(err){
                callback(undefined)
              }
            }
        })
    }

}).init()