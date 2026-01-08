import { metadata, allCategories } from '../packages/metadata/metadata'
import { updatePackageJSON, updateImport, updateGuideCategories } from './utils'

async function run() {
  await Promise.all([
    updateImport(metadata),
    updatePackageJSON(metadata),
    updateGuideCategories(allCategories)
  ])
}

run()
