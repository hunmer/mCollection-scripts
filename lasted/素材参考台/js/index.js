g_fileDrop.init()

const joinPath = nodejs.path.join
var g_canvas = {

    reviceFiles(items){
        this.insertImages(items.map(item => item.file))

    },

    init() {

        nodejs.registerIPC({
            addURL: ({url}) => {
                g_canvas.insertImages(url)
            }
        })

        g_preload.register('viewer', {
            list: ['../../../public/js/viewer.min.js', '../../../public/js/jquery-viewer.min.js', '../../../public/css/viewer.min.css'],
            check: () => typeof ($().viewer) != 'undefined'
        })

        g_fileDrop.register('canvas', {
            selector: 'body',
            layout: `
            <div class="w-max h-max d-flex align-items-center justify-content-center" style="background-color: rgba(0, 0, 0, .7)">
                <div class="bg-light p-2 border rounded-3 row align-items-center text-center" style="height: 30vh;width: 50vw;">
                  <div class="col-12">
                    <i class="ti ti-file-import text-muted" style="font-size: 8rem" ></i>
                  </div>
                  <h3 class="col-12 text-muted">
                    导入文件
                  </h3>
                </div>
            </div>
            `,
            exts: ['jpg', 'png', 'webp', 'jpeg', 'mp4'],
            reviceFileObject: true,
            onParse(d) {
                let revice = items => {
                    // 应用到拖入的物品
                    items = items.map(item => {
                        if (typeof (item) == 'string') item = { file: item }
                        return item
                    })
                    g_canvas.reviceFiles(items)
                }

                let r
                if (d.file.data.length && (r = d.file.items)) {
                    return Promise.all(r.dirs.map(dir => nodejs.files.dirFiles(dir))).then(files => {
                        r.files.push(...(flattenArray(files).filter(file => !this.ingone.includes(getExtName(file)))))
                        revice(uniqueArr(r.files))
                    })
                }
                if ((r = d.html.data)) {
                    let _$ = parseHtml(r)
                    let items = getElementsValues(_$.find('img'), el => {
                        el = $(el)
                        let url = (el.attr('src') || el.data('src') || '').replaceAll('file:///', '')
                        if (isEmpty(url)) return

                        let title = el.attr('title') || el.attr('alt')
                        if (isEmpty(title) || hasSpecialChar(title) || title.length > 200) title = nguid()

                        let ext = getExtName(url) || 'png'
                        return {
                            file: url,
                            ext, title, meta: { url }, // 网址来源
                        }
                    })
                    return revice(items)
                }
            }
        })

        g_dropdown.register('item_menu', {
            position: 'end-top',
            offsetLeft: 5,
            list: {
                view: {
                    title: '全屏查看',
                    icon: 'eye',
                    action: 'canva_item,preview',
                },
                copy: {
                    title: '克隆',
                    icon: 'copy',
                    action: 'canva_item,clone',
                },
                group: {
                    title: '编组',
                    icon: 'folder',
                    action: 'canva_item,group',
                },
                align: {
                    title: '对齐',
                    icon: 'align-justified',
                },
                delete: {
                    title: '删除',
                    icon: 'trash',
                    class: 'text-danger',
                    action: 'canva_item,delete',
                },
            },
            onShow: () => {
                console.log(this.currentTarget)
            }
        })

        g_dropdown.register('align_menu', {
            position: 'end-top',
            offsetLeft: 5,
            parent: ['item_menu', 'align'],
            list: {
                left: {
                    title: '左对齐',
                    icon: 'align-left',
                    action: 'canva_align,left',
                },
                right: {
                    title: '右对齐',
                    icon: 'align-right',
                    action: 'canva_align,right',
                },
                top: {
                    title: '顶对齐',
                    icon: 'layout-align-top',
                    action: 'canva_align,top',
                },
                bottom: {
                    title: '底对齐',
                    icon: 'layout-align-bottom',
                    action: 'canva_align,bottom',
                },
                center: {
                    title: '居中对齐',
                    icon: 'align-center',
                    action: 'canva_align,center',
                },
                random: {
                    title: '随机',
                    icon: 'arrows-random',
                    action: 'canva_align,random',
                },
            }
        })

        g_hotkey.register1([
            ['delete', '删除图片', `doAction('canvas_hotkey,delete')`, 1],
            ['alt+arrowleft', '上一张图片', `doAction('canvas_nextImage,-1')`, 1],
            ['alt+arrowright', '下一张图片', `doAction('canvas_nextImage,1')`, 1],
            ['arrowleft', '跳转到靠近左边图片', `doAction('canvas_closestTo,left')`, 1],
            ['arrowright', '跳转到靠近右边图片', `doAction('canvas_closestTo,right')`, 1],
            ['arrowup', '跳转到靠近顶边图片', `doAction('canvas_closestTo,top')`, 1],
            ['arrowdown', '跳转到靠近底边图片', `doAction('canvas_closestTo,bottom')`, 1],
            ['ctrl+arrowleft', '到最左边', `doAction('canvas_toPos,left')`, 1],
            ['ctrl+arrowright', '到最右边', `doAction('canvas_toPos,right')`, 1],
            ['ctrl+arrowup', '到最顶边', `doAction('canvas_toPos,top')`, 1],
            ['ctrl+arrowdown', '到最底边', `doAction('canvas_toPos,bottom')`, 1],
            ['ctrl+space', '居中对齐', `doAction('canvas_toPos,center')`, 1],
        ])

        g_action.registerAction({
            canvas_toPos: (d, a) => this.alignObject(a[1]),
            canvas_nextImage: (d, a) => this.nextImage(a[1]),
            canvas_closestTo: (d, a) => this.toClosestObject(a[1]),
            canvas_shuffle: (d, a) => closeAllDropdown() & this.shuffleImages(a[1]),
            canvas_hotkey: (d, a) => {
                switch (a[1]) {
                    case 'delete':
                        let obj = this.canvas.getActiveObject()
                        if (obj != null) this.canvas.remove(obj)
                        return
                }
            },
            canva_align: (d, a) => {
                g_dropdown.hide('align_menu')
                this.alignObjects(a[1])
            },
            canva_item: (d, a) => {
                let object = this.currentTarget
                g_dropdown.hide('item_menu')
                switch (a[1]) {
                    case 'preview':
                        return this.fullPreview(object.getSrc())
                    case 'clone':
                        return this.canvas.add(object.cloneAsImage()).requestRenderAll()
                    case 'delete':
                        return this.canvas.getActiveObjects().forEach(obj => this.canvas.remove(obj))
                    case 'group':
                        let group = new fabric.Group(this.canvas.getActiveObjects(), {
                            // width: 300,
                            // height: 300,
                            // left: 100,
                            // top: 100,
                            // angle: 0
                        });
                        this.canvas.add(group);
                        // this.canvas.setActiveObject(group)
                        return
                }
            },
            canvas_method: (d, a) => {
                closeAllDropdown()
                switch (a[1]) {
                    case 'save':
                        return prompt(new Date().format('yyyy年MM月dd日 hh时mm分ss秒'), { title: '输入名称' }).then(name => {
                            if (!isEmpty(name)) {
                                let ret = this.saveCanvas(name)
                                toast(ret ? '成功保存!' : '保存失败，换个名字试试吧！', ret ? 'success' : 'danger')
                            }
                        })

                    case 'load':
                        return nodejs.files.dirFiles(this.savePath, ['.json'], list => {
                            console.log(list)
                        })

                    case 'clear':
                        return this.canvas.clear()

                    case 'importFile':
                        // TODO 支持url,form的fileuploader
                        return
                }
            },
        })
        this.initCanvas()
        return
        // return nodejs.files.dirFiles('D:\\testimgs\\', ['.jpg', '.png'], files => this.insertImages(files))
        // return nodejs.files.dirFiles('D:\\testimgs\\', ['.mp4'], files => this.insertImages(files))

        this.insertImages([
            'C:\\Users\\Administrator\\Documents\\Tencent Files\\1312552724\\Image\\Group2\\$G\\JP\\$GJP]0~PW]KH~YKV_Q@@}~T.jpg',
            'G:\\image\\test3\\pearl-fairy-3-sand-original-cos-white--and-white-ghost-charm_2\\2.jpg',
            'G:\\image\\test3\\pialoof-atago_2\\2.jpg',
            'G:\\image\\test3\\pinky-webdl053\\2.jpg'
        ])
    },

    // 获取当前激活
    getActive() {
        return this.canvas.getActiveObjects()[0]
    },

    // 设置当前激活
    setActive(object) {
        this.canvas.setActiveObject(object)
        this.canvas.renderAll();
    },

    // 获取画布大小
    getCanvasSize() {
        let { innerWidth, innerHeight } = window
        return { innerWidth, innerHeight }
    },

    // 获取对象大小
    getObjectSize(obj) {
        let { scaleX, scaleY, width, height } = obj
        let itemWidth = width * scaleX,
            itemHeight = height * scaleY;
        return { itemWidth, itemHeight }
    },

    // 最大化/还原对象
    maxsizeObject(object) {
        let { width, height, left, top } = object
        let { innerWidth, innerHeight } = this.getCanvasSize()
        var scale = Math.min(innerWidth / width, innerHeight / height).toFixed(2);
        let scaleX = object.get('scaleX'),
            scaleY = object.get('scaleY'),
            newHeight, newWidth, cb

        if(Math.abs(scale - scaleX) < 0.1 && Math.abs(scale - scaleY) < 0.1){
            // 复原
            newWidth = object.get('lastWidth')
            newHeight = object.get('lastHeight')
            object.set({
                left: object.get('lastLeft'),
                top: object.get('lastTop'),
            })
        }else{
            let { itemWidth, itemHeight } = this.getObjectSize(object)
            object.set({
                lastWidth: itemWidth,
                lastHeight: itemHeight,
                lastLeft: left,
                lastTop: top,
            })
            newWidth = width * scale
            newHeight = height * scale
            cb = () => this.alignObject('center', object) // 对齐
        }
         // 缩放对象
         object.scaleToWidth(newWidth);
         object.scaleToHeight(newHeight);
         cb && cb()
        this.canvas.renderAll();
    },

    // 单个对象对其
    alignObject(pos, object) {
        object ??= this.getActive()
        let rect = {}
        let { innerWidth, innerHeight } = this.getCanvasSize()
        let { itemHeight, itemWidth } = this.getObjectSize(object)
        pos.split('-').forEach(_pos => {
            switch (_pos) {
                case 'left':
                    return rect.left = 0
                case 'top':
                    return rect.top = 0
                case 'right':
                    return rect.left = innerWidth - itemWidth
                case 'bottom':
                    return rect.top = innerHeight - itemHeight
                case 'center':
                    rect.left = innerWidth / 2 - itemWidth / 2
                    rect.top = innerHeight / 2 - itemHeight / 2
                    return
            }
        })
        object.set(rect)
        object.setCoords()
    },

    // 按照顺序切换图片
    nextImage(add) {
        let objects = this.canvas.getObjects()
        let index = objects.indexOf(this.getActive())
        let next = parseInt(add) + index
        let max = objects.length - 1
        if (index == -1 || next > max) {
            next = 0
        } else
            if (next < 0) {
                next = max
            }
        this.setActive(objects[next])
    },

    // 切换邻近的图片
    toClosestObject(pos) {
        let canvas = this.canvas
        let active = this.getActive()
        let objects = canvas.getObjects();
        if (!active || objects.length == 1) return

        let nextObject = this.getClosestObject(active, objects, pos)
        if (nextObject) {
            this.setActive(nextObject);
        }
    },

    // 计算距离最近的对象
    getClosestObject(activeObject, objects, direction) {
        let rect = activeObject.getBoundingRect()
        var closestObject = null;
        var minDistance = Number.MAX_VALUE;
        objects.forEach(object => {
            if (object === activeObject) return;
            let rect1 = object.getBoundingRect()
            var distance = 0;
            switch (direction) {
                case 'left':
                    distance = rect.left - rect1.left - rect1.width;
                    break;
                case 'top':
                    distance = rect.top - rect1.top - rect1.height;
                    break;
                case 'right':
                    distance = rect1.left - rect.left - rect.width;
                    break;
                case 'bottom':
                    distance = rect1.top - rect.top - rect.height;
                    break;
            }
            distance = Math.abs(distance)
            if (distance < minDistance) {
                minDistance = distance;
                closestObject = object;
            }
        })
        return closestObject;
    },


    savePath: joinPath(nodejs.dir, '/datas'),
    // 保存画布数据
    saveCanvas(name, overwrite = true) {
        let saveTo = joinPath(this.savePath, name + '.json')
        if (nodejs.files.exists(saveTo) && !overwrite) return
        nodejs.files.write(saveTo, JSON.stringify(this.canvas.toJSON()))
        return true
    },

    // 滚动到指定位置
    scrollTo(pos) {
        this.canvas.relativePan(pos)
    },

    // 插入图片
    insertImages(urls) {
        this.urlToImages(urls).then(images => {
            images.forEach(image => {
                this.canvas.add(image)

                // video 不调用播放不显示，是为什么？
                let el = image.getElement()
                if (el.nodeName == 'VIDEO'){
                    el.play()
                }
            })
            // let rectGroup = new fabric.Group(images, {
            //     width: 300,
            //     height: 300,
            //     left: 100,
            //     top: 100,
            //     angle: 0
            // });
            // this.canvas.add(rectGroup);
            this.canvas.renderAll()
            this.shuffleImages('waterfall')
        })
    },

    // url转图片对象
    urlToImages(urls, opts) {

        opts = Object.assign({
            objectCaching: false,
        }, opts)
        return new Promise(reslove => {
            let cnt = 0
            let images = []
            urls = toArr(urls)

            const cb = image => {
                images.push(image)
                if (++cnt == urls.length) {
                    reslove(images)
                }
            }
            urls.forEach(url => {
                if (['mp4'].includes(getExtName(url))) {
                    let video = $(`
                    <video src="${fileToUrl(url)}" controls muted></video>
                   `).appendTo('main')[0]
                    video.onloadedmetadata = () => {
                        // 获取媒体宽高保证显示大小
                        let { videoHeight, videoWidth } = video
                        video.width = videoWidth
                        video.height = videoHeight
                        cb(new fabric.Image(video), opts)
                    }
                } else {
                    fabric.Image.fromURL(url, cb, opts)
                }
            });
        })
    },

    // 图片排序
    shuffleImages(type, objects, opts = {}) {
        objects ??= this.canvas.getObjects()
        const { innerWidth, innerHeight } = window

        objects.forEach((obj, index) => {
            let { scaleX, scaleY, width, height } = obj
            let itemWidth = width * scaleX,
                itemHeight = height * scaleY;
            if (!itemWidth || !itemHeight) return // 非法图片
            switch (type) {
                case 'random':
                    obj.set({
                        left: randNum(0, innerWidth - itemWidth),
                        top: randNum(0, innerHeight - itemHeight),
                    })
                    break

                case 'waterfall':
                    opts = Object.assign({
                        colunms: 3
                    }, opts)
                    if (!opts.inited) {
                        opts.tops = new Array(opts.colunms).fill(0)
                        opts.inited = true
                    }
                    let top = Math.min.apply(undefined, opts.tops)
                    let i = opts.tops.indexOf(top)

                    // 调整大小
                    let newWidth = innerWidth / opts.colunms
                    let { newHeight } = adjustSize(width, height, { newWidth })
                    this.setScrollHeight(opts.tops[i] += newHeight)
                    obj.set({ left: i / opts.colunms * innerWidth, top, scaleX: newWidth / width, scaleY: newHeight / height })
                    break
            }
            obj.set('index', index)
            // 将新对象置于所有其他对象之上
            obj.bringToFront();
            obj.setCoords()
        })
        this.canvas.renderAll()
    },

    scrollHeight: 0,
    // 设置滚动条高度
    setScrollHeight(height = 0) {
        if (height) {
            height += canvas._offset.top
            height -= window.innerHeight // 减去高度
        }
        this.scrollHeight = height
    },

    // 初始化画布
    initCanvas() {
        const el = $('#canvas')[0]
        const canvas = this.canvas = window.canvas = new fabric.Canvas(el, {
            backgroundColor: '#000',
            width: window.innerWidth,
            height: window.innerHeight,
        });

        canvas.on('mouse:up:before', ({ target, e }) => {
            if (e.button === 2) { // 右键单击
                g_dropdown.show('item_menu', { rect: { left: e.clientX, top: e.clientY } }, 'centerX-top')
                this.currentTarget = target
            }
        });

        var lastClickTime
        canvas.on('mouse:down', () => lastClickTime = Date.now())
        canvas.on('mouse:up', function ({ target }) {
            if (Date.now() - lastClickTime < 200) {
                // 单击了
            }
        });

        canvas.on('mouse:wheel', ({ target, e }) => {
            const addValue = (name, add = 0.1) => target.set(name, Math.max(0, Math.min(1, target.get(name) + (e.deltaY < 0 ? add : -add))))

            let val = e.ctrlKey ? 0.01 : e.shiftKey ? 0.1 : 0
            if (val) {
                addValue('scaleX', val)
                addValue('scaleY', val)
            } else
            if (e.altKey) {
                addValue('opacity')
            } else{
                if (this.scrollHeight == 0) return

                let y = canvas.viewportTransform[5] + e.deltaY
                let max = 0 - this.scrollHeight
                if (y < max) y = max
                if (y > 0) y = 0
                canvas.absolutePan({x: 0, y: y});
                // canvas.viewportTransform[5] = y
                return canvas.renderAll();
            }
            target.setCoords()
            canvas.renderAll();
        });

        canvas.on('mouse:dblclick', ({ target, e }) => {
            if (target) {
                let el = target.getElement()
                if (el.nodeName == 'IMG') {
                    if (e.ctrlKey) {
                        this.fullPreview(target.getSrc())
                    } else {
                        this.maxsizeObject(target)
                    }
                } else {
                    target.getElement().play()
                }
            }
        });

        canvas.on('mouse:move', function ({ target, e }) {
            // target && target.bringToFront();

            // TODO 悬浮标题提醒
            // var p = canvas.getPointer(options.e);
            // console.log(options.target)
        });

        $(window).on('resize', () => {
            canvas.setDimensions({
                width: window.innerWidth,
                height: window.innerHeight
            })
            canvas.calcOffset();
            canvas.requestRenderAll();
        })

        // 保持刷新（视频）
        fabric.util.requestAnimFrame(function render() {
            canvas.renderAll();
            fabric.util.requestAnimFrame(render);
        });
    },
    alignObjects(align, opts) {
        let { width, height, _objects } = this.canvas.getActiveObject()
        _objects.forEach(obj => {
            let { scaleX, scaleY } = obj
            let itemWidth = obj.width * scaleX,
                itemHeight = obj.height * scaleY;
            let left = -width / 2
            let top = -height / 2
            let height1 = height / 2 - itemHeight
            let width1 = width / 2 - itemWidth
            switch (align) {
                case 'left':
                    obj.set({ left })
                    break
                case 'top':
                    obj.set({ top })
                    break
                case 'bottom':
                    obj.set({ top: height1 })
                    break
                case 'right':
                    obj.set({ left: width1 })
                    break
                case 'center':
                    obj.set({ left: (width1 + left) / 2, top: (top + height1) / 2 })
                    break
                case 'random':
                    obj.set({
                        left: randNum(left, width1),
                        top: randNum(top, height1),
                    })
                    break
            }
            obj.setCoords()
        })
        this.canvas.renderAll()
    },

    fullPreview(url) {
        g_preload.check('viewer', () => {
           
        let imgs = this.canvas.getObjects().map(obj => obj.getSrc())
        g_modal.modal_build({
            html: `
                <ul id="_images" hidden>
                    ${imgs.map(src => `<li><img src="${src}" class="h-full"></li>`).join('')}
                </ul>
            `,
            title: '预览图片',
            type: 'fullscreen',
            id: 'fullPreview',
            onShow() {
                $('#_images').viewer({
                    inline: true,
                    navbar: imgs.length > 1,
                    transition: false,
                    viewed: function () { },
                    initialViewIndex: imgs.indexOf(url),
                    toolbar: {
                        zoomIn: 4,
                        zoomOut: 4,
                        oneToOne: 4,
                        reset: 4,
                        play: {
                            show: 4,
                            size: 'large',
                        },
                        rotateLeft: 4,
                        rotateRight: 4,
                        flipHorizontal: 4,
                        flipVertical: 4,
                    },
                })
            }
        })
        })

    },

    testButton() {
        var btn = $('<button class="btn position-absolute">test</button>').appendTo('main')
        function positionBtn(obj) {
            var { left, width, top } = obj.getBoundingRect()
            btn.css({
                left: (left + width - 10) + 'px',
                top: top + 'px',
            })
        }
        fabric.Image.fromURL('G:\\image\\test3\\pinky-webdl053\\2.jpg', function (img) {

            canvas.add(img.set({ left: 250, top: 250, angle: 30 }).scale(0.25));

            img.on('moving', function () { positionBtn(img) });
            img.on('scaling', function () { positionBtn(img) });
            img.on('rotating', function () { positionBtn(img) });
            positionBtn(img);
        });
    }

}

g_canvas.init()

