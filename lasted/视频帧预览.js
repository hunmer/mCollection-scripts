// ==UserScript==
// @name        视频帧预览
// @namespace   685777c8-d89c-47d5-bbc2-dd098eda5150
// @version     0.0.1
// @author      hunmer
// @description 鼠标放在视频上快速显示视频帧,按住ctrl预览则不生效
// @updateURL               
// @primary     1
// ==/UserScript==

({
    path: g_plugin.getSciptPath() + '视频帧预览/',
    init() {
        const self = this
        // 写入字体
        let font = require('os').tmpdir()+'\\video_preview.ttf'
        if(!nodejs.files.exists(font)) nodejs.files.copySync(this.path+'font.ttf', font)
        // 写入脚本
        nodejs.files.write(this.path+'thumb.cmd', nodejs.iconv.encode(nodejs.files.read(this.path+'sources.cmd').toString().replace('{font_file}', font.replaceAll('\\', '/').replace(':', '\\:')).replace('{ffmpeg_path}', nodejs.bin), 'utf-8').toString())

        g_menu.list.datalist_item.items.push(...[
            { text: '生成预览图', icon: '', action: 'item_sprite_add' },
        ])
        g_setting.tabs.plugins.elements['tagger'] = {
            title: '视频帧预览',
            type: 'html',
            value: `
                <button class="btn" data-action="item_sprite_all">全素材生成缩略图</button>
            `
        }

        g_action.registerAction({
            item_sprite_add: async () => {
                let list = (await g_detail.getSelectedItems()).filter(({ file }) => getFileType(file) == 'video')
                if (list.length) {
                    toast('正在导入【' + list.length + '】个视频到列表...')
                    this.addToQueue(list)
                }
                g_menu.hideMenu('datalist_item')
            },
            item_sprite_all: async () => {
                let list = (await g_data.all(`SELECT id,title,md5 FROM files`)).filter(({md5, title}) => getFileType(title) == 'video' && !nodejs.files.exists(g_db.getSaveTo(md5)+'preview.jpg'))
                let len = list.length
                if(!len) return toast('无需更新!', 'success')
                toast('正在为'+len+'个视频素材生成缩略图,可以打开高级队列查看进度...')
                Promise.all(list.map(async item => {
                    item.file = await g_item.item_getVal('file', item.md5)
                    return item
                })).then(list => self.addToQueue(list))
            }
        })

        // 兼容dplayer缩略图
        $(document).on('mouseenter', '.dplayer-bar-wrap', async ({target}) => {
            let div = $(target).parents('dplayer')
            let md5 = div.data('md5')
            let preview = g_db.getSaveTo(md5) + 'preview.jpg'
            if (nodejs.files.exists(preview)) {
                let thumb = div.find('.video_preview')
                if(!thumb.length){
                    let data = await g_data.data_getData(md5)
                    var { width, height } = await g_detail.inst.media.get(data)
                    let newWidth = 200
                    let {newHeight } = adjustSize(width, height, { newWidth })

                    var [width, height] = await getImageSize(preview)
                    thumb = $(`
                         <div class="video_preview" style="position: absolute; width: ${newWidth}px; height: ${newHeight}px; background-image: url(${preview});"></div>
                    `).appendTo(div)

                    target.addEventListener('mousemove', ({target, offsetX}) => {
                        let index = parseInt(offsetX / target.offsetWidth * 100)
                        let x = index % 5
                        let y = Math.ceil(index / 5) - 1
                        if(x == 0) y++

                        let r = newWidth / (width / 5)
                        let size = adjustSize(width, height, { newWidth: width * r })
                        let pw = size.newWidth / 5
                        let ph = size.newHeight / 20
                        thumb.css({
                            left: target.offsetLeft + offsetX - newWidth / 2 + 'px',
                            bottom: '60px',
                            backgroundPosition: `-${x * pw}px -${y * ph}px`,
                            display: 'unset'
                        })
                    })
                    target.addEventListener('mouseout', () => thumb.css('display', 'none'))
                }
            }
        })

        g_format.getCategory('video').forEach(format => {
            let old_fun = g_preview.list[format].onPreview
            g_preview.list[format].onPreview = async ev => {
                if(g_hotkey.is('ctrlKey')){ // 按住ctrl不启用
                    old_fun(ev)
                }else{
                    let { data, dom } = ev
                    let { md5 } = data
                    let lastIndex = 0
                    let preview = g_db.getSaveTo(md5) + 'preview.jpg'
                    if (nodejs.files.exists(preview)) {
                        let { duration } = await g_detail.inst.media.get(data)
                        // 获取图片大小
                        let [width, height] = await getImageSize(preview)
                        ev.html = () => `
                            <div id="item_preview" style="position: relative; width: 100%; height: ${dom.height}px; background-image: url(${preview});"></div>
                        `
                        ev.cb = img => {
                            let iw = img.width()
                            let r = iw / (width / 5)
                            // 根据当前图片显示大小调整背景图片放大尺寸
                            let { newWidth, newHeight } = adjustSize(width, height, { newWidth: width * r })
                            // 计算每张图片的位置(left top)
                            let pw = newWidth / 5
                            let ph = newHeight / 20
                            img
                            .css('backgroundSize', `${newWidth}px ${newHeight}px`)
                            .on('mousemove', ({ offsetX }) => {
                                let index = Math.ceil(offsetX / iw * 100)
                                if(index != lastIndex){
                                    lastIndex = index
                                    let x = index % 5
                                    let y = Math.ceil(index / 5) - 1
                                    if(x == 0) y++
                                    // 根据鼠标移动位置让图片偏移到指定位置
                                    img.css('backgroundPosition', `-${x * pw}px -${y * ph}px`)
                                }
                                
                            })
                            .on('click', ({ offsetX }) => {
                                let index = Math.ceil(offsetX / iw * 100)
                                g_preview.fullPreview({ md5, opts: { start: index * duration / 100 } })
                            })
                        }
                    }
                    // else
                    // if(!g_queue.isRunning('video_preview')) {
                    //     self.addToQueue([data])
                    // }
                }
            }
        })
    },

    addToQueue(list) {
        list.forEach(data => this.test(data))
    },

    test(data) {
        const self = this
        let {file} = data
        if(!nodejs.files.exists(file)) return

        let name = 'video_preview'
        let queue = g_queue.list[name]
        if (!queue) queue = new Queue(name, {
            max: 1,
            interval: 500,
            title: '视频雪碧图',
        })
        if(queue.get(file)) return
        queue.add(file, {
            data,
            async onStatusChange(status, taskCB, file) {
                if (status != TASK_RUNNING) return
                let data = this.data
                let meta = await g_detail.inst.media.get(data)
                if (!meta.width) meta = await g_detail.inst.media.load(data)
                if (!meta) return toast('错误的媒体文件', 'danger') & taskCB(TASK_ERROR)

                let { md5 } = data
                let { width, height, duration } = meta
                let saveTo = g_db.getSaveTo(md5) + 'preview.jpg'
                let { newWidth, newHeight } = adjustSize(width, height, { newWidth: 200 })
                let args = [`"${file}"`, `"${saveTo}"`, 100, 5, `${parseInt(newWidth)}x${parseInt(newHeight)}`, duration, width, height]
                nodejs.cli.run(self.path+'thumb.cmd', args, {}, {
                    onOutput: msg => {
                        let progress = parseInt(msg)
                        let err = isNaN(progress)
                        let el = insertEl({ tag: 'span', text: '', props: { id: 'badge_thumb', class: `badge bg-primary position-absolute top-5 end-5`, title: '生成缩略图中...' } }, { target: g_item.item_get(md5).find('.card-preview'), method: 'prependTo', remove: err || progress == 100 })
                        !err && el && el.html(progress + '%')
                    },
                    onExit: () => taskCB(TASK_COMPLETED),
                    onError: err => console.error(err.toString()) & taskCB(TASK_ERROR)
                })
            }
        })
    }
}).init()