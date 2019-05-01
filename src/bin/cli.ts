#!/usr/bin/env node

import adeiu from '@darkobits/adeiu';
import yargs from 'yargs';

import {Arguments} from 'etc/types';
import SentinelleFactory from 'lib/sentinelle';
import log from 'lib/log';
import {getPackageVersion} from 'lib/utils';


yargs.usage('Run a process, watch for file changes, and re-start the process.');

yargs.example('$0 src/main.js', 'Execute "src/main.js" using Node, watch "src", and re-run when files change.');

yargs.example('$0 --watch /some/dir --exec python /my/script.py', 'Execute "/my/script.py" using Python, watch "/some/dir", and re-run when files change.');

yargs.option('bin', {
  description: 'Binary to use to execute the entry file.',
  default: 'node',
  type: 'string',
  required: false
});

yargs.option('watch', {
  description: 'Directory to watch for file changes. Defaults to the directory of the entry file.',
  type: 'string',
  coerce: arg => Array.isArray(arg) ? arg : [arg],
  required: false
});

yargs.option('kill', {
  description: 'POSIX signal to send to the process when we need it to shut-down.',
  type: 'string',
  required: false
});

yargs.option('quiet', {
  description: 'Suppress all logging except errors and warnings.',
  type: 'boolean',
  default: false,
  required: false
});

yargs.showHelpOnFail(true, 'See --help for usage instructions.');
yargs.wrap(yargs.terminalWidth());
yargs.version();
yargs.strict();
yargs.help();


/**
 * Creates a new Nodemeng that starts a node process based on the provided
 * command-line arguments.
 */
async function main() {
  try {
    // Parse command-line arguments, bail on --help, --version, etc.
    const {_, bin, watch, kill, quiet} = yargs.argv as Arguments;
    const [entryExpression, ...extraArgs] = _;
    const [entry, ...entryArgs] = entryExpression.split(' ');
    const sent = SentinelleFactory({bin, entry, entryArgs, extraArgs, watch, processShutdownSignal: kill});

    if (quiet) {
      log.level = 'warn';
    }

    adeiu(async signal => {
      log.info('', log.chalk.bold(`Got signal ${signal}.`));
      await sent.stop();
    });

    const version = await getPackageVersion();

    log.verbose('version', log.chalk.green.bold(version));

    await sent.start();
  } catch (err) {
    log.error('', err.message);
    log.verbose('', err.stack.split('\n').slice(1).join('\n'));
    process.exit(1);
  }
}


export default main();
