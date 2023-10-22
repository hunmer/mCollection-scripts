const {readdirSync, writeFileSync} = require('fs')
let html = '<p><h1>点击下面链接可在线导入</h1></p>\r\n'
let md = '# 点击下面链接可在线导入 \r\n\r\n'
readdirSync('../lasted/').forEach(fileName => {
    if(fileName.endsWith('.js')){
        let url = `mlauncher:\\\\?appId=mCollection&method=doMethod&data=${JSON.stringify({method: 'plugin_import', data: {url: 'https://github.com/hunmer/mCollection-scripts/raw/main/lasted/'+fileName}})}`
        md += `- [${fileName}](${url})\r\n`
        html += `<p><a href='${url}' target='_blank'>${fileName}</a></p>\r\n`
    }
})

writeFileSync('../README.md', md)
writeFileSync('../index.html', html)