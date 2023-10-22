// ==UserScript==
// @name        自定义图标
// @namespace   0c3514d5-eef2-463b-b58d-d70714315cd0
// @version     0.0.1
// @author      hunmer
// @description 自定义图标
// @updateURL               
// @primary     1
// ==/UserScript==

(() => {
    const resPath = g_plugin.getSciptPath()+'icon_packs/'
    const loadIconPacks = id => {
        let iconPath = resPath + id + '/'
        const build = name => `
            .ti-${name} {
                font-size: unset !important;
            }
            .ti-${name}:before {
                content: "" !important;
                background-image: url('${iconPath+name}.svg');
                background-repeat: no-repeat;
                background-size: cover;
                background-position: center;
                width: 14px;
                height: 14px;
                display: -webkit-inline-box;
            }
        `
        nodejs.files.dirFiles(iconPath, ['svg', 'png', 'ico'], list => {
            g_style.addStyle('iconpack', `
                .ti.fs-lg:before {
                    height: 4rem !important;
                    width: 4rem !important;
                }
                .ti.fs-1:before {
                    height: 1.5rem !important;
                    width: 1.5rem !important;
                }
                .ti.fs-2:before {
                    height: 1.25rem !important;
                    width: 1.25rem !important;
                }
                .ti.fs-3:before {
                    height: 1rem !important;
                    width: 1rem !important;
                }
                .ti.fs-4:before {
                    height: .875rem !important;
                    width: .875rem !important;
                }
                .ti.fs-5:before {
                    height: .75rem !important;
                    width: .75rem !important;
                }
                .ti.fs-6:before {
                    height: .625rem !important;
                    width: .625rem !important;
                }
                
                ${list.map(file => build(getFileName(file, false))).join(" ")}
            `)
        })
    }
    g_setting.tabs.plugins.elements['icon_pack'] = {
        title: '图标包',
        type: 'select',
        list: nodejs.files.listDir(resPath).map(dir => getFileName(dir)),
        value: () => getConfig('icon_pack', ''),
    }
    g_setting.onSetConfig('icon_pack', val => loadIconPacks(val))
    g_setting.apply('icon_pack')
    // loadIconPacks('windows11')
})()
