import { execSync } from 'child_process'
import { packages } from '../meta/packages'
import consola from 'consola'

async function publish() {
  for (const { name } of packages) {
    consola.info(`Publishing @grafana-fast/${name}`)
    try {
      execSync(`cd packages/${name}/dist && npm publish --access public`, {
        stdio: 'inherit'
      })
      consola.success(`Published @grafana-fast/${name}`)
    } catch (e) {
      consola.error(`Failed to publish @grafana-fast/${name}`)
    }
  }
}

publish()
