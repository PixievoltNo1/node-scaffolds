import { bytes2text } from '@guanghechen/byte'
import { FileCipher, calcCryptFilepath, calcCryptFilepaths } from '@guanghechen/helper-cipher-file'
import { hasGitInstalled } from '@guanghechen/helper-commander'
import { isGitRepo } from '@guanghechen/helper-git'
import invariant from '@guanghechen/invariant'
import { existsSync } from 'node:fs'
import { reporter } from '../../shared/core/reporter'
import { SecretMaster } from '../../shared/SecretMaster'
import { loadGitCipherContext } from '../../shared/util/context/loadGitCipherContext'
import type { IGitCipherCatContext } from './context'

export class GitCipherCatProcessor {
  protected readonly context: IGitCipherCatContext
  protected readonly secretMaster: SecretMaster

  constructor(context: IGitCipherCatContext) {
    reporter.debug('context:', context)

    this.context = context
    this.secretMaster = new SecretMaster({
      showAsterisk: context.showAsterisk,
      maxRetryTimes: context.maxRetryTimes,
      minPasswordLength: context.minPasswordLength,
      maxPasswordLength: context.maxPasswordLength,
    })
  }

  public async cat(): Promise<void> {
    const title = 'processor.cat'
    invariant(hasGitInstalled(), `[${title}] Cannot find git, have you installed it?`)

    const { context } = this
    const { cryptPathResolver, plainPathResolver } = context

    invariant(
      existsSync(cryptPathResolver.root),
      `[${title}] Cannot find cryptRootDir. ${cryptPathResolver.root}`,
    )
    invariant(
      isGitRepo(cryptPathResolver.root),
      `[${title}] cryptRootDir is not a git repo. ${cryptPathResolver.root}`,
    )

    const { cipherFactory, context: gitCipherContext } = await loadGitCipherContext({
      secretFilepath: context.secretFilepath,
      secretMaster: this.secretMaster,
      cryptPathResolver,
      plainPathResolver,
    })

    const { catalogContext, configKeeper, getIv } = gitCipherContext
    await configKeeper.load()

    // Print catalog config.
    if (!context.plainFilepath) {
      console.log(
        JSON.stringify(
          configKeeper.data,
          (key, value) => {
            if (key === 'authTag') {
              if (value?.type === 'Buffer') return Buffer.from(value).toString('hex')
              if (value instanceof Uint8Array) return bytes2text(value, 'hex')
            }
            return value
          },
          2,
        ),
      )
      return
    }

    // Print plain file content.
    const plainFilepath = plainPathResolver.relative(context.plainFilepath)
    const item = configKeeper.data?.catalog.items.find(item => item.plainFilepath === plainFilepath)
    invariant(!!item, `[${title}] Cannot find plainFilepath ${context.plainFilepath}.`)

    const cryptFilepath: string = calcCryptFilepath(
      plainPathResolver.relative(plainFilepath),
      catalogContext,
    )
    const cryptFilepaths: string[] = calcCryptFilepaths(
      cryptPathResolver.resolve(cryptFilepath),
      item.cryptFilepathParts,
    )
    const fileCipher = new FileCipher({
      cipher: cipherFactory.cipher({ iv: getIv(item) }),
      reporter,
    })
    const plainContentBuffer: Uint8Array = await fileCipher.decryptFromFiles(cryptFilepaths, {
      authTag: item.authTag,
    })
    const plainContent: string = bytes2text(plainContentBuffer, 'utf8')
    console.log(plainContent)
  }
}
