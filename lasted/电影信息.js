// ==UserScript==
// @name        电影信息
// @namespace   515eb670-804a-465a-9991-47623d43f764
// @version     0.0.1
// @author      hunmer
// @description 为素材添加电影信息字段
// @primary     1
// ==/UserScript==

var g_movie = {
    // 获取电影数据
    async getData(item, defV = {}) {
        return (await g_field.getItemData(item) || {})['电影'] || defV
    },
    // 设置电影数据
    async setData(fid, data) {
        let raw = await g_field.getItemData({ fid })
        raw['电影'] = data
        return g_field.setData(fid, { data: raw })
    },
    // 移除电影数据
    async removeData(fid) {
        let raw = await this.getData(fid)
        delete raw['电影']
        if (Object.keys(raw) == 0) {
            g_field.removeData(fid)
        } else {
            g_field.setData(fid, raw)
        }
    },
    
    getCurrentSite(){
        return 'dygod'
    },

    onSearch(keyword){
        if(isEmpty(keyword)) return
        let div = $('#movie_search_result')
        div.html(g_tabler.build_placeHolder({cnt: 6}))
        this.search({keyword}).then(data => {
            if(!data.length) return toast('没有搜索到电影数据!', 'danger')

            let list = {}
            data.forEach(({title, url}) => list[url] = title)
            let html = g_tabler.build_radio_list({list})
            div.html(html)
        })
    },

    search_show(item, site){
        site ??= this.getCurrentSite()
        let title = getFileName(item.title, false)
        g_form.confirm1({
            id: 'movie_search',
            btn_ok: '获取信息',
            title: '搜索电影',
            elements: {
                title: {
                    title: '电影名称',
                    // value: '我',
                    value: title,
                    placeHolder: '输入电影名称',
                    props: 'data-keydown="movie_search_keydown"'
                },
                container: {
                    type: 'html',
                    value: `
                        <div id="movie_search_result" class="row w-full"></div>
                    `
                }
            },
            callback: ({btn}) => {
                let url = $('#movie_search_result input:checked').val()
                if(isEmpty(url)){
                    toast('请选择一项!', 'danger')
                }else{
                    btn.classList.add('btn-loading')
                    try {
                        this.parseURL({url, site}).then(data => {
                            console.log(data)
                            data.meta = JSON.stringify(data.meta || {})
                            g_field.showField('电影', data, ({vals}) => {
                                this.setData(item.id, vals).then(() => {
                                    toast('保存成功', 'success')
                                    // data.meta.
                                    // downloadFile({
                                    //     url: 
                                    // })

                                    g_modal.remove('movie_search')

                                })
                            })
                        })
                    } catch(err) {
                        toast(err.toString(), 'danger')
                    } finally {
                        btn.classList.remove('btn-loading')
                    }
                }
                return false
            },
        }, {
            onShow: () => setTimeout(() => this.onSearch(title), 1000)
        })
    },

    init() {
        // this.search({ keyword: '初恋这件小事' })
        // this.parseURL({ url: 'https://www.dygod.net/html/gndy/dyzz/20120721/38719.html' })
        // https://www.dygod.net/html/tv/rihantv/20230719/120077.html
        g_menu.list.datalist_item.items.push(...[
            { text: '搜索电影数据', icon: 'search', action: 'movie_search' },
        ])

        g_action.registerAction({
            movie_search: async () => {
                this.search_show(await g_data.data_getData(g_menu.key))
                g_menu.hideMenu('datalist_item')
            },
            movie_search_keydown: ({value}, a, {keyCode}) => keyCode == 13 && this.onSearch(value)
        })

        g_plugin.registerEvent('field.inited', () => {
            g_field.fields['电影'] = {
                fields: {
                    title: {title: '片名'},
                    alias: {title: '译名'},
                    director: {title: '导演', class: 'col-3'},
                    actors: {title: '主演', class: 'col-9'},

                    minutes: {title: '片长', class: 'col-4'},
                    publish: {title: '上映日期', class: 'col-8'},

                    year: {title: '年代', class: 'col-4'},
                    country: {title: '产地', class: 'col-4'},
                    subtitle: {title: '字幕', class: 'col-4'},
                    summary: {title: '简介', type: 'textarea'},
                    meta: {title: '其他属性', type: 'textarea', placeHolder: '无'},
                },
                icon: 'movie',
            }
        })
    },
    getResourceURL: ({ url, el, host, attr = 'href' }) => {
        if (el) url = el.getAttribute(attr) || ''
        if (url.startsWith('/')) url = host + url
        return url
    },
    apis: {
        'dygod': {
            title: '电影天堂',
            search: (keyword, page = 0) => {
                return new Promise(reslove => {
                    g_movie.http_request("https://www.dygod.net/e/search/index.php", {
                        method: "POST",
                        body: "show=title&tempid=1&keyboard=" + _encodeURIComponent(keyword) + "&Submit=%C1%A2%BC%B4%CB%D1%CB%F7", // ?page=" + page
                    }).then(body => {
                        reslove(getElementsValues(
                            body.find('.co_content8 table'), table => {
                                let link = table.querySelector('.ulink')
                                return {
                                    url: 'https://www.dygod.net' + link.getAttribute('href'),
                                    title: link.innerText,
                                    date: table.querySelector('font').innerText,
                                    desc: table.querySelectorAll('td[colspan]')[1].innerText,
                                }
                            })
                        )
                    });
                })
            },
            parse: url => {
                return new Promise(reslove => {
                    g_movie.http_request(url).then(body => {
                        let div = body.find('.co_content8')
                        let rules = [
                            // ['发布时间', 'date', s => s.replace('发布时间：', '')],
                            ['译　　名', 'alias'],
                            ['片　　名', 'title'],
                            ['年　　代', 'year'],
                            ['产　　地', 'country'],
                            ['语　　言', 'lang'],
                            ['字　　幕', 'subtitle'],
                            ['上映日期', 'publish', s => s.split('(')[0]],
                            ['片　　长', 'minutes', s => s.split(' ')[0]],
                            ['导　　演', 'director', s => s.split('　').filter(s => s != '').join('&').replace('导&演&', '')],
                            ['主　　演', 'actors', s => s.split('　').filter(s => s != '').join('&').replace('主&演&', '')],
                            ['简　　介', 'summary'],
                        ]
                        let imgs = div.find('img')
                        let host = 'https://www.dygod.net'
                        let ret = { 
                            meta: {
                                cover: g_movie.getResourceURL({ el: imgs[0], host, attr: 'src' }),
                                screenshot: g_movie.getResourceURL({ el: imgs[1], host, attr: 'src' })
                            }
                        }
                        div.text().split('◎').forEach(line => {
                            rules.forEach(([prefix, key, cb]) => {
                                if (line.indexOf(prefix) != -1) {
                                    ret[key] = (cb ? cb(line) : line).toString().replace(prefix, '').trim()
                                }
                            })
                        })
                        reslove(ret)
                    })
                })

            }
        }
    },
    http_request(url, opts = {}) {
        return new Promise(reslove => {
            let defV = {}
            if (opts.method == 'POST') {
                Object.assign(defV, {
                    "headers": { "content-type": "application/x-www-form-urlencoded" },
                })
            }
            fetch(url, { ...defV, ...opts })
                .then(res => res.arrayBuffer())
                .then(buffer => {
                    let html = new TextDecoder("gbk").decode(buffer)
                    reslove(parseHtml(html));
                })
        })
    },
    getInst(site) {
        return this.apis[site]
    },
    search({ keyword, site = 'dygod' }) {
        let inst = this.getInst(site)
        return inst.search(keyword)
    },
    parseURL({ url, site = 'dygod' }) {
        let inst = this.getInst(site)
        return inst.parse(url)
    },

}

g_movie.init()