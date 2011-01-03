#!/usr/bin/env node

require('child_process').spawn = mockChild;

// Mock child_process
function mockChild(command, args) {
    var undefined,
        action = (args.indexOf('-l') >= 0) ? 'load' : 'save',
        user   = '',
        uRegEx = /-u\s([^\s]+)/;
    
    for (var i = 0; i < args.length; i++) {
        var arg    = args[i],
            tokens = arg.match(uRegEx);
        
        user = tokens && tokens[1] || '';
        
        if (user) { break; }
    };
    
    function load(child) {
        process.nextTick(function() {
            if (mockChild.user != 'root' && user != '') {
                child.stderr.emit('data', 'crontab: must be privileged to use -u');
                child.emit('exit', '1');
                return;
            }
            
            var tabs = mockChild.tabs[user || mockChild.user];
            if (tabs == undefined && user != '') {
                child.stderr.emit('data', 'crontab: user ' + user + ' unknown');
                child.emit('exit', '1');
                return;
            }
            if (tabs == null) {
                child.stderr.emit('data', 'crontab: no crontab for ...');
                child.emit('exit', '1');
                return;
            }
            
            child.stdout.emit('data', tabs.join('\n'));
            child.emit('exit', '0');
        });
    }
    
    function save(child, newTabs) {
        process.nextTick(function() {
            if (mockChild.user != 'root' && user != '') {
                child.stderr.emit('data', 'crontab: must be privileged to use -u');
                child.emit('exit', '1');
            }
            else {
                mockChild.tabs[user || mockChild.user] = newTabs.split('\n');
                child.emit('exit', '0');
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
    
    if (action == 'load') {
        load(child);
    }
    
    return child;
}
mockChild.user = 'blago';
mockChild.tabs = {
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
    special : ['@reboot /usr/bin/env echo "starting service (reboot)"',
               '@hourly /usr/bin/env echo "starting service (hourly)"',
               '@daily /usr/bin/env echo "starting service (daily)"',
               '@weekly /usr/bin/env echo "starting service (weekly)"',
               '@monthly /usr/bin/env echo "starting service (monthly)"',
               '@yearly /usr/bin/env echo "starting service (yearly)"',
               '@annually /usr/bin/env echo "starting service (annually)"',
               '@midnight /usr/bin/env echo "starting service (midnight)"'],
    comments: ['0 8-17 * * 1-5 /usr/bin/env echo "check email" #every business hour'],
    commands: ['0 8-17 * * 1-5 /usr/bin/env echo "check email" #every business hour'],
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
    var tab1 = arguments[0],
        tab2 = arguments[2];
    
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
            Assert.isArray(tab.getJobs());
            Assert.equal(tab.getJobs().length, 3);
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
            Assert.isArray(tab.getJobs());
            Assert.equal(tab.getJobs().length, 0);
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
            Assert.isArray(tab.getJobs());
            Assert.equal(tab.getJobs().length, 5);
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
            Assert.isArray(tab.getJobs());
            Assert.equal(tab.getJobs().length, 5);
        },
        'are the same':function(err, tab) {
            Assert.equal(tab.render().trim(), mockChild.tabs.alice.join('\n').trim());
        }
    }
};
var canParseSpecialSyntax = {
    'can parse special cron syntax': {
        topic: function() {
            mockChild.user = 'special';
            return loadTabs('');
        },
        'should succeed loading':function(err, tab) {
            Assert.isNull(err);
            Assert.isObject(tab);
            Assert.isArray(tab.getJobs());
            Assert.equal(tab.getJobs().length, 8);
        },
        '@reboot':function(err, tab) {
            var jobs = tab.findCommand('reboot'),
                job  = jobs[0];
            
            Assert.isArray(jobs);
            Assert.equal(jobs.length, 1);
            Assert.isTrue(job.isValid());
        },
        '@hourly':function(tab) {
            var jobs = tab.findCommand('hourly'),
                job  = jobs[0];
            
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
            var jobs = tab.findCommand('daily'),
                job  = jobs[0];
            
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
            var jobs = tab.findCommand('weekly'),
                job  = jobs[0];
            
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
            var jobs = tab.findCommand('monthly'),
                job  = jobs[0];
            
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
            var jobs = tab.findCommand('yearly'),
                job  = jobs[0];
            
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
            var jobs = tab.findCommand('yearly'),
                job  = jobs[0];
            
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
            var jobs = tab.findCommand('midnight'),
                job  = jobs[0];
            
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
var canParseInlineComments = {
    'can parse inline comments' : {
        topic: function() {
            mockChild.user = 'comments';
            return loadTabs('');
        },
        'should succeed loading':function(err, tab) {
            Assert.isNull(err);
            Assert.isObject(tab);
            Assert.isArray(tab.getJobs());
            Assert.equal(tab.getJobs().length, 1);
        },
        'comment should match':function(err, tab) {
            var job = tab.getJobs()[0];
            Assert.equal(job.comment(), 'every business hour');
        }
    }
}
var canParseCommands = {
    'can parse commands' : {
        topic: function() {
            mockChild.user = 'commands';
            return loadTabs('');
        },
        'should succeed loading':function(err, tab) {
            Assert.isNull(err);
            Assert.isObject(tab);
            Assert.isArray(tab.getJobs());
            Assert.equal(tab.getJobs().length, 1);
        },
        'command should match':function(err, tab) {
            var job = tab.getJobs()[0];
            Assert.equal(job.command(), '/usr/bin/env echo "check email"');
        }
    }
}

var Vows    = require('vows'),
    Assert  = require('assert'),
    CronTab = require('../lib/index');

Vows.describe('crontab').
    addBatch(nonRootLoadsAnoterUserCrons).
    addBatch(rootLoadsAnoterUserCrons).
    addBatch(rootLoadsAnoterNonExistingUserCrons).
    addBatch(userLoadsHisOwnEmptyCrons).
    addBatch(userLoadsHerOwnNonEmptyCrons).
    addBatch(userSavesHerOwnNonEmptyCrons).
    addBatch(userLoadsHerOwnNonEmptyCronsAgain).
    addBatch(canParseSpecialSyntax).
    addBatch(canParseCommands).
    addBatch(canParseInlineComments).
    export(module);
