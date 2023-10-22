assignInstance(g_hotkey, {
    init(){
        g_hotkey.setDefaultList([
            {
                title: '刷新',
                hotkey: ['f5', 'ctrl+r', 'meta+r'],
                content: "ipc_send('reload')",
                type: 2,
            },
            {
                title: '开发者工具',
                hotkey: 'f12',
                content: "ipc_send('devtool')",
                type: 2,
            },
            {
                title: '切换左侧边',
                hotkey: 'ctrl+shift+!',
                content: "doAction('sidebar_toggle,left')",
                type: 2,
            },
            {
                title: '切换右侧边',
                hotkey: 'ctrl+shift+@',
                content: "doAction('sidebar_toggle,right')",
                type: 2,
            },
            {
                title: '快捷键设置',
                hotkey: 'f10',
                content: "g_hotkey.modal_show()",
                type: 2,
            },
            {
                title: '全屏',
                hotkey: 'f11',
                content: "toggleFullScreen()",
                type: 2,
            }
        ])
    }
})