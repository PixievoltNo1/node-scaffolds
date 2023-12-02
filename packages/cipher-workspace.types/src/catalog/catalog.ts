import type { IReadonlyCipherCatalog } from './catalog.readonly'
import type { ICatalogDiffItem, IDraftCatalogDiffItem } from './diff-item'
import type { ICatalogItem } from './item'

export interface ICipherCatalog extends IReadonlyCipherCatalog {
  /**
   * Apply catalog diffs.
   */
  applyDiff(diffItems: Iterable<ICatalogDiffItem>): void

  /**
   * Calculate diff items with the new catalog items.
   * @param newItems
   */
  diffFromCatalogItems(newItems: Iterable<ICatalogItem>): ICatalogDiffItem[]

  /**
   * Calculate diff items.
   * @param plainFilepaths
   * @param strickCheck     Wether if to check some edge cases that shouldn't affect the final result,
   *                        just for higher integrity check.
   */
  diffFromPlainFiles(
    plainFilepaths: string[],
    strickCheck: boolean,
  ): Promise<IDraftCatalogDiffItem[]>

  /**
   * Clear the catalog items and init with the new given items.
   */
  reset(items?: Iterable<ICatalogItem>): void
}
