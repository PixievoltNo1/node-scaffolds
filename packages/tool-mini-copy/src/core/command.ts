import type { Command } from '@guanghechen/commander-helper'
import { createTopCommand } from '@guanghechen/commander-helper'
import { COMMAND_NAME, packageVersion } from '../env/constant'

/**
 * Create a top commander instance with default global options
 */
export function createProgram(): Command {
  const program = createTopCommand(COMMAND_NAME, packageVersion)

  // Global command options
  program
    .argument('[source content]')
    .option('-e, --encoding <encoding>', 'Encoding of content from stdin or file.')
    .option('-i, --input <filepath>', 'copy the data from the <filepath> to the system clipboard.')
    .option('-o, --output <filepath>', 'output the data from the system clipboard into <filepath>.')
    .option('-f, --force', 'overwrite the <filepath> without confirmation.')
    .option('-s, --silence', "don't print info-level log.")
    .option(
      '--force',
      'force paste the content of the system clipboard without copy even piped data.',
    )
    .option('--fake-clipboard [local filepath]', 'Specified the fake clipboard location.')

  return program
}