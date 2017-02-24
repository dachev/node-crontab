/**
 * Constants
 */
const COMMAND = 'crontab';

/**
 * @ignore
 */
var Spawn   = require('child_process').spawn;
var _       = require('underscore');
var CronJob = require('./CronJob');

/**
 * @class CronTab
 * A JavaScript representation of a user crontab. Each tab has zero or more cron jobs corresponding
 * to the individual lines in the cron syntax.
 *
 * Examples:
 *     new CronTab('bob', function(err, tab) {
 *         if (err) { console.log(err); process.exit(1); }
 *
 *         console.log("bob's tab: " + tab.render());
 *     });
 *
 *     new CronTab(function(err, tab) {
 *         if (err) { console.log(err); process.exit(1); }
 *
 *         console.log("current user's tab: " + tab.render());
 *     });
 *
 * @param {String} __username__
 * @param {Function} __callback__
 */
function CronTab(u, cb) {
  var self       = this;
  var user       = u || '';
  var root       = (process.getuid() == 0);
  var backup     = {lines:[], jobs:[]};
  var lines      = [];
  var jobs       = [];
  var pausedFlag = '#paused'

  load(cb);


  /**
   * Provides access to the jobs collection.
   *
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *
   *         var jobs = tab.jobs((command:'ls -l /', comment:'this should run every night'));
   *         for (var i = 0; i < jobs.length; i++) {
   *             console.log(jobs[i].render());
   *         }
   *     });
   *
   * @param {Object} __[options]__
   * @return {Array[CronJob]}
   */
  this.jobs = function(options) {
    if (!options) {
      return jobs.slice();
    }
    if (!options.command && !options.comment) {
      return jobs.slice();
    }

    var queries = _.keys(options);
    if (_.without(queries, 'comment', 'command').length > 0) {
      return [];
    }

    var results = [];
    for (var i = 0; i < jobs.length; i++) {
      var job   = jobs[i];
      var match = true;

      for (var j = 0; j < queries.length; j++) {
        var query = queries[j];

        if (!job[query]().match(options[query])) {
          match = false;
          break;
        }
      }

      if (match) {
        results.push(job);
      }
    }

    return results;
  }
  this.find = this.jobs;
  /**
   * Writes the crontab to the system. Saves all information.
   *
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *
   *         var jobs = tab.jobs({command:'ls -l /'});
   *         tab.remove(jobs);
   *
   *         tab.save(function(err, tab) {
   *             if (err) { console.log(err); process.exit(1); }
   *
   *             console.log('saved');
   *         });
   *     });
   *
   * @param {Function} __callback__
   */
  this.save = function(cb) {
    var stdout  = '';
    var stderr  = '';
    var args    = makeChildArgs('save');
    var command = makeChildCommand();
    var child   = Spawn(command, args);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', function(chunk) {
      stdout += chunk;
    });
    child.stderr.on('data', function(chunk) {
      stderr += chunk;
    });
    child.on('error', function (err) {
    });
    child.on('close', function (code) {
      if (code == 0) {
        cb && cb(null, self);
      }
      else {
        cb && cb({message:stderr}, self);
      }
    });

    child.stdin.write(this.render());
    child.stdin.end();
  }
  /**
   * Renders the object to a string as it would be written to the system.
   *
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *
   *         console.log(tab.render());
   *     });
   *
   * @return {String}
   */
  this.render = function() {
    var tokens = [];

    for (var i = 0; i < lines.length; i++) {
      var job = lines[i];

      if (job.isValid && !job.isValid()) {
        tokens.push('# ' + job.toString());
        continue;
      }

      tokens.push(job.toString());
    }

    return tokens.join('\n').trim() + '\n';
  }
  /**
   * Creates a new job with the specified command, comment and date.
   *
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *
   *         var future = Date.parse('2010/7/11');
   *
   *         tab.create('ls -l /');
   *         tab.create('ls -l /', 'just a silly example');
   *         tab.create('ls -l /', 'just a silly example', future);
   *     });
   *
   * @param {String} __command__
   * @param {String|Date} __[when]__
   * @param {String} __[comment]__
   * @return {CronJob|null}
   */
  this.create = function(command, when, comment) {
    if (when && !_.isString(when) && !_.isDate(when)) {
      return null;
    }

    command = (command || '').trim();
    comment = (comment || '').trim();

    var job = null;
    if (_.isString(when)) {
      job = makeJob(when + ' ' + command + ' #' + comment);
    }
    else {
      job = makeJob(null, command, comment);
    }

    if (job && _.isDate(when)) {
      job.minute().on(when.getMinutes());
      job.hour().on(when.getHours());
      job.dom().on(when.getDate());
      job.month().on(when.getMonth()+1);
    }

    if (job) {
      jobs.push(job);
      lines.push(job);
    }

    return job;
  }
  /**
   * Parses a raw crontab line and returns a CronJob object
   *
   * @param {String} __line__
   * @return {CronJob|null}
   */
  this.parse = function(line) {
    return makeJob(line);
  }
  /**
   * Removes the specified jobs from the crontab.
   *
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *
   *         var jobs = tab.jobs({command:'ls -l /'});
   *         tab.remove(jobs);
   *     });
   *
   * @param {String} __Array[CronJob]__
   */
  this.remove = function(jobs) {
    var didRemove = false;

    if (jobs instanceof CronJob) {
      jobs = [jobs];
    }
    else if (_.isArray(jobs)) {
      // do nothing, we do this because _.isObject([]) == true
    }
    else if (_.isObject(jobs)) {
      // jobs is actually search options
      jobs = this.jobs(jobs);
    }
    else {
      jobs = [];
    }

    for (var i = 0; i < jobs.length; i++) {
      didRemove = remove(jobs[i]);
    }

    truncateLines();

    return didRemove;
  }
  /**
   * Restores this crontab to its original state.
   *
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *
   *         var jobs = tab.jobs({command:'ls -l /'});
   *         tab.remove(jobs);
   *         tab.reset();
   *     });
   */
  this.reset = function() {
    lines = backup.lines.slice();
    jobs  = backup.jobs.slice();
  }

  /**
   * Returns all paused jobs
   * This uses the `#paused` flag to determine which comemnts are paused jobs
   *
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *
   *         var jobs = tab.pausedJobsjobs(;
   *     });
   *
   * @param {Object} __[options]__
   * @return {Array[CronJob]}
   */
  this.pausedJobs = function() {
    // This flag identifies 'paused' jobs in the crontab
    const pausedTokens = [];
    const pausedJobs = [];

    lines.forEach((line) => {
      if (typeof line === 'string') {
        let trimmed = line.substring(0, pausedFlag.length);
        if (trimmed === pausedFlag) {
          pausedTokens.push(
            line.slice(pausedFlag.length)
          );
        }
      }
    });

    if (pausedTokens.length === 0) {
      return [];
    }

    pausedTokens.forEach((token) => {
      const job = makeJob(token);
      if (job !== null && job.isValid()) {
        pausedJobs.push(job);
      }
    });

    return pausedJobs;
  }
  /**
   * Pause a job
   *
   * @param {CronJob}
   * @return {Boolean}
   */
  this.pauseJob = function(job) {
    if (!job.isValid()) {
      return false;
    }

    const command = job.command();
    const removeTask = remove(job);

    if (removeTask) {
      const pausedEntry = `${pausedFlag}${job.toString()}`;
      lines.push(pausedEntry);
      return true;
    }

    return false;
  }
  /**
   * Activate a job
   *
   * @param {CronJob}
   * @return {Boolean}
   */
  this.activateJob = function(job) {
    let targetIndex;
    lines.forEach((line, index) => {
      if (typeof line === 'string') {
        const trimmed = line.substring(0, pausedFlag.length);
        const command = line.slice(pausedFlag.length);
        // Is this a paused job and does it match
        if (trimmed === pausedFlag && command === job.toString()) {
          targetIndex = index;
        }
      }
    });

    // Remove the paused job by index
    lines.splice(targetIndex, 1);
    const activeJob = makeJob(job.toString());
    if (activeJob && activeJob.isValid()) {
      // Re-add active, valid job into lines array
      lines.push(activeJob);
      return true;
    }

    return false;
  }

  /**
   * Loads the system crontab into this object.
   *
   * @param {function} __callback__
   *
   * @api private
   */
  function load(cb) {
    var stdout  = '';
    var stderr  = '';
    var args    = makeChildArgs('load');
    var command = makeChildCommand();
    var child   = Spawn(command, args);

    jobs  = [];
    lines = [];

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', function(chunk) {
      stdout += chunk;
    });
    child.stderr.on('data', function(chunk) {
      stderr += chunk;
    });
    child.on('error', function (err) {
    });
    child.on('close', function (code) {
      if (code != 0 && stderr.indexOf('no crontab for ') < 0) {
        cb && cb({message:stderr}, null);
        return;
      }

      var tokens = stdout.split('\n');
      for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        var job   = makeJob(token);

        if (job != null && job.isValid()) {
          jobs.push(job);
          lines.push(job);
        }
        else {
          lines.push(token);
        }
      }

      truncateLines();

      backup.lines = lines.slice();
      backup.jobs  = jobs.slice();

      cb && cb(null, self);
    });
  }
  /**
   * Removes the specified job from the crontab.
   *
   * @param {CronJob} __job__
   *
   * @api private
   */
  function remove(job) {
    var oldJobs  = jobs;
    var oldLines = lines;

    jobs  = [];
    lines = [];

    for (var i = 0; i < oldJobs.length; i++) {
      var oldJob = oldJobs[i];

      if (oldJob != job) {
        jobs.push(oldJob);
      }
    }
    for (var i = 0; i < oldLines.length; i++) {
      var oldLine = oldLines[i];

      if (oldLine != job) {
        lines.push(oldLine);
      }
    }

    return (oldJobs.length !== jobs.length);
  }
  /**
   * Creates an array of CL arguments for the system "crontab" command. Intended to be passed to
   * child_process.spawn.
   *
   * @param {String} __action__ 'load' | 'save'
   *
   * @api private
   */
  function makeChildArgs(action) {
    var args = [];
    if (user) {
      args = args.concat('-u', user);
    }

    if (action == 'load') {
      args.push('-l');
    }
    if (action == 'save' && process.platform !== 'sunos') {
      args.push('-');
    }

    return args;
  }
  /**
   * Creates a system command string to run crontab. Intended to be passed to
   * child_process.spawn. If this is going to run for another user and the
   * current user is not root, we prefix the command with sudo.
   *
   * @api private
   */
  function makeChildCommand() {
    var command = COMMAND;
    if (user.length > 0 && root == false) {
      command = 'sudo ' + command;
    }

    return command;
  }
  /**
   * Creates a new job. This method exists to catch instantiation exceptions.
   * @see CronJob
   *
   * @param {String|null} __line__
   * @param {String} __[command]__
   * @param {String} __[comment]__
   *
   * @api private
   */
  function makeJob(line, command, comment) {
    try {
      var job = new CronJob(line, command, comment);
      if (!job || !job.isValid()) {
        throw 'invalid job';
      }
      return job;
    } catch(e) {}

    return null;
  }
  /**
   * Compacts the line collection by removes empty lines from the end.
   *
   * @api private
   */
  function truncateLines() {
    var undefined;
    var line = lines.pop();

    while (line != undefined && line.toString().trim() == '') {
      line = lines.pop();
    }

    if (line != undefined) {
      lines.push(line);
    }
  }
}


// public API
module.exports = {
  load:function() {
    console.log('Using linked module');

    if (_.isString(arguments[0]) && _.isFunction(arguments[1])) {
      new CronTab(arguments[0], arguments[1]);
    }
    else if (_.isFunction(arguments[0])) {
      new CronTab('', arguments[0]);
    }
  }
};
