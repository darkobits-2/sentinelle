#!/usr/bin/env node

import adeiu from '@darkobits/adeiu';
import yargs from 'yargs';

import {Arguments} from 'etc/types';
import SentinelleFactory from 'lib/sentinelle';
import log from 'lib/log';
import {getPackageVersion} from 'lib/utils';


/**
 * Initializer for shutdown handlers.
 */
const initAdeiu = (sent: ReturnType<typeof SentinelleFactory>) => adeiu(async signal => {
  log.info('', log.chalk.bold(`Got signal ${signal}; shutting-down.`));

  // Register a second handler on the same signal we just received that
  // will force-kill the process. This way, if a process is still within
  // the grace period when the user issues a second SIGINT, for example,
  // we just kill the process immediately and exit.
  const secondaryHandler = async () => {
    await sent.stop('SIGKILL');

    // Un-register this handler to prevent recursion.
    process.off(signal, secondaryHandler);

    // Kill the process with the same signal we received.
    process.kill(process.pid, signal);
  };

  process.prependListener(signal, secondaryHandler);

  await sent.stop();
});


// ----- Command: Default ------------------------------------------------------

yargs.command({
  command: '* <entrypoint>',
  builder: command => {
    command.usage('Run a process, watch for file changes, and re-start the process.');

    command.positional('entrypoint', {
      description: 'Entrypoint to the script/application to run.',
      type: 'string',
      required: true
    });

    command.option('bin', {
      description: 'Optional binary (and any arguments to pass to it) to use to execute the entry file.',
      type: 'string',
      required: false
    });

    command.option('watch', {
      description: 'Directory to watch for file changes. Defaults to the directory of the entry file.',
      type: 'string',
      coerce: arg => Array.isArray(arg) ? arg : [arg],
      required: false
    });

    command.option('kill', {
      description: 'POSIX signal to send to the process when we need it to shut-down.',
      type: 'string',
      required: false
    });

    command.option('quiet', {
      description: 'Suppress all logging except errors and warnings.',
      type: 'boolean',
      default: false,
      required: false
    });

    command.example('$0 src/main.js', 'Execute "src/main.js" using Node, watch "src", and re-run when files change.');
    command.example('$0 --watch /some/dir --bin python /my/script.py', 'Execute "/my/script.py" using Python, watch "/some/dir", and re-run when files change.');

    return command;
  },
  handler: async (args: Arguments) => {
    try {
      const {entrypoint: entry, bin, watch, kill: processShutdownSignal, quiet} = args;

      if (quiet) {
        log.level = 'warn';
      }

      // Create a Sentinelle instance.
      const sentinelle = SentinelleFactory({bin, entry, watch, processShutdownSignal});

      // Setup signal handler.
      initAdeiu(sentinelle);

      // Log current version for debugging.
      if (['verbose', 'silly'].includes(log.level)) {
        const version = await getPackageVersion();
        log.verbose('version', log.chalk.green.bold(version));
      }

      // Start Sentinelle.
      await sentinelle.start();
    } catch (err) {
      log.error('', err.message);
      log.verbose('', err.stack.split('\n').slice(1).join('\n'));
      process.exit(1);
    }
  }
});


yargs.showHelpOnFail(true, 'See --help for usage instructions.');
yargs.wrap(yargs.terminalWidth());
yargs.alias('v', 'version');
yargs.alias('h', 'help');
yargs.version();
yargs.strict();
yargs.help();


// Parse command-line arguments, bail on --help, --version, etc.
export default yargs.argv;
