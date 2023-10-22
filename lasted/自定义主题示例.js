// ==UserScript==
// @name    自定义主题示例
// @version    0.0.1
// @author    hunmer
// @description    添加自定义主题
// @namespace    d82b1faa-f977-4ad7-8a24-734aafccd3f4

// ==/UserScript==

g_theme
.register('theme-1', {
    palette: {
        primary: '#74BDCB', // 突出色
        second: '#EFE7BC',  // 辅助色
        bg: '#E7F2F8', // 背景色
        text: '#353643' // 文本颜色
    },
})
.register('theme-2', {
    palette: {
        primary: '#E5D7BE',
        second: '#82807F',
        bg: '#414754',
        text: '#E3E8F0'
    },
    bg: {
        style(palette){
            // 自定义css,可固定壁纸等等
            return `


            `
        }
    }
})

