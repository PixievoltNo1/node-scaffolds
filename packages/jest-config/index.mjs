import fs from 'node:fs'
import path from 'node:path'

/**
 * Calculate moduleNameMapper from tsconfig.compilerOptions.paths
 * @param {string} rootDir
 * @param {string|undefined} tsconfigFilename
 * @returns {Promise<Record<string, string | string[]>>}
 */
export async function resolveModuleNameMapper(rootDir, tsconfigFilename = 'tsconfig.json') {
  const tsconfigFilepath = path.resolve(rootDir, tsconfigFilename)
  if (!fs.existsSync(tsconfigFilepath)) return {}

  const { default: tsconfig } = await import(tsconfigFilepath, { assert: { type: 'json' } })
  if (tsconfig.compilerOptions == null || tsconfig.compilerOptions.paths == null) {
    return {}
  }

  const mapper = {}
  const pathAlias = Object.entries(tsconfig.compilerOptions.paths)
  for (const [moduleName, modulePaths] of pathAlias) {
    const paths = modulePaths.map(p => {
      let index = 0
      const filepath = path.join(rootDir, p)
      return filepath.replace(/[*]+/g, () => {
        index += 1
        return '$' + index
      })
    })
    let pattern =
      '^' + moduleName.replace(/[-\\^$+?.()|[\]{}]/g, '\\$&').replace(/[*]/g, '(.+)') + '$'
    mapper[pattern] = paths.length === 1 ? paths[0] : paths
  }
  return mapper
}

/**
 * Create basic jest config
 * @param {string} repositoryRootDir
 * @param {{
 *   useESM?: boolean
 * }}
 */
export async function tsMonorepoConfig(repositoryRootDir, options = {}) {
  const moduleNameMapper = {
    ...(await resolveModuleNameMapper(repositoryRootDir)),
    ...(await resolveModuleNameMapper(path.resolve())),
  }

  return {
    bail: true,
    verbose: true,
    errorOnDeprecated: true,
    roots: ['src', '__test__'].filter(p => fs.existsSync(p)).map(p => `<rootDir>/${p}`),
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'mts', 'mjs', 'cts', 'cjs', 'node'],
    moduleNameMapper,
    transform: {
      '^.+\\.[cm]?tsx?$': [
        'ts-jest',
        {
          tsconfig: '<rootDir>/tsconfig.json',
          useESM: options?.useESM,
        },
      ],
    },
    testEnvironment: 'node',
    testEnvironmentOptions: {
      url: 'http://localhost/',
    },
    testRegex: '/(__test__)/[^/]+\\.spec\\.[cm]?[jt]sx?$',
    testPathIgnorePatterns: ['/coverage/', '/lib/', '/node_modules/'],
    collectCoverage: false,
    collectCoverageFrom: [
      '<rootDir>/cli.js',
      '<rootDir>/index.js',
      '<rootDir>/src/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
      '<rootDir>/src/**/*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}',
    ],
    coverageDirectory: '<rootDir>/coverage/',
    coveragePathIgnorePatterns: [],
    coverageProvider: 'v8',
    coverageThreshold: {
      global: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    coverageReporters: ['text', 'text-summary'],
  }
}