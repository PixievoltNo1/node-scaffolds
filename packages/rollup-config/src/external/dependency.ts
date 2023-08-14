import { resolve } from 'import-meta-resolve'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import builtinModules from './builtin-modules.json' assert { type: 'json' }

const builtinExternals: ReadonlyArray<string> = builtinModules.concat(['glob', 'sync'])
export const builtinExternalSet: ReadonlySet<string> = new Set<string>(builtinExternals)

export type IDependencyField = 'dependencies' | 'optionalDependencies' | 'peerDependencies'

/**
 * Default Dependency fields
 */
export function getDefaultDependencyFields(): IDependencyField[] {
  return ['dependencies', 'optionalDependencies', 'peerDependencies']
}

/**
 * Collect all dependencies declared in the package.json and the dependency's dependencies and so on.
 *
 * @param packageJsonPath
 * @param dependenciesFields (such as ['dependencies', 'devDependencies'])
 * @param additionalDependencies
 * @param isAbsentAllowed
 * @returns
 */
export async function collectAllDependencies(
  packageJsonPath: string | null,
  dependenciesFields: ReadonlyArray<IDependencyField> = getDefaultDependencyFields(),
  additionalDependencies: ReadonlyArray<string> | null = null,
  isAbsentAllowed: ((moduleName: string) => boolean) | null = null,
): Promise<string[]> {
  const dependencySet: Set<string> = new Set<string>()

  if (isAbsentAllowed == null) {
    const regex = /^@types\//
    // eslint-disable-next-line no-param-reassign
    isAbsentAllowed = moduleName => regex.test(moduleName)
  }

  // collect from package.json
  if (packageJsonPath != null) {
    await collectDependencies(packageJsonPath)
  }

  // collect from dependencies
  if (additionalDependencies != null) {
    for (const dependency of additionalDependencies) {
      await followDependency(dependency)
    }
  }

  return Array.from(dependencySet).sort()

  async function followDependency(dependency: string): Promise<void> {
    if (builtinExternalSet.has(dependency) || dependencySet.has(dependency)) return
    dependencySet.add(dependency)

    // recursively collect
    let nextPackageJsonPath = null
    try {
      const dependencyUrl: string = resolve(dependency, import.meta.url)
      const dependencyPath: string = url.fileURLToPath(dependencyUrl)
      nextPackageJsonPath = locateNearestFilepath(dependencyPath, 'package.json')
    } catch (e: any) {
      switch (e.code) {
        case 'ERR_MODULE_NOT_FOUND':
          if (isAbsentAllowed!(dependency)) return
          break
        case 'ERR_PACKAGE_PATH_NOT_EXPORTED':
          return
        default:
          console.error(e)
          return
      }
    }

    if (nextPackageJsonPath == null) {
      console.warn(`cannot find package.json for '${dependency}'`)
      return
    }

    await collectDependencies(nextPackageJsonPath)
  }

  async function collectDependencies(dependencyPackageJsonPath: string): Promise<void> {
    if (!existsSync(dependencyPackageJsonPath)) {
      console.warn(`no such file or directory: ${dependencyPackageJsonPath}`)
      return
    }

    const content = readFileSync(dependencyPackageJsonPath, 'utf8')
    const manifest = JSON.parse(content)
    for (const fieldName of dependenciesFields) {
      const field = manifest[fieldName]
      if (field != null) {
        for (const dependency of Object.keys(field)) {
          await followDependency(dependency)
        }
      }
    }
  }
}

function locateNearestFilepath(currentDir0: string, filenames: string | string[]): string | null {
  // eslint-disable-next-line no-param-reassign
  filenames = [filenames].flat()
  return recursiveLocate(currentDir0.replace(/^file:\/\//, ''))

  function recursiveLocate(currentDir: string): string | null {
    for (const filename of filenames) {
      const filepath = path.join(currentDir, filename)
      if (existsSync(filepath)) return filepath
    }

    const parentDir = path.dirname(currentDir)
    if (parentDir === currentDir || !path.isAbsolute(parentDir)) return null

    // Recursively locate.
    return locateNearestFilepath(parentDir, filenames)
  }
}
