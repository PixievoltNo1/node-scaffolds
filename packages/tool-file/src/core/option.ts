import type {
  ICommandConfigurationFlatOpts,
  ICommandConfigurationOptions,
  IResolveDefaultOptionsParams,
} from '@guanghechen/helper-commander'
import { resolveCommandConfigurationOptions } from '@guanghechen/helper-commander'
import { isNonBlankString } from '@guanghechen/helper-is'
import { cover, coverString } from '@guanghechen/helper-option'
import { reporter } from '../env/reporter'

// Global command options
export interface IGlobalCommandOptions extends ICommandConfigurationOptions {
  readonly output: string | undefined
  readonly partCodePrefix: string
}

// Default value of global options
export const getDefaultGlobalCommandOptions = (
  _params: IResolveDefaultOptionsParams,
): IGlobalCommandOptions => ({
  logLevel: reporter.level,
  partCodePrefix: '.ghc-part',
  output: undefined,
})

export function resolveBaseCommandOptions<O extends object>(
  commandName: string,
  subCommandName: string | false,
  getDefaultOptions: (params: IResolveDefaultOptionsParams) => O,
  options: O & IGlobalCommandOptions,
): O & IGlobalCommandOptions & ICommandConfigurationFlatOpts {
  type R = O & IGlobalCommandOptions & ICommandConfigurationFlatOpts
  const baseOptions: R = resolveCommandConfigurationOptions<O & IGlobalCommandOptions>({
    reporter,
    commandName,
    subCommandName,
    workspace: undefined,
    defaultOptions: params => ({
      ...getDefaultGlobalCommandOptions(params),
      ...getDefaultOptions(params),
    }),
    options,
  })

  // Resolve output.
  const output: string | undefined = cover<string | undefined>(
    baseOptions.output,
    options.output,
    isNonBlankString,
  )
  reporter.debug('output:', output)

  // Resolve partCodePrefix.
  const partCodePrefix: string = coverString(
    baseOptions.partCodePrefix,
    options.partCodePrefix,
    isNonBlankString,
  )
  reporter.debug('partCodePrefix:', partCodePrefix)

  const resolvedOptions: IGlobalCommandOptions = {
    output,
    partCodePrefix,
  }
  return { ...baseOptions, ...resolvedOptions }
}
