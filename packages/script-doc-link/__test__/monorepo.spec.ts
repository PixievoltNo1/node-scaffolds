import { isFileSync } from '@guanghechen/helper-fs'
import { workspaceRootDir } from 'jest.helper'
import path from 'node:path'
import { MonorepoContext, MonorepoDocLinkRewriter, MonorepoDocScanner } from '../src'

describe('context', () => {
  let context: MonorepoContext
  beforeAll(async () => {
    context = await MonorepoContext.scanAndBuild(workspaceRootDir)
  })

  it('basic', async () => {
    // Verify that the context object was created with the correct properties
    expect(context.username).toEqual('guanghechen')
    expect(context.repository).toEqual('node-scaffolds')
    expect(context.rootDir).toEqual(workspaceRootDir)
    expect(context.isVersionIndependent).toEqual(true)
    expect(context.packagePaths).toMatchInlineSnapshot(`
      [
        "packages/chalk-logger",
        "packages/conventional-changelog",
        "packages/eslint-config",
        "packages/eslint-config-jsx",
        "packages/eslint-config-ts",
        "packages/event-bus",
        "packages/helper-buffer",
        "packages/helper-cipher",
        "packages/helper-cipher-file",
        "packages/helper-commander",
        "packages/helper-config",
        "packages/helper-file",
        "packages/helper-fs",
        "packages/helper-func",
        "packages/helper-git",
        "packages/helper-git-cipher",
        "packages/helper-is",
        "packages/helper-jest",
        "packages/helper-mac",
        "packages/helper-npm",
        "packages/helper-option",
        "packages/helper-path",
        "packages/helper-plop",
        "packages/helper-storage",
        "packages/helper-stream",
        "packages/helper-string",
        "packages/invariant",
        "packages/jest-config",
        "packages/mini-copy",
        "packages/observable",
        "packages/postcss-modules-dts",
        "packages/rollup-config",
        "packages/rollup-config-cli",
        "packages/rollup-plugin-copy",
        "packages/script-doc-link",
        "packages/tool-file",
        "packages/tool-git-cipher",
        "packages/tool-mini-copy",
        "packages/utility-types",
      ]
    `)
  })

  it('scanner', async () => {
    const scanner = new MonorepoDocScanner({ context })
    const filepaths: string[] = await scanner.scan()
    expect(filepaths.length > 0).toEqual(true)
    expect(filepaths.every(filepath => path.isAbsolute(filepath) && isFileSync(filepath))).toEqual(
      true,
    )
  })
})

describe('rewriter', () => {
  it('independent version', async () => {
    const context = new MonorepoContext({
      rootDir: workspaceRootDir,
      username: 'guanghechen',
      repository: 'node-scaffolds',
      packagePathMap: new Map()
        .set('packages/script-doc-link', {
          name: '@guanghechen/script-doc-link',
          version: '2.0.0',
          private: 'false',
        })
        .set('packages/chalk-logger', {
          name: '@guanghechen/chalk-logger',
          version: '4.2.3',
          private: 'false',
        }),
      isVersionIndependent: true,
    })
    const rewriter = new MonorepoDocLinkRewriter({ context })

    expect(
      rewriter.rewrite(
        'https://github.com/guanghechen/node-scaffolds/tree/release-5.x.x/packages/script-doc-link#readme' +
          '\n' +
          'https://github.com/guanghechen/node-scaffolds/tree/release-5.x.x/packages/fake-script-doc-link#readme',
      ),
    ).toMatchInlineSnapshot(`
      "https://github.com/guanghechen/node-scaffolds/tree/@guanghechen/script-doc-link@2.0.0/packages/script-doc-link#readme
      https://github.com/guanghechen/node-scaffolds/tree/release-5.x.x/packages/fake-script-doc-link#readme"
    `)

    expect(
      rewriter.rewrite(
        '[demo1.1.png]: https://raw.githubusercontent.com/guanghechen/node-scaffolds/release-5.x.x/packages/chalk-logger/screenshots/demo1.1.png' +
          '\n' +
          'https://raw.githubusercontent.com/guanghechen/node-scaffolds/release-5.x.x/packages/fake-chalk-logger/screenshots/demo1.1.png',
      ),
    ).toMatchInlineSnapshot(`
      "[demo1.1.png]: https://raw.githubusercontent.com/guanghechen/node-scaffolds/@guanghechen/chalk-logger@4.2.3/packages/chalk-logger/screenshots/demo1.1.png
      https://raw.githubusercontent.com/guanghechen/node-scaffolds/release-5.x.x/packages/fake-chalk-logger/screenshots/demo1.1.png"
    `)
  })

  it('same version context', async () => {
    const context = new MonorepoContext({
      rootDir: workspaceRootDir,
      username: 'guanghechen',
      repository: 'node-scaffolds',
      packagePathMap: new Map()
        .set('packages/script-doc-link', {
          name: '@guanghechen/script-doc-link',
          version: '2.0.0',
          private: 'false',
        })
        .set('packages/chalk-logger', {
          name: '@guanghechen/chalk-logger',
          version: '2.0.0',
          private: 'false',
        }),
      isVersionIndependent: false,
    })
    const rewriter = new MonorepoDocLinkRewriter({ context })

    expect(
      rewriter.rewrite(
        'https://github.com/guanghechen/node-scaffolds/tree/release-5.x.x/packages/script-doc-link#readme' +
          '\n' +
          'https://github.com/guanghechen/node-scaffolds/tree/release-5.x.x/packages/fake-script-doc-link#readme',
      ),
    ).toMatchInlineSnapshot(`
      "https://github.com/guanghechen/node-scaffolds/tree/v2.0.0/packages/script-doc-link#readme
      https://github.com/guanghechen/node-scaffolds/tree/release-5.x.x/packages/fake-script-doc-link#readme"
    `)

    expect(
      rewriter.rewrite(
        '[demo1.1.png]: https://raw.githubusercontent.com/guanghechen/node-scaffolds/release-5.x.x/packages/chalk-logger/screenshots/demo1.1.png' +
          '\n' +
          'https://raw.githubusercontent.com/guanghechen/node-scaffolds/release-5.x.x/packages/fake-chalk-logger/screenshots/demo1.1.png',
      ),
    ).toMatchInlineSnapshot(`
      "[demo1.1.png]: https://raw.githubusercontent.com/guanghechen/node-scaffolds/v2.0.0/packages/chalk-logger/screenshots/demo1.1.png
      https://raw.githubusercontent.com/guanghechen/node-scaffolds/release-5.x.x/packages/fake-chalk-logger/screenshots/demo1.1.png"
    `)
  })
})