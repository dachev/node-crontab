#!/usr/bin/env node

require('child_process').spawn = mockChild;

// Mock child_process
function mockChild(command, args) {
  var undefined;
  var action = (args.indexOf('-l') >= 0) ? 'load' : 'save';
  var uRegEx = /-u\s([^\s]+)/;
  var tokens = args.join(' ').match(uRegEx);
  var user   = tokens && tokens[1] || '';
  if (command === 'sudo') {
    mockChild.user = 'root';
  }
  
  function load(child) {
    process.nextTick(function() {
      if (mockChild.user != 'root' && user != '') {
        child.stderr.emit('data', 'crontab: must be privileged to use -u');
        child.emit('close', 1);
        return;
      }
      
      var tabs = mockChild.tabs[user || mockChild.user];
      if (tabs == undefined && user != '') {
        child.stderr.emit('data', 'crontab: user ' + user + ' unknown');
        child.emit('close', 1);
        return;
      }
      if (tabs == null) {
        child.stderr.emit('data', 'crontab: no crontab for ...');
        child.emit('close', 1);
        return;
      }
      
      child.stdout.emit('data', tabs.join('\n'));
      child.emit('close', 0);
    });
  }
  
  function save(child, newTabs) {
    process.nextTick(function() {
      if (mockChild.user != 'root' && user != '') {
        child.stderr.emit('data', 'crontab: must be privileged to use -u');
        child.emit('close', 1); 
      }
      else {
        mockChild.tabs[user || mockChild.user] = newTabs.split('\n');
        child.emit('close', 0);
      }
    });
  }
  
  var child = new process.EventEmitter;
  child.stdout = new process.EventEmitter;
  child.stderr = new process.EventEmitter;
  child.stdin  = {
    buffer : '',
    write  : function(tabs) { this.buffer = tabs; },
    end    : function(tabs) { save(child, this.buffer); }
  }

  child.stdout.setEncoding =function(){};
  child.stderr.setEncoding =function(){};
  
  if (action == 'load') {
    load(child);
  }
  
  return child;
}
mockChild.user = 'blago';
mockChild.tabs = {
  empty   : [],
  reset   : [],
  alice   : ['0 8-17 * * 1-5 /usr/bin/env echo "check email"',
             '* 19-0,0-3 * * 1-5 /usr/bin/env echo "hack node.js"',
             '30 11 * * 6-0 /usr/bin/env echo "wake up"',
             '* * * 5-8 * /usr/bin/env echo "go to Bulgaria"',
             '30 9 24 12 * /usr/bin/env echo "get presents"'],
  bob     : ['0 8-17 * * 1-5 /usr/bin/env echo "check email"',
             '* 19-0,0-3 * * 1-5 /usr/bin/env echo "hack node.js"',
             '30 11 * * 6-0 /usr/bin/env echo "wake up"'],
  blago   : null,
  root    : [],
  remove  : ['0 7 * * 1,2,3,4,5 ls -la # every weekday @7',
             '0 8 * * 1,2,3,4,5 ls -lh # every weekday @8',
             '0 9 * * 1,2,3,4,5 ls -lt # every weekday @9'],
  special : ['@reboot /usr/bin/env echo "starting service (reboot)" #reboot',
             '@hourly /usr/bin/env echo "starting service (hourly)"',
             '@daily /usr/bin/env echo "starting service (daily)"',
             '@weekly /usr/bin/env echo "starting service (weekly)"',
             '@monthly /usr/bin/env echo "starting service (monthly)"',
             '@yearly /usr/bin/env echo "starting service (yearly)"',
             '@annually /usr/bin/env echo "starting service (annually)"',
             '@midnight /usr/bin/env echo "starting service (midnight)"'],
  comments: ['0 8-17 * * 1-5 /usr/bin/env echo "check email" #every business hour'],
  commands: ['0 8-17 * * 1-5 /usr/bin/env echo "check email" #every business hour']
};


// Test helpers
function loadTabs(user) {
  var promise = new(process.EventEmitter);
  
  CronTab.load(user, function(err, tab) {
    if (err) { promise.emit('error', err); }
    else     { promise.emit('success', tab); }
  });
  
  return promise;
}
function saveTabs(tab) {
  var promise = new(process.EventEmitter);
  
  tab.save(function(err, tab) {
    if (err) { promise.emit('error', err); }
    else     { promise.emit('success', tab); }
  });
  
  return promise;
}
function makeTabArrayFromTopicStack() {
  var tab1 = arguments[0];
  var tab2 = arguments[2];
  
  return [tab1, tab2];
}


