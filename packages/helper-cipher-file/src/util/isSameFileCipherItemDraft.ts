import type { IDraftCatalogItem } from '@guanghechen/cipher-workspace.types'

export function isSameFileCipherItemDraft(
  oldItem: Readonly<IDraftCatalogItem>,
  newItem: Readonly<IDraftCatalogItem>,
): boolean {
  if (oldItem === newItem) return true
  return (
    oldItem.plainFilepath === newItem.plainFilepath &&
    oldItem.cryptFilepath === newItem.cryptFilepath &&
    oldItem.fingerprint === newItem.fingerprint &&
    oldItem.keepPlain === newItem.keepPlain &&
    oldItem.cryptFilepathParts.length === newItem.cryptFilepathParts.length &&
    oldItem.cryptFilepathParts.every(part => newItem.cryptFilepathParts.includes(part))
  )
}