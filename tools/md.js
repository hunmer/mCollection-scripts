const {readdirSync, writeFileSync} = require('fs')

let output = '# 点击下面链接可在线导入 \r\n\r\n'
readdirSync('../lasted/').forEach(fileName => {
    if(fileName.endsWith('.js')){
        output += `- [${fileName}](mlauncher:\\\\?appId=mCollection&method=doMethod&data=${JSON.stringify({method: 'plugin_import', data: {url: 'https://github.com/hunmer/mCollection-scripts/raw/main/lasted/'+fileName}})})\r\n`
    }
})

writeFileSync('../README.md', output)