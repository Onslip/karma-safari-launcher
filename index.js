var wd = require('wd');
var http = require('http');
var url = require('url');

/**
 * Use `async`/`await` to provide a `sleep` capability.
 *
 * @see https://stackoverflow.com/a/39914235/247730
 * @param {number} ms The time, in milliseconds, to block the event queue.
 * @returns {Promise} A promise to be resolved when the timeout finishes.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

var SafariBrowser = function(baseBrowserDecorator, args, logger) {
  baseBrowserDecorator(this);

  var config = Object.assign({
    protocol: 'http:',
    hostname: '127.0.0.1',
    port: 4444,
    pathname: '/'
  }, args.config);

  var webDriver = url.format(config);
  this.name = 'Safari via WebDriver at ' + webDriver;
  var log = logger.create(this.name);

  this.driver = wd.promiseChainRemote(config);

  this.driver.on('status', (info) => {
    log.debug(info);
  });

  this.driver.on('command', (eventType, command, response) => {
    log.debug(`${eventType} ${command} ${response || ''}`);
  });

  this.driver.on('http', (meth, path, data) => {
    log.debug(`${meth} ${path} ${data || ''}`);
  });

  this._getOptions = function() {
    return [
      "-p", config.port.toString()
    ];
  }

  /**
   * This launcher works by checking to see if there is a `/usr/bin/safaridriver` instance running.
   * It is determined to be running if the web driver API can be reached on the configured host and port.
   * If it is then it it launches the Karma test runner in a new session. If it is not, it then attempts
   * to start its own new instance of `/usr/bin/safaridriver` and then connect the Karma test runner in
   * a new session.
   *
   * @param {string} url The URL that the Karma server is listening on.
   */
  this._start = function(url) {
    var self = this;

    var attempts = 0;
    // TODO: It would be nice if this was configurable
    const MAX_ATTEMPTS = 3;
    async function attachKarma(error) {
      attempts += 1;
      if (error && attempts === 1) {
        log.debug(`attachKarma ${attempts} of ${MAX_ATTEMPTS}`);
        log.debug(`${self._getCommand()} is not running.`);
        log.debug(`Attempting to start ${self._getCommand()} ${self._getOptions(url).join(' ')}`);
        self._execCommand(self._getCommand(), self._getOptions(url));
        self.browser = self.driver.init({}, attachKarma);
      } else if (error && attempts <= MAX_ATTEMPTS) {
        log.debug(`attachKarma ${attempts} of ${MAX_ATTEMPTS}`);
        // TODO: It would be nice if this was configurable
        const sleepDuration = 4000;
        log.debug(`Going to give the driver time to start-up. Sleeping for ${sleepDuration}ms.`);
        await sleep(sleepDuration);
        self.browser = self.driver.init({}, attachKarma);
      } else if (error) {
        log.error('Could not connect to Safari.');
      } else {
        log.debug('Connected to Safari WebDriver');
        log.debug(`Connecting to ${url}`);
        self.browser.get(url).done();
      }
    }

    self.browser = self.driver.init({}, attachKarma);
  };

  this.on('kill', (done) => {
    if (this.browser) {
      this.browser.quit(() => done());
    }
  });
};

SafariBrowser.prototype = {
  name: 'Safari',

  DEFAULT_CMD: {
    darwin: '/usr/bin/safaridriver'
  },
  ENV_CMD: 'SAFARI_BIN'
};

SafariBrowser.$inject = ['baseBrowserDecorator', 'args', 'logger'];


// PUBLISH DI MODULE
module.exports = {
  'launcher:Safari': ['type', SafariBrowser]
};