// Test batches
var nonRootLoadsAnoterUserCrons = {
  'non-root user loads another user\'s crons': {
    topic: function() {
      mockChild.user = 'blago';
      return loadTabs('alice');
    },
    'should fail loading':function(err, tab) {
      Assert.isObject(err);
      Assert.isString(err.message);
      Assert.matches(err.message, /privileged/);
    }
  }
};
var rootLoadsAnoterUserCrons = {
  'root user loads another (existing) user\'s crons': {
    topic: function() {
      mockChild.user = 'root';
      return loadTabs('bob');
    },
    'should succeed loading':function(err, tab) {
      rootLoadsAnoterUserCrons.tab = tab;
      
      Assert.isNull(err);
      Assert.isObject(tab);
      Assert.isArray(tab.jobs());
      Assert.equal(tab.jobs().length, 3);
    }
  }
};
var sudoLoadsAnoterUserCrons = {
  'sudo user loads another (existing) user\'s crons': {
    topic: function() {
      return loadTabs({
        user:'bob',
        spawn: function (cmd, argv, opt) {
          return mockChild('sudo', ['--', cmd].concat(argv), opt);
        }
      });
    },
    'should succeed loading':function(err, tab) {
      sudoLoadsAnoterUserCrons.tab = tab;
      
      Assert.isNull(err);
      Assert.isObject(tab);
      Assert.isArray(tab.jobs());
      Assert.equal(tab.jobs().length, 3);
    }
  }
};
var rootLoadsAnoterNonExistingUserCrons = {
  'root user loads another (non-existing) user\'s crons': {
    topic: function() {
      mockChild.user = 'root';
      return loadTabs('tom');
    },
    'should fail loading':function(err, tab) {
      Assert.isObject(err);
      Assert.isString(err.message);
      Assert.matches(err.message, /unknown/);
    }
  }
};
var userLoadsHisOwnEmptyCrons = {
  'user loads his own (empty) crons': {
    topic: function() {
      mockChild.user = 'blago';
      return loadTabs('');
    },
    'should succeed loading':function(err, tab) {
      userLoadsHisOwnEmptyCrons.tab = tab;
      
      Assert.isNull(err);
      Assert.isObject(tab);
      Assert.isArray(tab.jobs());
      Assert.equal(tab.jobs().length, 0);
    }
  }
};
var userLoadsHerOwnNonEmptyCrons = {
  'user loads her own (non-empty) crons': {
    topic: function() {
      mockChild.user = 'alice';
      return loadTabs('');
    },
    'should succeed loading':function(err, tab) {
      userLoadsHerOwnNonEmptyCrons.tab = tab;
      
      Assert.isNull(err);
      Assert.isObject(tab);
      Assert.isArray(tab.jobs());
      Assert.equal(tab.jobs().length, 5);
    }
  }
};
var userSavesHerOwnNonEmptyCrons = {
  'user saves her own (non-empty) crons': {
    topic: function() {
      return saveTabs(userLoadsHerOwnNonEmptyCrons.tab);
    },
    'should succeed saving':function(err, tab) {
      Assert.isNull(err);
      Assert.isObject(tab);
    }
  }
};
var userLoadsHerOwnNonEmptyCronsAgain = {
  'user loads her own (non-empty) crons again': {
    topic: function() {
      mockChild.user = 'alice';
      return loadTabs('');
    },
    'should succeed loading':function(err, tab) {
      userLoadsHerOwnNonEmptyCronsAgain.tab = tab;
      
      Assert.isNull(err);
      Assert.isObject(tab);
      Assert.isArray(tab.jobs());
      Assert.equal(tab.jobs().length, 5);
    },
    'are the same':function(err, tab) {
      Assert.equal(tab.render().trim(), mockChild.tabs.alice.join('\n').trim());
    }
  }
};
var canCreateJob = {
  'can create job': {
    topic: function() {
      mockChild.user = 'empty';

      return loadTabs('');
    },
    'should succeed with string expression and comment':function(err, tab) {
      var job = tab.create('ls -l', '0 7 * * 1,2,3,4,5', 'test');

      Assert.isTrue(job.isValid());
      Assert.equal(job.minute().toString(), '0');
      Assert.equal(job.hour().toString(), '7');
      Assert.equal(job.dom().toString(), '*');
      Assert.equal(job.month().toString(), '*');
      Assert.equal(job.dow().toString(), '1,2,3,4,5');
      Assert.equal(job.command(), 'ls -l');
      Assert.equal(job.comment(), 'test');
    },
    'should succeed with date and comment':function(err, tab) {
      var date = new Date(1400373907766);
      var job  = tab.create('ls -l', date, 'test');

      Assert.isTrue(job.isValid());
      Assert.equal(job.minute(), date.getMinutes());
      Assert.equal(job.hour(), date.getHours());
      Assert.equal(job.dom(), date.getDate());
      Assert.equal(job.month(), date.getMonth()+1);
      Assert.equal(job.dow().toString(), '*');
      Assert.equal(job.command(), 'ls -l');
      Assert.equal(job.comment(), 'test');
    },
    'should succeed with date and no comment':function(err, tab) {
      var date = new Date(1400373907766);
      var job = tab.create('ls -l', date);

      Assert.isTrue(job.isValid());
      Assert.equal(job.minute(), date.getMinutes());
      Assert.equal(job.hour(), date.getHours());
      Assert.equal(job.dom(), date.getDate());
      Assert.equal(job.month(), date.getMonth()+1);
      Assert.equal(job.dow().toString(), '*');
      Assert.equal(job.command(), 'ls -l');
      Assert.equal(job.comment(), '');
    },
    'should succeed with no date and comment':function(err, tab) {
      var job = tab.create('ls -l', null, 'test');

      Assert.isTrue(job.isValid());
      Assert.equal(job.minute().toString(), '*');
      Assert.equal(job.hour().toString(), '*');
      Assert.equal(job.dom().toString(), '*');
      Assert.equal(job.month().toString(), '*');
      Assert.equal(job.dow().toString(), '*');
      Assert.equal(job.command(), 'ls -l');
      Assert.equal(job.comment(), 'test');
    },
    'should succeed with no date and no comment':function(err, tab) {
      var job = tab.create('ls -l', null, null);

      Assert.isTrue(job.isValid());
      Assert.equal(job.minute().toString(), '*');
      Assert.equal(job.hour().toString(), '*');
      Assert.equal(job.dom().toString(), '*');
      Assert.equal(job.month().toString(), '*');
      Assert.equal(job.dow().toString(), '*');
      Assert.equal(job.command(), 'ls -l');
      Assert.equal(job.comment(), '');
    }
  }
};
var canRemoveJob = {
  'can remove job': {
    topic: function() {
      mockChild.user = 'remove';

      return loadTabs('');
    },
    'should succeed with job object':function(err, tab) {
      var count = tab.jobs().length;
      var job   = tab.jobs({command:'ls -la'})[0];

      tab.remove(job);

      Assert.equal(tab.jobs().length, count-1);
    },
    'should succeed with command query':function(err, tab) {
      var count = tab.jobs().length;
      tab.remove({command:'ls -lh'});

      Assert.equal(tab.jobs().length, count-1);
    },
    'should succeed with comment query':function(err, tab) {
      var count = tab.jobs().length;
      tab.remove({comment:'every weekday @9'});

      Assert.equal(tab.jobs().length, count-1);
    }
  }
};
var canParseRawLine = {
  'can parse raw line': {
    topic: function() {
      mockChild.user = 'special';
      return loadTabs('');
    },
    'should succeed parsing raw line':function(err, tab) {
      var job = tab.parse('0 7 * * 1,2,3,4,5 ls -l #test');

      Assert.isTrue(job.isValid());
      Assert.equal(job.minute().toString(), '0');
      Assert.equal(job.hour().toString(), '7');
      Assert.equal(job.dom().toString(), '*');
      Assert.equal(job.month().toString(), '*');
      Assert.equal(job.dow().toString(), '1,2,3,4,5');
      Assert.equal(job.command(), 'ls -l');
      Assert.equal(job.comment(), 'test');
    }
  }
}
var canParseSpecialSyntax = {
  'can parse special cron syntax': {
    topic: function() {
      mockChild.user = 'special';
      return loadTabs('');
    },
    'should succeed loading':function(err, tab) {
      Assert.isNull(err);
      Assert.isObject(tab);
      Assert.isArray(tab.jobs());
      Assert.equal(tab.jobs().length, 8);
    },
    '@reboot':function(err, tab) {
      var jobs = tab.jobs({command:'reboot'});
      var job  = jobs[0];
      
      Assert.isArray(jobs);
      Assert.equal(jobs.length, 1);
      Assert.isTrue(job.isValid());
      Assert.equal(job.comment(), 'reboot');
    },
    '@hourly':function(tab) {
      var jobs = tab.jobs({command:'hourly'});
      var job  = jobs[0];
      
      Assert.isArray(jobs);
      Assert.equal(jobs.length, 1);
      Assert.isTrue(job.isValid());
      Assert.equal(job.minute().toString(), '0');
      Assert.equal(job.hour().toString(), '*');
      Assert.equal(job.dom().toString(), '*');
      Assert.equal(job.month().toString(), '*');
      Assert.equal(job.dow().toString(), '*');
    },
    '@daily':function(tab) {
      var jobs = tab.jobs({command:'daily'});
      var job  = jobs[0];
      
      Assert.isArray(jobs);
      Assert.equal(jobs.length, 1);
      Assert.isTrue(job.isValid());
      Assert.equal(job.minute().toString(), '0');
      Assert.equal(job.hour().toString(), '0');
      Assert.equal(job.dom().toString(), '*');
      Assert.equal(job.month().toString(), '*');
      Assert.equal(job.dow().toString(), '*');
    },
    '@weekly':function(tab) {
      var jobs = tab.jobs({command:'weekly'});
      var job  = jobs[0];
      
      Assert.isArray(jobs);
      Assert.equal(jobs.length, 1);
      Assert.isTrue(job.isValid());
      Assert.equal(job.minute().toString(), '0');
      Assert.equal(job.hour().toString(), '0');
      Assert.equal(job.dom().toString(), '*');
      Assert.equal(job.month().toString(), '*');
      Assert.equal(job.dow().toString(), '0');
    },
    '@monthly':function(tab) {
      var jobs = tab.jobs({command:'monthly'});
      var job  = jobs[0];
      
      Assert.isArray(jobs);
      Assert.equal(jobs.length, 1);
      Assert.isTrue(job.isValid());
      Assert.equal(job.minute().toString(), '0');
      Assert.equal(job.hour().toString(), '0');
      Assert.equal(job.dom().toString(), '1');
      Assert.equal(job.month().toString(), '*');
      Assert.equal(job.dow().toString(), '*');
    },
    '@yearly':function(tab) {
      var jobs = tab.jobs({command:'yearly'});
      var job  = jobs[0];
      
      Assert.isArray(jobs);
      Assert.equal(jobs.length, 1);
      Assert.isTrue(job.isValid());
      Assert.equal(job.minute().toString(), '0');
      Assert.equal(job.hour().toString(), '0');
      Assert.equal(job.dom().toString(), '1');
      Assert.equal(job.month().toString(), '1');
      Assert.equal(job.dow().toString(), '*');
    },
    '@annually':function(tab) {
      var jobs = tab.jobs({command:'yearly'});
      var job  = jobs[0];
      
      Assert.isArray(jobs);
      Assert.equal(jobs.length, 1);
      Assert.isTrue(job.isValid());
      Assert.equal(job.minute().toString(), '0');
      Assert.equal(job.hour().toString(), '0');
      Assert.equal(job.dom().toString(), '1');
      Assert.equal(job.month().toString(), '1');
      Assert.equal(job.dow().toString(), '*');
    },
    '@midnight':function(tab) {
      var jobs = tab.jobs({command:'midnight'});
      var job  = jobs[0];
      
      Assert.isArray(jobs);
      Assert.equal(jobs.length, 1);
      Assert.isTrue(job.isValid());
      Assert.equal(job.minute().toString(), '0');
      Assert.equal(job.hour().toString(), '0');
      Assert.equal(job.dom().toString(), '*');
      Assert.equal(job.month().toString(), '*');
      Assert.equal(job.dow().toString(), '*');
    }
  }
};
var canParseCommands = {
  'can parse commands' : {
    topic: function() {
      mockChild.user = 'commands';
      return loadTabs('');
    },
    'should succeed loading':function(err, tab) {
      Assert.isNull(err);
      Assert.isObject(tab);
      Assert.isArray(tab.jobs());
      Assert.equal(tab.jobs().length, 1);
    },
    'command should match':function(err, tab) {
      var job = tab.jobs()[0];
      Assert.equal(job.command(), '/usr/bin/env echo "check email"');
    }
  }
}
var canParseInlineComments = {
  'can parse inline comments' : {
    topic: function() {
      mockChild.user = 'comments';
      return loadTabs('');
    },
    'should succeed loading':function(err, tab) {
      Assert.isNull(err);
      Assert.isObject(tab);
      Assert.isArray(tab.jobs());
      Assert.equal(tab.jobs().length, 1);
    },
    'comment should match':function(err, tab) {
      var job = tab.jobs()[0];
      Assert.equal(job.comment(), 'every business hour');
    }
  }
};
var canFindJobsByCommand = {
  'can find jobs by command' : {
      topic: function() {
        mockChild.user = 'commands';
        return loadTabs('');
      },
      'should succeed loading':function(err, tab) {
        Assert.isNull(err);
        Assert.isObject(tab);
        Assert.isArray(tab.jobs());
        Assert.equal(tab.jobs().length, 1);
      },
      'should find jobs by substring':function(err, tab) {
        var jobs = tab.jobs({command:'/usr/bin/env echo'});
        
        Assert.isArray(jobs);
        Assert.equal(jobs.length, 1);
      },
      'should find jobs by regular expression':function(err, tab) {
        var jobs = tab.jobs({command:/echo/});
        
        Assert.isArray(jobs);
        Assert.equal(jobs.length, 1);
      }
  }
};
var canFindJobsByComment = {
  'can find jobs by comment' : {
    topic: function() {
      mockChild.user = 'comments';
      return loadTabs('');
    },
    'should succeed loading':function(err, tab) {
      Assert.isNull(err);
      Assert.isObject(tab);
      Assert.isArray(tab.jobs());
      Assert.equal(tab.jobs().length, 1);
    },
    'should find jobs by substring':function(err, tab) {
      var jobs = tab.jobs({comment:'every business hour'});
      
      Assert.isArray(jobs);
      Assert.equal(jobs.length, 1);
    },
    'should find jobs by regular expression':function(err, tab) {
      var jobs = tab.jobs({comment:/business/});
      
      Assert.isArray(jobs);
      Assert.equal(jobs.length, 1);
    }
  }
};
var canSaveCreatedJobs = {
  'can save jobs' : {
    topic: function() {
      mockChild.user = 'comments';
      return loadTabs('');
    },
    'should succeed loading':function(err, tab) {
      var jobs = tab.jobs();

      Assert.equal(jobs.length, 1);
    },
    'after a successful load': {
      topic: function(tab) {
        tab.create('ls -l', '0 7 * * 1,2,3,4,5', 'test');
        return saveTabs(tab);
      },
      'should succeed saving':function(err, tab) {
        var jobs = tab.jobs();

        Assert.equal(jobs.length, 2);
      }
    }
  }
};
var canResetJobs = {
  'can reset jobs' : {
    topic: function() {
      mockChild.user = 'reset';
      return loadTabs('');
    },
    'should succeed reseting':function(err, tab) {
      Assert.equal(tab.jobs().length, 0);

      tab.create('ls -l', '0 7 * * 1,2,3,4,5', 'test 1');
      tab.create('ls -l', '0 7 * * 1,2,3,4,5', 'test 2');
      tab.create('ls -l', '0 7 * * 1,2,3,4,5', 'test 3');
      Assert.equal(tab.jobs().length, 3);

      tab.reset();
      Assert.equal(tab.jobs().length, 0);
    }
  }
};

var Vows    = require('vows');
var Assert  = require('assert');
var CronTab = require('../lib/index');

Vows.describe('crontab').
  addBatch(nonRootLoadsAnoterUserCrons).
  addBatch(rootLoadsAnoterUserCrons).
  addBatch(sudoLoadsAnoterUserCrons).
  addBatch(rootLoadsAnoterNonExistingUserCrons).
  addBatch(userLoadsHisOwnEmptyCrons).
  addBatch(userLoadsHerOwnNonEmptyCrons).
  addBatch(userSavesHerOwnNonEmptyCrons).
  addBatch(userLoadsHerOwnNonEmptyCronsAgain).
  addBatch(canCreateJob).
  addBatch(canRemoveJob).
  addBatch(canParseRawLine).
  addBatch(canParseSpecialSyntax).
  addBatch(canParseCommands).
  addBatch(canParseInlineComments).
  addBatch(canFindJobsByCommand).
  addBatch(canFindJobsByComment).
  addBatch(canSaveCreatedJobs).
  addBatch(canResetJobs).
  export(module);
