// ==UserScript==
// @name        侧边栏项目并排显示
// @namespace   d0973ff0-4398-4aa2-bea3-f0e8a18b73e6
// @version     0.0.1
// @author      hunmer
// @description 密集显示
// @updateURL               
// @primary     1
// ==/UserScript==

let selector = '.accordion-item'
g_style.addStyle('sidebar_collapse', `
    ${selector} {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-around;
    }

    ${selector} h2 {
        width: 100%;
    }

    ${selector} .collapse.opened {
        width: 100%;
        max-width: unset;
        text-align: center;
    }

    ${selector} .collapse {
        min-width: 25%;
        max-width: 50%;
        width: unset;
    }

    ${selector} .col-auto {
        display: none;
    }
`)

