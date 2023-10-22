// ==UserScript==
// @name        AI打标签
// @namespace   9db549b5-7e8e-46e7-a762-31716c412847
// @version     0.0.1
// @author      hunmer
// @description 为素材自动生成标签,下载地址:https://www.123pan.com/s/jBjbVv-naVHA.html
// @updateURL               
// @primary     1
// ==/UserScript==

var g_tagger = {

    init(){
        let path = this.path = 'D:\\AI_Tagger\\'
        this.runPy = nodejs.require(path + "node_modules\\python-shell").PythonShell;
        let {labelsPath, modelPath} = this.config = getConfig('tagger', {
            labelsPath: path+"selected_tags.csv",
            modelPath: path+"model.onnx",
            generalThreshold: "0.3",
            characterThreshold: "0.3",
            concurrencyLimit: "5",
        })

        g_menu.list.datalist_item.items.push(...[
            { text: '分析标签', icon: 'tags', action: 'tagger_item' },
        ])

        g_setting.tabs.plugins.elements['tagger'] = {
            title: 'AI打标签',
            type: 'html',
            value: `
                <button class="btn" data-action="tagger_all">全素材AI打标签</button>
                <button class="btn" data-action="tagger_settings">设置</button>
            `
        }

         g_plugin.registerEvent('image.saveCover', ({ md5 }) => {
            g_pp.setTimeout('tager_'+md5, () => this.parseItem({md5}), 1000)
        })

        g_action.registerAction({
            tagger_settings: () => {
                let elements = {}
                Object.entries(this.config).map(([k, value]) => {
                    elements[k] = {
                        title: k,
                        value,
                        type: ['labelsPath', 'modelPath'].includes(k) ? 'file_chooser' : 'text',
                        required: true
                    }
                })
                g_form.confirm1({
                    id: 'tagger_settings',
                    title: 'tagger settings',
                    elements,
                    callback: ({vals}) => {
                        this.config = vals
                        setConfig('tagger', vals)
                        toast('保存成功', 'success')
                    }
                })
            },
            tagger_item: async () => {
                toast('正在分析中...')
                Promise.all((await g_detail.getSelectedItems()).map(this.parseItem)).then(() => toast('全部分析完成', 'success'))
                g_menu.hideMenu('datalist_item')
            },
            tagger_all: async () => {
                let list = await new SQL_builder(g_rule.list.noTag.sqlite).all()
                let len = list.length
                if(!len) return toast('素材都有标签,无需更新!', 'success')
                toast('正在为'+len+'个素材生成标签,请在菜单栏查看进度...')
                Promise.all(list.map(this.parseItem)).then(() => toast('全部分析完成', 'success'))
            }
        })

        $(() => setTimeout(() => {
            if(!nodejs.files.exists(labelsPath) || !nodejs.files.exists(modelPath)){
                toast('请检查配置项文件是否存在!', 'danger')
                doAction('tagger_settings')
            }
        }, 1000))
    },

     parseItem(item){
        return new Promise(async reslove => {
            let {input, md5} = item
            input ??= await g_item.item_getVal('cover', md5)
            if(nodejs.files.exists(input)){
                g_tagger.addQuery({
                    input,
                    cb: async results => {
                        results = results.map(tag => tag.trim().replaceAll('\\', ''))
                        g_tags.setItemFolder(item.id, uniqueArr([...await g_tags.getItemFolder(), ...g_tags.folder_toIds(results)])).then(() => reslove(results))
                    }
                })
            }
        })
    },

    addQuery(args){
        let name = 'ai_tagger'
        let queue = g_queue.list[name] ?? new Queue(name, {
            max: 5,
            interval: 500,
            timeout: 1000 * 10,
            title: '标签分析',
            onUpdate: ({ runnings, waittings }) => {
                let cnt = runnings.length + waittings.length
                let el = insertEl({tag: 'span', text: '', props: { id: 'badge_tagger', class: 'badge bg-primary me-2'}}, {target: $('#traffic'), method: 'prependTo', remove: cnt == 0})
                el && el.html(`识别标签队列:${cnt}`)
            },
        })

        let {input, cb} = args
        queue.add(input, {
            onStatusChange(status, taskCB, file) {
                if (status != TASK_RUNNING) return
                g_tagger.readFileTag(file).then(tags => {
                    cb(tags)
                    taskCB(tags.length ? TASK_COMPLETED : TASK_ERROR)
                })
            }
        })
    },

    test(){
        this.readFileTag('I:/software/library/AI画图R15/files/4c/ac/4cacadac9bd10057da80fb706409ebc1/20230707175132.png').then(console.log)
    },

	 readFileTag(file) {
        let {labelsPath, modelPath, generalThreshold, characterThreshold} = this.config
		return this.runPy.run("givemessr.py", {
            pythonPath: this.path+'\\venv\\Scripts\\python.exe',
            scriptPath: this.path+'\\pyutils',
            args: [
                "-ip", file,
                "-lp", labelsPath,
                "-mp", modelPath,
                "-gt", generalThreshold,
                "-ct", characterThreshold,
                "-mode", "a"
            ],
        })
	}

}

g_tagger.init()