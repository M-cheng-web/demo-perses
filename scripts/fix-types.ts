import { resolve } from 'path'
import fs from 'fs-extra'
import fg from 'fast-glob'

const DIR_TYPES = resolve(__dirname, '../types/packages')

async function run() {
  const files = await fg('**/*.d.ts', {
    cwd: DIR_TYPES,
    onlyFiles: true
  })

  for (const file of files) {
    const filePath = resolve(DIR_TYPES, file)
    let content = await fs.readFile(filePath, 'utf-8')
    
    // 替换导入路径
    content = content.replace(/@grafana-fast\/([\w-]+)\/(\w+)/g, '../$1/$2')
    
    await fs.writeFile(filePath, content, 'utf-8')
  }
}

run()
