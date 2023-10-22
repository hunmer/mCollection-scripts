// ==UserScript==
// @name    开发助手
// @version    1.0
// @author    hunmer
// @icon      bug:red
// @updateURL   https://neysummer2000.fun/mCollection/scripts/开发助手.js
// @description    一些便利功能
// @namespace    72a45071-9af7-4c6c-8c3b-454d80039af0
// ==/UserScript==

({

    getDBFiles(basePath) {
        basePath ??= g_db.getSaveTo()
        return flattenArray(nodejs.files.listDir(basePath).map(dir => nodejs.files.listDir(dir).map(dir => nodejs.files.listDir(dir)))).map(dir => getFileName(dir))
    },
    init() {
        const self = this
        g_hotkey.register('ctrl+shift+t', {
            title: '更多工具',
            content: "g_dropdown.quickShow('tools_list')",
            type: 2,
        })
        let list = {
            icons: {
                title: '图标查看器',
                icon: 'icons',
                action: 'icon_test',
            },
            check_covers: {
                title: '检查视频封面',
                icon: 'photo-question',
                action: 'check_covers',
            },
            check_files: {
                title: '检查不存在文件',
                icon: 'file',
                action: 'check_files',
            },
            check_media: {
                title: '检查封面大小',
                icon: '',
                action: 'check_media',
            },
            db_clear: {
                title: '清空数据库',
                icon: 'trash',
                class: 'text-danger',
                action: 'db_clear',
            },
            clearConfig: {
                title: '配置初始化',
                icon: 'reload',
                class: 'text-danger',
                action: 'clearConfig',
            },
            clearLocalstotage: {
                title: '清除客户端数据',
                icon: 'reload',
                class: 'text-danger',
                action: 'clearLocalstotage',
            },
            debug_covers_delete: {
                title: '删除选中封面',
                icon: 'photo-off',
                class: 'text-danger',
                action: 'debug_covers_delete',
            },
            copyDateFolders: {
                title: '导出指定日期素材库',
                action: 'copyDateFolders',
            },
            check_existsFiles: {
                title: '恢复数据文件',
                icon: '',
                class: 'text-primary',
                action: 'check_existsFiles',
            },
        }
        g_dropdown.register('tools_list', {
            position: 'end-top',
            offsetLeft: 5,
            autoClose: true,
            list,
        })

        $(`<i class="ti ti-dots fs-2" data-action="dropdown_show,tools_list" title="更多工具"></i>`).appendTo('#icons_left')

        g_plugin.registerEvent('doAction,db_clear', async () => {
            if ((await g_data.getMd5List()).length > 50) {
                if (!(await confirm('你的素材库数量超过了 50,你确定要删除吗?此动作会同时删除素材库内的素材！'))) return false
            }
            nodejs.files.removeDir(await g_db.getSaveTo())
        })

        g_action.registerAction({
            check_files: () => {
                g_data.all('SELECT ')
                g_data.getMd5List().then(list => {
                    toast('开始检查文件中...请稍等...')
                    let ret = []
                    arrayQueue(list, async md5 => {
                        let file = await g_item.item_getVal('file', md5)
                        if (!nodejs.files.exists(file)) ret.push({md5, file})
                    }, () => {
                        let len = ret.length;
                        if (!len) return toast('无过期文件', 'success')
                        confirm(ret.map(({file}) => file).join("\r\n"), { title: len + '个文件不存在,是否删除', type: 'danger' }).then( () => {
                            ret.forEach(async ({md5}) => await g_data.data_remove(md5))
                            toast('删除成功!', 'success')
                        })
                    })
                })
            },
            check_media: async () => {
                let exts = [...g_format.getCategory('image'), ...g_format.getCategory('video')]
                let list = (await g_data.all(`SELECT id,md5,title,link FROM files LEFT JOIN media_meta ON files.id=media_meta.fid where media_meta.fid IS NULL OR media_meta.width == 0 OR media_meta.height == 0`)).filter(({ title }) => exts.includes(getExtName(title)))
                let len = list.length
                if (!len) return toast('没有需要更新的素材文件！', 'success')

                confirm('有【' + len + '】个素材文件需要读取,确定吗？').then(() => {
                    toast('开始读取【' + len + '】个素材文件,控制台可以查看进度')
                    arrayQueue(list, (item, i) => {
                        let { title, id } = item
                        console.log({ title, id }, (i / len * 100).toFixed(2) + '%')
                        return g_detail.inst.media.load(item).then(console.log)
                    }, () => toast('全部完成', 'success'), null)
                })
            },
            check_covers: async () => {
                g_data.getMd5List().then(list => {
                    toast('开始检查封面中...请稍等...')
                    arrayQueue(list, md5 => g_item.item_getVal('cover', md5).then(console.log), () => toast('全部检查完成', 'success'))
                })
            },
            debug_covers_delete: () => {
                Promise.all(g_detail.selected_keys.map(async md5 => nodejs.files.remove(await g_item.item_getVal('cover', md5))))
                    .then(() => {
                        toast('成功删除选中封面')
                    })
            },
            check_oldFiles: async () => {
                let list1 = this.getDBFiles()
                let list2 = await g_data.getMd5List()
                arr_compare(list1, list2)
            },
            check_existsFiles: async () => {
                let list1 = this.getDBFiles()
                let list2 = await g_data.getMd5List()
                let files = []
                Promise.all(arr_compare(list1, list2).removed.map(async md5 => {
                    let path = g_db.getSaveTo(md5)
                    nodejs.files.dirFiles(path).then(list => {
                        console.log(list)
                        let file = list.filter(file => !['cover.jpg'].includes(getFileName(file)))
                        if (file.length) files.push(file[0])
                    })
                })).then(() => {
                    g_data.file_revice(files).then(() => toast('成功恢复' + files.length + '个文件', 'success'))
                })
            },
            copyDateFolders() {
                let def = '2023-04-26 00:00' || getFormatedTime(5)
                prompt(def, { title: '输入起始日期' }).then(async date => {
                    date = new Date(date).getTime()
                    if (isNaN(date)) return toast('错误的日期格式', 'danger')
                    console.log(date)
                    let list = (await g_data.all('SELECT md5 from files where date > ' + date)).map(({ md5 }) => md5)
                    let len = list.length
                    if (!len) return toast('没有找到符合条件的素材', 'danger')
                    g_form.confirm1({
                        id: 'copyDateFolders',
                        title: '总共发现' + len + '个素材，请选择导出位置',
                        elements: {
                            path: {
                                title: '导出目录',
                                type: 'file_chooser',
                                required: true,
                                value: '',
                                opts: {
                                    title: '选择导出的目录',
                                    properties: ['openDirectory'],
                                },
                            },
                        },
                        callback({ vals }) {
                            // TODO QUEUE绑定进度提示
                            list.forEach(md5 => {
                                let old = g_db.getSaveTo(md5)
                                let target = vals.path + g_db.getSaveTo(md5, '')
                                console.log(nodejs.fs.copySync(old, target))
                            })
                            toast('复制成功！', 'success')
                        }
                    })
                })
            },
        })
    },
}).init()
