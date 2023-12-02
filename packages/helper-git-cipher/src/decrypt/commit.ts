import { FileChangeType, type ICatalogDiffItem } from '@guanghechen/cipher-workspace.types'
import { collectAffectedPlainFilepaths } from '@guanghechen/helper-cipher-file'
import type {
  IGitCommandBaseParams,
  IGitCommitDagNode,
  IGitCommitInfo,
} from '@guanghechen/helper-git'
import {
  checkBranch,
  cleanUntrackedFilepaths,
  commitAll,
  getParentCommitIdList,
  mergeCommits,
  showCommitInfo,
} from '@guanghechen/helper-git'
import invariant from '@guanghechen/invariant'
import type { IGitCipherContext } from '../types'
import { getPlainCommitId } from '../util'

export interface IDecryptGitCommitParams {
  context: IGitCipherContext
  cryptCommitNode: IGitCommitDagNode
  crypt2plainIdMap: Map<string, string>
}

/**
 * Decrypt git commit.
 *
 * !!!Requirement (this method is not recommend to use directly)
 *  - Both the plain repo (could be empty) and crypt repo should be clean (no untracked files).
 *
 * @param params
 */
export async function decryptGitCommit(params: IDecryptGitCommitParams): Promise<void> {
  const title = 'decryptGitCommit'
  const { context, cryptCommitNode, crypt2plainIdMap } = params
  const { catalog, cipherBatcher, configKeeper, reporter } = context
  const { cryptPathResolver, plainPathResolver } = catalog.context
  const plainCmdCtx: IGitCommandBaseParams = { cwd: plainPathResolver.root, reporter }
  const cryptCmdCtx: IGitCommandBaseParams = { cwd: cryptPathResolver.root, reporter }

  // [crypt] Move the HEAD pointer to the current decrypting commit.
  await checkBranch({ ...cryptCmdCtx, commitHash: cryptCommitNode.id })
  const signature: IGitCommitInfo = await showCommitInfo({
    ...cryptCmdCtx,
    commitHash: cryptCommitNode.id,
  })

  // Load the diffItems between the <first parent>...<current>.
  await configKeeper.load()
  const configData = configKeeper.data
  invariant(!!configData, `[${title}] cannot load config. cryptCommitId(${cryptCommitNode.id})`)

  // [plain] Move the HEAD pointer to the first parent commit for creating commit or merging.
  const { message } = configData.commit
  const cryptParentIds: string[] = await getParentCommitIdList({
    ...cryptCmdCtx,
    commitHash: cryptCommitNode.id,
  })
  const plainParents = cryptParentIds.map(cid => getPlainCommitId(cid, crypt2plainIdMap))

  if (plainParents.length > 0) {
    await checkBranch({ ...plainCmdCtx, commitHash: plainParents[0] })
  }

  let shouldAmend = false
  if (plainParents.length > 1) {
    await mergeCommits({
      ...plainCmdCtx,
      ...signature,
      message,
      parentIds: plainParents,
      strategy: 'ours',
    })
    shouldAmend = true
  }

  // [pain] Clean untracked filepaths to avoid unexpected errors.
  const diffItems: ICatalogDiffItem[] = await Promise.all(
    configData.catalog.diffItems.map(async (diffItem): Promise<ICatalogDiffItem> => {
      switch (diffItem.changeType) {
        case FileChangeType.ADDED:
          return {
            changeType: FileChangeType.ADDED,
            newItem: await context.catalog.flatItem(diffItem.newItem),
          }
        case FileChangeType.MODIFIED:
          return {
            changeType: FileChangeType.MODIFIED,
            oldItem: await context.catalog.flatItem(diffItem.oldItem),
            newItem: await context.catalog.flatItem(diffItem.newItem),
          }
        case FileChangeType.REMOVED:
          return {
            changeType: FileChangeType.REMOVED,
            oldItem: await context.catalog.flatItem(diffItem.oldItem),
          }
        /* c8 ignore start */
        default:
          throw new Error(`[${title}] unexpected changeType. ${diffItem['changeType']}`)
        /* c8 ignore end */
      }
    }),
  )
  const affectedPlainFiles: string[] = collectAffectedPlainFilepaths(diffItems)
  await cleanUntrackedFilepaths({ ...plainCmdCtx, filepaths: affectedPlainFiles })

  // Decrypt files.
  await cipherBatcher.batchDecrypt({ catalog, diffItems, strictCheck: false })
  await commitAll({ ...plainCmdCtx, ...signature, message, amend: shouldAmend })
}
