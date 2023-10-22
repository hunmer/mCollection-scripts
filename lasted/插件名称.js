// ==UserScript==
// @name        插件名称
// @namespace   58337bea-b21b-4a95-a662-509db125c19d
// @version     0.0.1
// @author      作者名称
// @description 注释说明
// @updateURL               
// @primary     1
// ==/UserScript==

({
    init (){
        // 标签页插入元素事件
        g_plugin.registerEvent('datalist_insertedItems', ({elements, list}) => {
            console.log({数据: list, 元素列表: elements})
            // 遍历新增的数据
            list.forEach((item, index) => {
                // 获取url数据
                 g_detail.getDetail(item, 'url').then(({url}) => {
                    if(!isEmpty(url)){
                        console.log({item, url, element: elements[index]})
                        // do something...
                    }
                })
            })
        })
    }
}).init()