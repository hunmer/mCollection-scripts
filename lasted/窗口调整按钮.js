// ==UserScript==
// @name        窗口调整按钮
// @namespace   4cab7000-376d-470f-8b0b-6caf6299cec1
// @version     0.0.1
// @author      hunmer
// @description 切换窗口调整按钮风格
// @updateURL               
// @primary     1
// ==/UserScript==

g_style.addStyle(`window_style`, `
    .light {
        background-color: unset !important;
        border-radius: unset !important;
        border: 0 !important;
        margin-bottom: 4px;
    }
`)

getEle('max').html(`<i class="ti ti-maximize"></i>`)
getEle('min').html(`<i class="ti ti-minus"></i>`)
getEle('close').html(`<i class="ti ti-x"></i>`)