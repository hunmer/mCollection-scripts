// ==UserScript==
// @name    SD提示词参考
// @version    0.0.1
// @author    hunmer
// @description    SD提示词参考合集
// @updateURL    
// @primary    1
// @namespace    6122c3d2-4967-4409-a4fc-dccd9baa6f00

// ==/UserScript==

({

    init(){
        const self = this
        const _type = 'sd_gallery'
        const _inst = g_speicalFolder
        g_lang.adds({
            [`sf_${_type}`]: {
                zh: 'SD图库',
                en: '',
            },
        });
        
        ['seaart', 'vega', 'arthub', 'aigodlike'].forEach(subtype => {
            let id = _type+'_'+subtype
            if(!_inst.get(id)){
                _inst.add(id, {
                    id, subtype,
                    type: _type,
                    icon: 'photo',
                    title: subtype,
                })
            }
        })

        g_dataResult.register(_type, {
            toString() {
                return _type+'_'+this.opts.subtype
            },
            loadPage(page, items){
                return new Promise(reslove => {
                    toast('正在加载数据')
                    self.getPage(page + 1, this.opts.api, ret => {
                        let {maxcount, result} = ret.data
                         result.forEach(({id, image, width, height, cfg, gallery}) => {
                            let vals = {
                                gallery,
                                md5: id.toString(),
                                title: id + '.png',
                                width, height, cfg,
                                size: width * height * 3, // 预想大小 
                                link: image,
                                cover: image,
                            }
                            items.push(vals)
                            g_data.cache.set(id, vals)
                        })
                        reslove(items)
                    })
                })
            },
            all(){
                return this.getItems()
            },
            parseItem(item){
                if(typeof(item) != 'object') item = this.getItems().find(({md5}) => md5 == item)
                return item
            },
            async columns(items){
                if(items.length == 1){
                     // 获取物品详细信息（如果有）
                    let {parseItem, headers} = g_datalist.tab_getData('sqlite').opts.api
                    if(parseItem){
                        headers ??= {}
                        let {request, callback} = eval(parseItem)(items[0])
                        let data = await self.post({method: 'GET', headers, ...request})
                        let cfg = eval(callback)(data)
                        console.log({data, cfg})
                        items[0].sd_meta = cfg
                    }
                }
                return {type: _type, items, columns: {}, sort: ['preview', 'sd_detail']}
            },
        })
        
        // 侧边栏
        let dropdown_id = 'actions_' + _type
        _inst.registerInst(_type, {
            dropdown_id,
            showFolder: this.showFolder,
        })

        g_dropdown.register(dropdown_id, {
            position: 'top-end',
            offsetLeft: 5,
            dataKey: dom => dom.parents('.list-group').find('[data-name]').data('name'),
            list: {
                edit: {
                    title: '编辑',
                    icon: 'pencil',
                    action: _type + '_edit',
                },
            }
        })

        let actions = ['edit'].map(k => _type+'_'+k)
        g_action.registerAction(actions, (dom, action) => {
            let key = g_dropdown.getValue(dropdown_id)
            let item = _inst.get(key)
            g_dropdown.hide(dropdown_id)
            switch(actions.indexOf(action[0])){
                case 0:
                    return this.modal_edit(key)
            }
        })

        // 素材信息
        g_plugin.registerEvent('onBeforeShowingDetail', async args => {
            let { items, type } = args
            if(items.length !== 1 || type !== 'sd_gallery') return

            if(items[0].sd_meta){
                args.sd_meta = items[0].sd_meta
                return
            }

            let {tag, uc, seed, model, mode, scale, steps} = items[0].cfg
            args.sd_meta = {
                prompt: tag,
                negative: uc,
                ends: seed,
                model_hash: model,
                sampler: mode,
                cfg_scale: scale,
                steps,
                // width, height
            } // 自定义数据源显示 
        }, 2)
    },

    getPage(page, api, callback){
        eval(api.nextPage)(page, api)

        let headers = api.headers || {}
        if(api.searchParams){
            return this.post({url: toURL(api.url, api.searchParams), headers}).then(ret => {
                console.log(ret)
                if(!api.parseData) return callback(ret)
                eval(api.parseData)(ret, api).then(callback)
            })
        }
        this.post({url: api.url, method: 'POST', data: {...api.data}, headers}).then(ret => {
            console.log(ret)
            eval(api.parseData)(ret, api).then(callback)
        })
    },

    post(opts){
        console.log(opts,)
        return ajax_request(opts)
    },
    
    showFolder(id) {
        let {icon, title, subtype} = g_speicalFolder.get(id)
        let api, pagePre
        switch(subtype){
            case 'aigodlike':
                pagePre = 48
                api = {
                    url: 'https://api.aigodlike.com/v1/content/illustrated-handbook/index?',
                    searchParams: {
                        page: 1,
                        orderType: 1,
                        asc: false,
                        timeSpan: 0,
                    },
                    nextPage: `(page, self) => self.searchParams.page = page`,
                    parseItem: `(item) => {
                        return {
                            request: {
                                url: 'https://api.aigodlike.com/v1/content/illustrated-handbook/detail?illustratedHandbookId='+item.md5,
                            },
                            callback(ret){
                                console.log(ret.data)
                                return g_sd_prompt.parsePrompt(ret.data.fullMeta)
                            }
                        }
                    }`,
                    parseData: `(source, self) => {
                        return new Promise(reslove => {
                            reslove({
                                data: {
                                    maxcount: source.data.total,
                                    result: source.data.map(item => {
                                        return {
                                            id: item.id,
                                            title: item.name,
                                            image: 'https://ocdn.aigodlike.com/img/paintings/'+item.imgIdf+'?x-oss-process=style/preview',
                                            cfg: {tag: item.parameters}
                                        }
                                    })
                                }
                            })
                        })
                    }`
                }
                break

            case 'seaart':
                pagePre = 40
                api = {
                    url: 'https://www.seaart.ai/api/v1/artwork/list',
                    data: {
                        page: 1,
                        page_size: pagePre,
                        order_by: "new",
                        type: "community",
                        keyword: "",
                        tags: []
                    },
                    nextPage: `(page, self) => self.data.page = page`,
                    parseData: `
                    (source, self) => {
                        return new Promise(reslove => {
                            let {has_more, items, time_ms} = source.data
                            if(time_ms > 0) self.data.time_to = time_ms;
                            reslove({
                                data: {
                                    maxcount: 999999,
                                    result: items.map(({id, created_at, banner, prompt}) => {
                                        let {height, width, url, nsfw} = banner
                                        return {
                                            id, width, height,
                                            image: url,
                                            cfg: {tag: prompt}
                                        }
                                    })
                                }
                            })
                        })
                    }`
                }
                break

                case 'vega':
                    pagePre = 30
                    api = {
                        url: 'https://rightbrain.art/apis/lora/getLoraModels/v1?',
                        searchParams: {
                            auth: 'public',
                            pageNo: 0,
                            pageSize: pagePre,
                            orderType: 'new',
                            keyword: '',
                            tag: 'all',
                            add:0,
                        },
                        nextPage: `(page, self) => self.searchParams.pageNo = page`,
                        parseData: `
                        (source, self) => {
                            return new Promise(reslove => {
                                reslove({
                                    data: {
                                        maxcount: source.data.total,
                                        result: source.data.list.map(item => {
                                            return {
                                                id: nodejs.files.getMd5(item.coverImage),
                                                image: item.coverImage,
                                                date: new Date(item.createDate).getTime(),
                                                cfg: {tag: item.remark.join(','), model: item.loraBaseName}
                                            }
                                        })
                                    }
                                })
                            })
                        }`
                    }
                    break

                case 'arthub':
                    pagePre = 30
                    api = {
                        url: 'https://fiwduaejmxwtidbnyoxy.supabase.co/rest/v1/user_art?',
                        headers: {
                            Apikey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpd2R1YWVqbXh3dGlkYm55b3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzcyNDkxNDIsImV4cCI6MTk5MjgyNTE0Mn0.S4YhWyi5BCPrlD-5HlGf-NV57il_1ucFzWJ7ta6C36w',
                            Authorization:'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpd2R1YWVqbXh3dGlkYm55b3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzcyNDkxNDIsImV4cCI6MTk5MjgyNTE0Mn0.S4YhWyi5BCPrlD-5HlGf-NV57il_1ucFzWJ7ta6C36w',
                            Origin: 'https://arthub.ai',
                            Prefer: 'count=estimated',
                            Referer: 'https://arthub.ai/',
                        },
                        searchParams: {
                            select: 'tags,public_score,internal_score,hash_id,asset_source,id,flag,created_by,created_by_username,description,anon_votes_user_art(user_id,vote)',
                            flag: 'is.null',
                            tags: 'cs.{public}',
                            'anon_votes_user_art.user_id': 'eq.1450fb10-1898-4e3c-8684-a72ded367d87',
                            // order: 'created_at.desc',
                            order: 'feed_score.desc',
                            offset: 0,
                            limit: pagePre
                        },
                        nextPage: `(page, self) => self.searchParams.offset = (page - 1) * 30`,
                        parseData: `
                        (source, self) => {
                            return new Promise(reslove => {
                                reslove({
                                    data: {
                                        maxcount: 999999,
                                        result: source.map(({hash_id, description, asset_source}) => {
                                            let gallery = asset_source.files ? asset_source.files.map(fn => 'https://img5.arthub.ai/user-uploads/'+asset_source.uh+'/'+hash_id+'/'+fn) : []
                                            let image = gallery.length ? gallery[0] : 'https://img6.arthub.ai/'+ (asset_source.files ? asset_source.files[0] : asset_source.file)
                                            return {
                                                id: hash_id,
                                                image, gallery,
                                                cfg: {tag: description}
                                            }
                                        })
                                    }
                                })
                            })
                        }`
                    }
                    break

            default:
                return
        }

        g_datalist.tab_new({
            icon, title, pagePre, 
            maxPage: 99999,
            view: 'columns',
            sqlite: {
                opts: {
                    type: 'sd_gallery',
                    subtype, api, 
                }
            }
        })
    }
    
}).init()
