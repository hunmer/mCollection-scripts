// ==UserScript==
// @name        webview功能示例
// @namespace   22cd3092-ac9c-4369-9798-c522e4270be9
// @version     0.0.1
// @author      hunmer
// @description webview功能示例
// @updateURL               
// @primary     1
// ==/UserScript==

({
    init(){
        this.create()
    },

    create(){
        alert(`
            <div class="row">
                <div class="btn-list col-12">
                    <button class="btn" data-action="webview_refresh">刷新</button>
                </div>
                <div class="">
                    <webview src="https://www.baidu.com" class="w-full h-full" contextIsolation="false" allowpopups disablewebsecurity nodeintegration spellcheck="false" useragent="Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.134 Safari/537.36 Edg/103.0.1264.71" preload="%preload%" partition="persist:test"></webview>
                </div>
            </div>
        `, {
            id: 'webview_demo'
        })
    },

    destroy(){


    },

    refresh(){


    }

}).init()