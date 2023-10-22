// ==UserScript==
// @name        文件夹与标签封面
// @namespace   7c51d856-3736-4625-8f1f-fc745dc49a15
// @version     0.0.1
// @author      hunmer
// @description 支持给文件夹或标签设置封面，并提供悬浮预览与底部同级文件夹列表视图
// @updateURL               
// @primary     1
// ==/UserScript==
(() => {

    g_plugin.registerEvent('ui_init', ({name}) => {
        if(name == 'datalistToolbars' && !getEle('ui,subfolders').length){
            $(`
            <button class="ms-2 btn btn-rounded " onclick="g_sidebar.toggle('bottom', g_ui.toggle('subfolders'))" data-target_ui="subfolders" title="同级文件夹">
                <i class="ti ti-folders"></i>
            </button>`).appendTo('#datalist_toolbar .me-auto')

            g_ui.register('subfolders', {
                group: 'sidebar_bottom',
                target: '#sidebar_bottom',
                props: 'data-max=500',
                html: `
                <div class="border-1 border-top d-flex">
                    <div class="me-auto d-flex p-2" style="gap: 4px;">
                        <i class="ti ti-layout-distribute-horizontal fs-2" title="横向" data-action="subfolders_wrap,0"></i>
                        <i class="ti ti-layout-distribute-vertical fs-2" title="纵向" data-action="subfolders_wrap,1"></i>
                        <i class="ti ti-eye fs-2" title="显示第一张图片" data-action="subfolders_showFolderCover"></i>

				        <input tabindex="-1" data-input="range_subfolders_size" type="range" class="form-range ms-2 border-end" value="${getConfig('subfolders_size', 140)}" min="50" max="200">
                    </div>
                    <div class="ms-auto p-2">
                        <input class="form-control form-control-sm" placeholder="搜索" data-input="subfolders_search">
                    </div>
                </div>
                <div id="subfolders_content" class="overflow-y"><h4 class="text-center">无同级目录...</h4></div>
                `,
                onShow: () => {
                    sb_showSubFolders()
                    setContentsWrap()
                },
                onAppend: div => {
                    div.find('#subfolders_content').on('scroll', e => {
                        let el = e.target
                        if(el.classList.contains('scroll-x')){
                            if (el.scrollLeft + el.offsetWidth == el.scrollWidth) nextPage()
                        }else
                        if (el.scrollTop + el.offsetHeight == el.scrollHeight) nextPage()
                    })
                }
            })
        }
    })

    const setContentsWrap = type => {
        if(type == undefined){
            type = getConfig('subfolders_wrap')
        }else{
            setConfig('subfolders_wrap', type)
        }
        let min = getConfig('subfolders_size', 200) + 70
        setTimeout(() => {
            g_sidebar.isShowing('bottom') && setCssVar('--offset-bottom', (type == '1' ? g_sizeable.get('subfolders') : min) +'px')
        }, 200)
    }
    g_action.registerAction({
        subfolders_search: dom => g_pp.setTimeout('subfolders_search', () => {
            let search = dom.value
            $('.subfolders_item').each((i, el) => {
                let title = el.querySelector('.sb_folderBadge').innerText
                el.classList.toggle('hide', search != '' && !PinYinTranslate.check(search, title))
            })
        }, 400),
        range_subfolders_size: dom => g_pp.setTimeout('subfolders_size', () => {
            let val = Math.min(Math.max(dom.value, 50), 200)
            setConfig('subfolders_size', val)
            sb_showSubFolders(true)
        }, 500),
        subfolders_wrap: (d, a) => setContentsWrap(a[1]) & sb_showSubFolders(true),
        subfolders_showFolderCover: () => toggleConfig('subfolders_showFolderCover') & sb_showSubFolders(true)
    })

    var page_info = {}
    const getSaveTo = (type, fid) => g_db.opts.path+'/covers/'+type+'/'+fid+'.webp'
    const nextPage = async () => {
        let h = ''
        let {page, prePage, type, items} = page_info
        let inst = type == 'folders' ? g_folders : g_tags
        let start = page * prePage
        if(start >= items.length) return

        page_info.page++
        let folder_item =await inst.getFoldersItem()
        let show_cover = getConfig('subfolders_showFolderCover')
        return Promise.all(items.slice(start, start + prePage).map(async ([id, {title, icon, meta}]) => {
            let {width, height, path} = meta.cover || {width: 200, height: 200 }

            if(show_cover){
                let item = folder_item[id][0]
                if(item) path = await g_item.item_getVal('cover', item.md5)
            }
            path ??= meta.cover ? getSaveTo(type, id) : 'res/formats/folder.svg'

            let maxHeight = getConfig('subfolders_size') || 140
            let newWidth = maxHeight * width / height;
            return inst.folder_queryItems(id, true).then(cnt => {
                h += `
                <div class="subfolders_item position-relative cursor-pointer text-center" title="${title}">
                    <img class="rounded lazyload" src="res/loading.gif" data-src="${path}?${Date.now()}" style="width: ${newWidth}px;height: ${maxHeight}px;object-fit:cover;" onclick="g_datalist.tab_remove()" data-action="category_${type}" data-name="${id}" data-list="${type}" >
                    <a class="badge bg-danger position-absolute top-0 end-0">${cnt}</a>

                    <p>
                        <a class="badge bg-primary sb_folderBadge">${title}</a>
                    </p>
                </div>`
            })
        })).then(() => {
            let div = $('#subfolders_content')
            let scroll = div.find('#subfolders_scroll')
            $(h).appendTo(scroll).find('.lazyload').lazyload()
                
            setTimeout(() => (scroll.hasClass('scroll-x') ? hasScrollX : hasScrollY)(div[0]) === false && nextPage(), 500)
        })
    }

    const getElement = (list, name) => getEle({name, list}, '#subfolders_content ')
    const sb_showSubFolders = reload => {
        let {type, value} = g_datalist.tab_getData()
        if(!['folders', 'tags'].includes(type)) return

        let inst = type == 'folders' ? g_folders : g_tags
        let items = Object.entries(inst.folder_getSibilings(value, true))
        if(!reload && page_info.items && isObjEqual(items.map(([k]) => k), page_info.items.map(([k]) => k))) return

        let id = 'subfolders_scroll'
        getEle({input: "subfolders_search"}).prop('placeholder', '搜索'+items.length+'个项目')
        $('#subfolders_content').html(items.length ? (getConfig('subfolders_wrap') == '1' ? 
        `<div id="${id}" class="w-full overflow-container justify-content-around m-0 d-flex flex-wrap" style="gap: 6px;padding-bottom: 200px;"></div>` : 
        `<div id="${id}" class="scroll-x h-full m-0 p-0" style="display: -webkit-inline-box;gap: 6px;"></div>`) : '')
        page_info = {page: 0, prePage: 20, type, value, items}
        items.length && nextPage()
    }

    // 悬浮预览
    g_setting.setDefault('sb_coverPreview', true)
    g_setting.tabs.plugins.elements['sb_coverPreview'] = {
        title: '悬浮显示文件夹/标签图片',
        type: 'switch',
        value: () => getConfig('sb_coverPreview'),
    }
    g_setting.onSetConfig('sb_coverPreview', () => toast('重启生效'))
    if(getConfig('sb_coverPreview')){
        let selector = '[data-action="category_folders"],[data-action="category_tags"]'
        const toggleShow = ({type, target, clientX, clientY}) => {
            if(target.tagName == 'IMG') return // 不在本体内显示

            let remove = type == 'mouseleave'
            let el = insertEl({ tag: 'div', text: '', props: { id: 'sb_coverPreview', class: 'position-fixed pe-none', style: 'z-index: 99;'} }, { target: $('html'), method: 'prependTo', remove })
            if(!remove){
                if(type == 'mouseenter'){
                    let {list, name} = target.dataset
                    let cover = getSaveTo(list, name)
                    nodejs.files.exists(cover) && el.html(`<img src="${cover}" style="width: 200px;">`)
                }
                el.css({left: clientX + 20, top: clientY + 10})
            }
        }
        $(document)
        .on('mouseenter', selector, toggleShow)
        .on('mouseleave', selector, toggleShow)
        .on('mousemove', selector, toggleShow)
    }
    let update = ({name, tab}) => name == 'tablist' &&  g_ui.isShowing('subfolders') && g_pp.setTimeout('showSF', () => sb_showSubFolders(), 500)
	g_plugin.registerEvent('tab.event_shown', update)
	g_plugin.registerEvent('tab.event_init', update)
    // ---------------------

    // 设置封面
    g_fileDrop.register('sb_folderCover', {
        selector: '.sb_folderBadge',
        layout: ``,
        reviceFileObject: true,
        acceptTypes: ['Files'], 
        async onParse({file, html}, target) {
            let url
            if(g_cache.draging) url = await g_item.item_getVal('cover', g_cache.dragingMD5s[0])
            url ??= file.data.length ? file.data[0].path : file.items.files[0]
            url ??= parseHtml(html.data).find('img').attr('src')
            if(isEmpty(url)) return
            cropImage(url, {
                callback: (imgData, width, height) => {
                    let {name, list} = getParent(target, '.subfolders_item').find('[data-name]').data()
                    let saveTo = getSaveTo(list, name)
                    let err = nodejs.files.write(saveTo, Buffer.from(imgData.replace(/^data:image\/\w+;base64,/, ""), 'base64'))
                    if(err) return toast(err.toString(), 'danger')

                    let inst = list == 'folders' ? g_folders : g_tags
                    inst.setMetaData(name, {cover: {width, height}})
                    getElement(list, name).attr('src', saveTo+'?'+Date.now())
                    toast('设置封面成功', 'success')
                },
            })
        }
    })

    function cropImage(src, {callback, opts}) {
        let cropper 
        opts ??= {}
        confirm(`<img id="cropImage" class="w-full" src="${src}">`, {
            id: 'modal_cropImage',
            title: '裁剪图片',
            scrollable: true,
            onShow: () => {
                loadRes([_dataPath+'public/js/cropper.min.js', _dataPath+'public/css/cropper.min.css'], () => {
                    cropper = new Cropper($('#cropImage')[0], Object.assign({
                        // aspectRatio: 1 / 1,
                        viewMode: 3,
                    }, opts))
                })
            },
        }).then(() => {
            // { width: 255, height: 255 }
            let {width, height} = cropper.getCropBoxData()
            callback(cropper.getCroppedCanvas(opts.result).toDataURL('image/webp'), parseInt(width), parseInt(height))
        })
    }
})()
