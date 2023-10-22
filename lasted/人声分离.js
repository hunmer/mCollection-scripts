// ==UserScript==
// @name        人声分离
// @namespace   dc4e2654-96cd-4b07-a070-94e28d4d1c7e
// @version     0.0.1
// @author      hunmer
// @description 调用Ultimate Vocal Remover进行人声分离
// @updateURL               
// @primary     1
// ==/UserScript==

({
    path: g_plugin.getSciptPath()+'人声分离/',
    config: {
        venv: 'I:/audio-separator/',
        // python: 'I:/PySceneDetect-windows/',
        // path: 'I:/PySceneDetect-windows/Lib/site-packages/scenedetect/__main__.py',
    },
    status: {},
    init(){
        g_menu.list.datalist_item.items.push(...[
            { text: '人声识别', icon: 'music', action: 'as_confirm' },
        ])
        g_action.registerAction({
            as_cancel: () => this.stop() && g_modal.remove('as_confirm'),
            as_confirm: () => {
                let md5 = g_detail.getSelectedKeys()[0]
                g_menu.hideMenu('datalist_item')

                g_form.confirm1({
                    id: 'as_confirm',
                    title: '人声识别设置',
                    elements: {
                        model_name: {
                            title: '模型',
                            type: 'select',
                            // value: '',
                            list: ['UVR_MDXNET_KARA_2', '3_HP-Vocal-UVR'],
                            help: '模型列表: https://huggingface.co/seanghay/uvr_models/tree/main',
                        },
                        output_dir: {
                            title: '输出目录',
                            type: 'file_chooser',
                            value: '',
                            opts: {properties: ['openDirectory']},
                            help: '默认保存在素材同目录下'
                        },
                        output_format: {
                            title: '输出格式',
                            type: 'select',
                            value: 'MP3',
                            list: ['WAV', 'MP3', 'FLAC', 'M4A'],
                        },
                        single_stem: {
                            title: '输出轨道',
                            type: 'select',
                            value: '',
                            list: {instrumental: '背景音乐', vocals: '人声', '': '所有'}
                        },
                        use_cuda: {
                            title: 'GPU加速',
                            help: '请确保显卡是N卡且安装了CUDA（https://developer.nvidia.com/cuda-downloads）',
                            type: 'switch',
                        },
                    },
                    callback: async ({vals}) => {
                        let file = await g_item.item_getVal('file', md5)
                        if(vals.output_dir == '') vals.output_dir = g_db.getSaveTo(md5)
                        g_modal.modal_build({
                            html: `<div id='as_logs'></div>`,
                            title: '人声分离',
                            id: 'modal_as_logs',
                            scrollable: true,
                            width: '60%',
                            buttons: [{
                                text: '取消',
                                class: 'btn-danger',
                                action: 'as_cancel',
                            }]
                        })

                        const startTime = Date.now()
                        const addLog = ({msg, title = '', level = 'primary'}) => $(`
                            <div class="alert alert-${level}" role="alert">
                                <h4 class="alert-title">${title}</h4>
                                <div class="text-secondary">${msg}</div>
                            </div>
                        `).appendTo('#as_logs')
                        addLog({
                            title: '执行中...',
                            msg: this.test({file, opts: vals}, {
                                onOutput: str => str.split("\r\n").forEach(msg => addLog({msg})),
                                onExit: () => {
                                    addLog({title: '✔执行完毕!', msg: '耗时:' + (((Date.now() - startTime) / 1000).toFixed(2)) + 's', level: 'success'})
                                    getEle('as_cancel').remove()
                                }
                            }),
                            level: 'warning',
                        })
                    }
                })
            }
        })
        //this.test({file: 'C:\\Users\\31540\\Desktop\\test1.wav'})
    },
    stop(){
        let proc = this.status.proc
        if(proc && !proc.killed){
            proc.kill()
            delete this.status.proc
        }
    },
    test({file, opts}, callbacks){
        let {venv} = this.config
        let cmd = `-u "${venv+'Scripts/audio-separator.exe'}" "${file}" --log_level debug ${
            Object.entries(opts).map(([k, v]) => {
                if(v == '') return ''
                if(k == 'output_dir') v = `"${v}"`
                if(k == 'use_cuda'){
                    if(!v) return ''
                    v = ''
                }
                return '--'+k + ' ' + v
            }).join(' ')}`
        this.status.proc = nodejs.cli.run(venv + 'Scripts/python.exe', cmd, {iconv: true}, callbacks)
        return cmd
    }
}).init()