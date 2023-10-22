// ==UserScript==
// @name        示例代码大全
// @namespace   a9d84731-8eaf-494a-a020-c26459aa88ed
// @version     0.0.1
// @author      hunmer
// @description 一些常用代码整理
// @updateURL               
// @primary     1
// ==/UserScript==

({
    path: g_plugin.getSciptPath() + '示例代码大全/',
    data: [],
    init(){

        $(`
            <div data-action="doc_show" title="示例代码大全">
                <i class="ti ti-code fs-2"></i>
            </div>
        `).prependTo('.traffic_icons')

        g_action.registerAction({
            doc_show: () =>  this.show(),
            doc_search: dom => g_pp.setTimeout('doc_search', () => this.search({keyword: dom.value}), 500),
            doc_item: dom => $('#doc_code').val($(dom).data('value')) & $('#doc_output').val(''),
            doc_folder: dom => {
                getEle('doc_folder', '.active').removeClass('active')
                this.search({folder: $(dom).addClass('active').data('value')})
            },
            doc_copy: () => ipc_send('copy', $('#doc_code').val()),
            doc_run: () => {
                let code = $('#doc_code').val()
                if(!isEmpty(code)){
                    try {
                        eval(code)
                    } catch(err){
                        alert(err.toString, {title: '报错了!', type: 'danger'})
                    }
                }
            }
        })
    },

    async initData(){
        let data = {};
        (await nodejs.files.dirFiles(this.path+'datas/', ['txt'])).forEach(file => {
            let name = getFileName(file, false)
            data[name] = []
            try {
                let lines = nodejs.files.read(file).split('*-*-*')
                lines.forEach(str => {
                    let [, title, ...code] = str.split("\r\n")
                    if(!isEmpty(title) && code.length){
                        data[name].push([title, code.join("\r\n")])
                    }
                })
            } catch(err){
                console.error(err)
            }
        })
        this.data = data
    },

    search({keyword, folder}){
        let result = []
        if(!isEmpty(keyword)){
            Object.values(this.data).forEach(items => {
                result.push(...items.filter(([title]) => title.indexOf(keyword) != -1))
            })
        }else
        if(!isEmpty(folder)){
            getEle({input: 'doc_search'}).val('')
            result = [...this.data[folder]]
        }
        this.showResult(result)
    },

    showResult(result){
        let div = $('#doc_results').html('')
        if(!result.length) return div.html(`<h4 class="w-full mt-2 text-center">空空如也...</h4>`)

        result.forEach(([title, code]) => {
            $(`
                <div class="h-fit m-1" data-action="doc_item">
                    <button class="btn btn-ghost-primary btn-pill">
                        ${title}
                    </button>
                </div>
            `
            ).data('value', code).appendTo(div)
        })
    },

    async show(){
        await this.initData()

        let fun = console.info
        console.info = function(...args){
            let input = $('#doc_output')
            args.forEach(arg => input.val(input.val() + JSON.stringify(arg, undefined, 2)) + "\n")
            fun.apply(this, args)
        }

        g_modal.modal_build({
            id: '',
            title: '示例代码大全',
            bodyClass: 'p-0',
            width: '80%',
            scrollAble: false,
            onClose: () => console.info = fun,
            html: `
                <div class="row w-full m-0">
                    <div class="col-4 border-end m-0 mt-2">
                        <div class="w-full">
                            <input class="form-control" data-input="doc_search" placeholder="搜索">
                        </div>
                        <div class="w-full d-flex flex-nowrap scroll-x mt-2">
                            ${(() => Object.keys(this.data).map(name => `
                                <button class="btn btn-pill me-2" data-action="doc_folder" data-value="${name}">
                                    ${name}
                                </button>
                            `).join(''))()}
                        </div>

                        <div id='doc_results' class="p-2 d-flex flex-wrap align-content-start w-full overflow-y-auto" style="height: calc(100vh - 250px);">

                        </div>
                    </div>
                    
                    <div class="col-8">
                        <div class="w-full overflow-y-hidden mb-2 mt-2 d-flex flex-wrap" style="height: 40%">
                            <div class="me-auto d-flex">
                                <i class="ti ti-code me-2 fs-2"></i>
                                <span>代码</span>
                            </div>
                            <div class="ms-auto">
                                <a class="btn btn-sm" data-action="doc_copy" title="复制">
                                    <i class="ti ti-clipboard"></i>
                                </a>
                            </div>
                            <div class="overflow-y-auto col-12" style="height: calc(100% - 30px);">
                                <textarea id="doc_code" rows=10 class="form-control" data-bs-toggle="autosize" placeholder="输入代码"></textarea>
                            </div>
                        </div>

                        <div class="w-full overflow-y-hidden mb-2 mt-2 d-flex flex-wrap" style="height: 40%">
                            <div class="me-auto d-flex">
                                <i class="ti ti-printer me-2 fs-2"></i>
                                <span>控制台输出</span>
                            </div>
                            <div class="ms-auto">
                                <a class="btn btn-sm" onclick="$('#doc_output').val('')" title="清空">
                                    <i class="ti ti-trash"></i>
                                </a>
                            </div>
                            <div class="overflow-y-auto col-12" style="height: calc(100% - 30px);">
                                <textarea id="doc_output" rows=10 class="form-control pb-2" data-bs-toggle="autosize" placeholder=""></textarea>
                            </div>
                        </div>

                        <div class="w-full d-flex">
                            <div class="ms-auto">
                                <button class="btn btn-warning" onclick="ipc_send('devtool')" title="控制台">
                                    <i class="ti ti-app-window"></i>
                                </button>
                                <button class="btn btn-success" data-action="doc_run" title="运行">
                                    <i class="ti ti-player-play"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `,
        })
    },
}).init()