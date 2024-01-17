import { bytes2text, randomBytes } from '@guanghechen/byte'
import { hasGitInstalled } from '@guanghechen/helper-commander'
import { isNonExistentOrEmpty, mkdirsIfNotExists } from '@guanghechen/helper-fs'
import { initGitRepo, stageAll } from '@guanghechen/helper-git'
import { isNonBlankString } from '@guanghechen/helper-is'
import { runPlop } from '@guanghechen/helper-plop'
import invariant from '@guanghechen/invariant'
import { pathResolver } from '@guanghechen/path'
import { retrieveLevelName } from '@guanghechen/reporter'
import { existsSync } from 'node:fs'
import { resolveBoilerplateFilepath } from '../../shared/config'
import { COMMAND_VERSION } from '../../shared/core/constant'
import type { SecretConfigKeeper } from '../../shared/SecretConfig'
import type { IPresetSecretConfig } from '../../shared/SecretConfig.types'
import type { IGitCipherSubCommandProcessor } from '../_base'
import { GitCipherSubCommandProcessor } from '../_base'
import type { IGitCipherInitContext } from './context'
import type { IGitCipherInitOptions } from './option'

type O = IGitCipherInitOptions
type C = IGitCipherInitContext

const clazz = 'GitCipherInit'

export class GitCipherInit
  extends GitCipherSubCommandProcessor<O, C>
  implements IGitCipherSubCommandProcessor<O, C>
{
  public override async process(): Promise<void> {
    const title = `${clazz}.process`
    invariant(
      hasGitInstalled(),
      `[${title}] Cannot find 'git', please install it before continuing.`,
    )

    const { context, reporter } = this
    const { plainPathResolver } = context
    const presetSecretData: IPresetSecretConfig = {
      catalogConfigPath: context.catalogConfigPath,
      contentHashAlgorithm: context.contentHashAlgorithm,
      cryptPathSalt: context.cryptPathSalt,
      cryptFilesDir: context.cryptFilesDir,
      integrityPatterns: context.integrityPatterns,
      keepPlainPatterns: context.keepPlainPatterns,
      mainIvSize: context.mainIvSize,
      mainKeySize: context.mainKeySize,
      maxCryptFileSize:
        context.maxCryptFileSize > Number.MAX_SAFE_INTEGER ? undefined : context.maxCryptFileSize,
      partCodePrefix: context.partCodePrefix,
      pathHashAlgorithm: context.pathHashAlgorithm,
      pbkdf2Options: context.pbkdf2Options,
      secretIvSize: context.secretIvSize,
      secretKeySize: context.secretKeySize,
    }

    const isWorkspaceEmpty = isNonExistentOrEmpty(context.workspace)
    mkdirsIfNotExists(context.workspace, true)
    mkdirsIfNotExists(plainPathResolver.root, true)

    if (isWorkspaceEmpty) {
      // Render boilerplates if the workspace is non-exist or empty.
      const relativeConfigPaths: string[] = context.configPaths.map(fp =>
        pathResolver.safeRelative(context.workspace, fp, true),
      )
      await this._renderBoilerplates({
        configPath: relativeConfigPaths.find(fp => fp.endsWith('.json')) ?? '.ghc-config.json',
      })

      // Init git repo.
      await initGitRepo({
        cwd: plainPathResolver.root,
        reporter,
        eol: 'lf',
        encoding: 'utf8',
        gpgSign: context.gitGpgSign,
      })
      await stageAll({ cwd: plainPathResolver.root, reporter })
    }

    const inquirer = await import('inquirer').then(md => md.default)

    let shouldGenerateSecret = true
    if (existsSync(context.secretConfigPath)) {
      // Regenerate secret.
      shouldGenerateSecret = await inquirer
        .prompt([
          {
            type: 'confirm',
            name: 'shouldGenerateNewSecret',
            default: false,
            message:
              'The repo seems initialized, do you want to generate new secret? (!!!WARNING this will invalid the existed crypt commits)',
          },
        ])
        .then(md => md.shouldGenerateNewSecret)
    }

    reporter.verbose('Creating secret.')
    if (shouldGenerateSecret) {
      const {
        cryptFilepathSalt,
        CRYPT_FILES_DIR,
        mainIvSize,
        mainKeySize,
        MAX_CRYPT_FILE_SIZE,
        pbkdf2Options_digest,
        pbkdf2Options_iterations,
        pbkdf2Options_salt,
        secretIvSize,
        secretKeySize,
      } = await inquirer.prompt([
        {
          type: 'number',
          name: 'mainKeySize',
          default: context.mainKeySize,
          message: 'mainKeySize',
        },
        {
          type: 'number',
          name: 'mainIvSize',
          default: context.mainIvSize,
          message: 'mainIvSize',
        },
        {
          type: 'number',
          name: 'secretKeySize',
          default: context.secretKeySize,
          message: 'secretKeySize',
        },
        {
          type: 'number',
          name: 'secretIvSize',
          default: context.secretIvSize,
          message: 'secretIvSize',
        },
        {
          type: 'string',
          name: 'pbkdf2Options_salt',
          default: context.pbkdf2Options.salt,
          message: 'pbkdf2Options.salt',
          filter: x => x.trim(),
          transformer: (x: string) => x.trim(),
        },
        {
          type: 'number',
          name: 'pbkdf2Options_iterations',
          default: context.pbkdf2Options.iterations,
          message: 'pbkdf2Options.iterations',
        },
        {
          type: 'list',
          name: 'pbkdf2Options_digest',
          default: context.pbkdf2Options.digest,
          message: 'pbkdf2Options.digest',
          choices: ['sha256'],
          filter: x => x.trim(),
          transformer: (x: string) => x.trim(),
        },
        {
          type: 'string',
          name: 'cryptFilepathSalt',
          default: context.cryptPathSalt,
          message: 'cryptFilepathSalt',
          filter: x => x.trim(),
          transformer: (x: string) => x.trim(),
        },
        {
          type: 'string',
          name: 'CRYPT_FILES_DIR',
          default: context.cryptFilesDir,
          message: 'CRYPT_FILES_DIR',
          filter: x => x.trim(),
          transformer: (x: string) => x.trim(),
        },
        {
          type: 'number',
          name: 'MAX_CRYPT_FILE_SIZE',
          default: context.maxCryptFileSize,
          message: 'MAX_CRYPT_FILE_SIZE (bytes)',
        },
      ])

      // Create secret file.
      await this._createSecret({
        ...presetSecretData,
        cryptPathSalt: cryptFilepathSalt,
        cryptFilesDir: CRYPT_FILES_DIR,
        mainIvSize,
        mainKeySize,
        maxCryptFileSize: MAX_CRYPT_FILE_SIZE,
        pbkdf2Options: {
          salt: pbkdf2Options_salt,
          iterations: pbkdf2Options_iterations,
          digest: pbkdf2Options_digest,
        },
        secretIvSize,
        secretKeySize,
      })
      reporter.info('Secret generated and stored.')
    }
  }

  // Render boilerplates.
  protected async _renderBoilerplates(data: { configPath: string }): Promise<void> {
    const { context, reporter } = this
    const { cryptPathResolver, plainPathResolver } = context

    // request repository url
    const inquirer = await import('inquirer').then(md => md.default)
    let { plainRepoUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'plainRepoUrl',
        message: 'Resource git repository url?',
        filter: x => x.trim(),
        transformer: (x: string) => x.trim(),
      },
    ])

    // resolve plainRepoUrl
    if (isNonBlankString(plainRepoUrl)) {
      if (/^[.]/.test(plainRepoUrl)) {
        plainRepoUrl = pathResolver.safeResolve(context.workspace, plainRepoUrl)
      }
    }
    reporter.debug('plainRepoUrl:', plainRepoUrl)

    // clone plaintext repository
    if (isNonBlankString(plainRepoUrl)) {
      await this._cloneFromRemote(plainRepoUrl)
    }

    const boilerplate = resolveBoilerplateFilepath('plop.mjs')
    if (!existsSync(boilerplate)) {
      reporter.error('Cannot find the plop.mjs.', { path: boilerplate })
      return
    }

    const nodePlop = await import('node-plop').then(md => md.default)
    const plop = await nodePlop(boilerplate, {
      force: false,
      destBasePath: context.workspace,
    })

    const error = await runPlop(plop, undefined, {
      bakPlainRootDir: pathResolver.safeRelative(context.workspace, plainPathResolver.root, true),
      commandVersion: COMMAND_VERSION,
      configPath: data.configPath,
      configNonce: bytes2text(randomBytes(20), 'hex'),
      cryptRootDir: pathResolver.safeRelative(context.workspace, cryptPathResolver.root, true),
      encoding: context.encoding,
      logLevel: retrieveLevelName(reporter.level),
      minPasswordLength: context.minPasswordLength,
      plainRootDir: pathResolver.safeRelative(context.workspace, plainPathResolver.root, true),
      secretConfigPath: pathResolver.safeRelative(
        context.workspace,
        context.secretConfigPath,
        true,
      ),
      showAsterisk: context.showAsterisk,
      workspace: context.workspace,
    })
    if (error) reporter.error(error)
  }

  // Create secret file
  protected async _createSecret(
    presetConfigData: IPresetSecretConfig,
  ): Promise<SecretConfigKeeper> {
    const { context, secretMaster } = this
    const configKeeper = await secretMaster.createSecret({
      cryptRootDir: context.cryptPathResolver.root,
      filepath: context.secretConfigPath,
      presetConfigData,
    })
    return configKeeper
  }

  /**
   * Clone from remote plaintext repository
   * @param plainRepoUrl  url of remote source repository
   */
  protected async _cloneFromRemote(plainRepoUrl: string): Promise<void> {
    const { context, reporter } = this
    const { plainPathResolver } = context
    mkdirsIfNotExists(plainPathResolver.root, true, reporter)

    const { execa } = await import('execa')
    await execa('git', ['clone', plainRepoUrl, plainPathResolver.root], {
      stdio: 'inherit',
      cwd: plainPathResolver.root,
    })
  }
}
