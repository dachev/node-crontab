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
            
            child.stdout.emit('data', tabs);
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
                mockChild.tabs[user || mockChild.user] = newTabs;
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
    alice : '0 8-17 * * 1-5 /usr/bin/env echo "check email"\n\
            * 19-0,0-3 * * 1-5 /usr/bin/env echo "hack node.js"\n\
            30 11 * * 6-0 /usr/bin/env echo "wake up"\n\
            * * * 5-8 * /usr/bin/env echo "go to Bulgaria"\n\
            30 9 24 dec * /usr/bin/env echo "get presents"\n\
            @reboot /usr/bin/env echo "starting some service..."\n',
    bob   : '0 8-17 * * 1-5 /usr/bin/env echo "check email"\n\
            * 19-0,0-3 * * 1-5 /usr/bin/env echo "hack node.js"\n\
            30 11 * * 6-0 /usr/bin/env echo "wake up"\n',
    blago : null,
    root  : ''
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
        'should fail':function(err, tab) {
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
        'should succeed':function(err, tab) {
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
        'should fail':function(err, tab) {
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
        'should succeed':function(err, tab) {
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
        'should succeed':function(err, tab) {
            userLoadsHerOwnNonEmptyCrons.tab = tab;
            
            Assert.isNull(err);
            Assert.isObject(tab);
            Assert.isArray(tab.getJobs());
            Assert.equal(tab.getJobs().length, 6);
        }
    }
};
var userSavesHerOwnNonEmptyCrons = {
    'user saves her own (non-empty) crons': {
        topic: function() {
            return saveTabs(userLoadsHerOwnNonEmptyCrons.tab);
        },
        'should succeed':function(err, tab) {
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
        'should succeed':function(err, tab) {
            userLoadsHerOwnNonEmptyCronsAgain.tab = tab;
            
            Assert.isNull(err);
            Assert.isObject(tab);
            Assert.isArray(tab.getJobs());
            Assert.equal(tab.getJobs().length, 6);
        },
        'are the same':function(err, thisTab) {
            var firstTab = userLoadsHerOwnNonEmptyCrons.tab;
            
            Assert.equal(firstTab.render(), thisTab.render());
        }
    }
};


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
    export(module);
