// ==UserScript==
// @name        视频片段识别
// @namespace   38b73921-7dc2-48da-8762-4c46d932de25
// @version     0.0.1
// @author      hunmer
// @description 使用PySceneDetect展示出影片的场景
// @updateURL               
// @primary     1
// ==/UserScript==

const SENCE_PAGE_PRE = 10;

({
    path: g_plugin.getSciptPath()+'视频片段识别/',
    config: {
        venv: 'I:/PySceneDetect-windows/',
        // python: 'I:/PySceneDetect-windows/',
        // path: 'I:/PySceneDetect-windows/Lib/site-packages/scenedetect/__main__.py',
    },
    init(){
        // 检查环境
        let {venv} = this.config
        if(!nodejs.files.exists(venv)) return
    
        let cfg = venv + 'pyvenv.cfg'
        let config = {}
        nodejs.files.read(cfg).split("\r\n").forEach(line => {
            let [key, value] = line.split(' = ')
            config[key] = value
        })
        if(!nodejs.files.exists(config['home'])){
            openFileDiaglog({
                id: 'sence_python',
                title: '选择python目录',
                properties: ['openDirectory'],
            }, path => {
                if (!isEmpty(path[0])) {
                    if(!nodejs.files.exists(path[0] + '/python.exe')) return toast('不是一个python目录', 'danger')
                    nodejs.files.write(cfg, `home = ${path[0]}\r\ninclude-system-site-packages = false\r\nversion = 3.11.5\r\nexecutable = ${path[0]}\\python.exe\r\ncommand = ${path[0]}\\python.exe -m venv ${venv}`)
                }
            })
        }

        g_preview.tabs_inst.sence = {
            tab: {
                id: 'sence',
                icon: 'movie',
                title: '场景<span class="badge bg-primary-lt ms-1 hide1"></span>',
                html: `
                <div class="position-relative h-full">
                    <div class="row w-full position-absolute bottom-0 start-0">
                        <div class="d-flex w-full col-12">
                            <button class="btn" data-action="scene_start">
                                <i class="ti ti-plus me-2"></i>生成
                            </button>
                            <button class="btn" data-action="scene_clear">
                                <i class="ti ti-trash text-danger me-2"></i>清空
                            </button>
                        </div>
                    </div>
                    <div id="sence_content" class="overflow-y-auto overflow-x-hide" style="height: calc(100% - 50px);">
                    </div>
                </div>
                `
            },
            onShow: () => {
                this.initTab()
            },
            onHide() {
                
            }
        }

        g_plugin.registerEvent('item_unFullPreview', () => {
            // TODO 如何任务正在进行提示是否在后台运行
            this.stop()
            this.status = {}
        })

        g_menu.registerMenu({
            name: 'scene_item',
            selector: '.scene[data-time]',
            dataKey: 'data-time',
            items: [{
                text: '设置为起点',
                action: 'scene_time,setStart'
            },{
                text: '设置为终点',
                action: 'scene_time,setEnd'
            }
        ]})

        g_action.registerAction({
            scene_time: (dom, action) => {
                let time = toTime(g_menu.key)
                g_menu.hideMenu('scene_item')
                switch(action[1]){
                    case 'setStart':
                        return g_clips.setPos({type: 'start', val: time})
                    case 'setEnd':
                         return g_clips.setPos({type: 'end', val: time})
                }
            },
            scene_action: (dom, action, ev) => {
                switch(action[1]){
                    case 'click':
                        let time = parseInt(getParentData(dom, 'frame')) / this.status.fps
                        if(isNaN(time)) return
                        if(ev.ctrlKey){
                            g_clips.setInputs({start: time})
                        }else{
                            g_preview.video.currentTime = time
                        }
                        return 
                }
            },
            scene_clear: () => {
                this.saveData(g_preview.previewing.data.md5, {data: {}})
                this.stop()
                delete this.status.inited
                this.initTab()
            },
            scene_start: () => {
                g_form.confirm1({
                    title: '参数',
                    id: 'scene_start',
                    elements: {
                        threshold: {
                            title: 'threshold',
                            value: 15,
                        }
                    },
                    callback: ({vals}) => {
                        let {threshold} = vals
                        let {file, md5} = g_preview.previewing.data
                        this.test({file, md5, threshold})
                    }
                })
            },
            scenes_action: (dom, action, ev) => {
                let div = getParent(dom, '.scenes')
                let {fps} = this.status
                let start = (div.data('start') / fps).toFixed(2)
                let end = (div.data('end') / fps).toFixed(2)
                switch(action[1]){
                    case 'editAsClip':
                        g_preview.tabs.setActive('clip')
                        return g_clips.setInputs({ start, end })
                    case 'addToClip':
                        return g_clips.saveClip({start, end}).then(() => g_clips.refresh() & toast('成功添加到片段列表', 'success'))
                    case 'cut':
                        dom = $(dom)
                        if(dom.hasClass('btn-loading')) return

                        dom.addClass('btn-loading')
                        let {file} = g_preview.previewing.data
                        const saveTo = path => {
                            let output = path + start + '-' + end + '.mp4'
                            if(nodejs.files.exists(output)){
                                return ipc_send('openFolder', output)
                            }
                            return g_ffmpeg.video_cut({
                                input: file, output, duration: end - start,
                                args: [
                                    `-ss ${start}`,
                                    `-t ${end - start}`,
                                    // '-c:v copy', '-c:a copy',
                                    // '-avoid_negative_ts make_zero',
                                ],
                            }, progress => dom.html(progress) , err => {
                                dom.html(`<i draggable="true" class="ti ti-${err ? 'cut' : 'folder'}" data-file="${output}"></i>`)
                                dom.removeClass('btn-loading')
                            })
                        }
                        if(ev.ctrlKey){
                            openFileDiaglog({
                                id: 'scene_cut',
                                title: '选择导出目录',
                                properties: ['openDirectory'],
                            }, path => {
                                if (!isEmpty(path[0])) saveTo(path[0])
                            })
                        }else{
                            saveTo(this.getCacheDir(file))
                        }
                        break
                }
            },
            sence_page: () => {
                
            }
        })
    },

    getCacheDir: file => nodejs.dir+'/cache/scenes_cache/'+nodejs.files.getMd5(file)+'/',
    status: {},

    initTab(){
        let {md5, file} =  g_preview.previewing.data
        
        if(!this.status.inited){
            this.status.inited = true
            let data = this.getData(md5)
            if(data){
                this.test({md5, file, data})
            }else{
                $('#sence_content').html(`
                    <div class="text-center d-block mt-3">
                        <button class="btn btn-primary" data-action="scene_start">生成</button>
                    </div>
                `)
            }
        }
    },

    getClipDiv(start, end){
        return getEle({start, end}, '.scenes')
    },

    addClip({start, end, file}){
        end--
        let {clips, page, fps} = this.status
        let id = clips.push({start, end})
        //let i_start = page * SENCE_PAGE_PRE
        //let pages = Math.ceil(id / SENCE_PAGE_PRE)
        //if(!(id >= i_start && id <= i_start + SENCE_PAGE_PRE)) return

        let dir = nodejs.dir+'/cache/scenes_cache/'+nodejs.files.getMd5(file)+'/'
        let div = this.getClipDiv(start, end)
        if(!div.length) div = $(`
        <div class="scenes row col-12 m-0 mb-2" data-start=${start} data-end=${end}>
            
        </div>
        `).appendTo('#sence_list')

        const addImg = frame => {
            let time = getTime(frame / fps, ':', ':', '', false, 3)
            return `
            <div class="scene col-6 text-center position-relative" data-frame="${frame}" data-time="${time}">
                <span class="badge bg-primary position-absolute start-2 top-0">${time}</span>
                <img src="./res/loading.gif" class="w-full" data-action="scene_action,click">
            </div>
            `
        }
        div.html(`
            <div class="d-flex btn-list col-12 m-1">
                <a class="btn btn-ghost-primary" title="临时裁剪" data-action="scenes_action,cut">
                    <i class="ti ti-cut"></i>
                </a>
                <a class="btn btn-ghost-warning" title="编辑为片段" data-action="scenes_action,editAsClip">
                    <i class="ti ti-edit"></i>
                </a>
                <a class="btn btn-ghost-secondary" title="添加到片段" data-action="scenes_action,addToClip">
                    <i class="ti ti-plus"></i>
                </a>
            </div>
            ${addImg(start)}
            ${addImg(end)}
        `)
        
        const cut = (frame, type) => {
            let output = dir + frame + '.jpg'
            const done = () => {
                let el = div.find(`.scene:eq(${type == 'start' ? 0 : 1})`)
                el.find('img').attr('src', output)
            }
            if(nodejs.files.exists(output)){
                done()
            }else{
                g_ffmpeg.video_cover({
                    input: file,
                    output,
                    frame,
                }, done)
            }
        }
        cut(start, 'start') // 截取上一帧作为终点
        cut(end, 'end') // 最后一帧需要减去1
    },

    toPage(page){
        this.status.page = page
        $('#sence_list').html('')
        for(let i=page * SENCE_PAGE_PRE;i<Math.min(page * SENCE_PAGE_PRE, this.status.clips.length);i++){
            let {start, end} = this.status.clips[i]
            this.addClip({start, end, file: this.status.file})
        }
    },

    stop(){
        let proc = this.status.proc
        if(proc && !proc.killed){
            proc.kill()
            delete this.status.proc
        }
    },

    test({file, md5, data, threshold = 15}){
        g_ffmpeg.video_meta(file).then(({streams}) => {
            let video = streams.find(({codec_type}) => codec_type == 'video')
            if(!video) return toast('不是合法的视频', 'danger')

            let frames = parseInt(video.nb_frames)
            let fps = eval(video.r_frame_rate)
            file = file.replaceAll('/', '\\\\')
            $('#sence_content').html(`<h4 class="text-center mt-2">启动脚本中...</h4>`)

            let start = 0
            this.status = {frames, fps, file, clips: [], page: 0}
            let badge = g_preview.tabs.getButton('sence').find('.badge')
            const onReviceData = json => {
                let {type, data} = json
                switch(type){
                    case 'start':
                        $('#sence_content').html(`
                            <div id="sence_list" class="row w-full m-0 p-0">
                                
                            </div>
                        `)
                        break
                    case 'new_scene':
                        let frame = parseInt(data)
                        this.addClip({start, end: frame, file})
                        start = frame
    
                        let progress = parseInt(frame / frames * 100)
                        badge.removeClass('hide1').html(progress+'%')
                        break
                    case 'list_scenes':
                        this.saveData(md5, {threshold, data})
                        data.forEach(({start, end}) => this.addClip({start: start.frame, end: end.frame, file}))
                        break
                }
            }

            if(data &&  data.data){
                onReviceData({type: 'start'})
                onReviceData({type: 'list_scenes', data: data.data})
            }else{
                let cmd = `-u "${this.path+'main.py'}" "${file}"`
                this.status.proc = nodejs.cli.run(this.config.venv + 'Scripts/python.exe', cmd, {iconv: true}, {
                    onOutput: msg => {
                        try {
                            onReviceData(JSON.parse(msg))
                        } catch(err){
                            console.error(msg)
                        }
                    },
                    onExit: () => {
                        badge.addClass('hide1').html('')
                    }
                })
            }
        })

    },

    getDataFile(md5){
        return nodejs.dir+'/sence_data/'+md5+'.json'
    },

    saveData(md5, json = {}){
        let method = json.data.length == 0 ? 'remove' : 'write'
        return nodejs.files[method](this.getDataFile(md5), JSON.stringify(json))
    },

    getData(md5, def = {}){
        let file = this.getDataFile(md5)
        if(nodejs.files.exists(file)){
            return nodejs.fs.readJsonSync(file, def)
        }
    }


}).init()