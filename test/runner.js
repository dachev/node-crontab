#!/usr/bin/env node

//require('child_process').spawn = mockChild;
function mockChild(command, args) {
    var action = (args.indexOf('-l') >= 0) ? 'load' : 'save',
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
            if (mockChild.isRoot == false && user != '') {
                child.stderr.emit('data', 'crontab: must be privileged to use -u');
                child.emit('exit', '1');
            }
            else if (mockChild.hasTabs == false) {
                child.stderr.emit('data', 'crontab: no crontab for ...');
                child.emit('exit', '1');
            }
            else {
                child.stdout.emit('data', mockChild.tabs);
                child.emit('exit', '0');
            }
        });
    }
    
    function save(child, tabs) {
        process.nextTick(function() {
            if (mockChild.isRoot == false && user != '') {
                child.stderr.emit('data', 'crontab: must be privileged to use -u');
                child.emit('exit', '1');
            }
            else {
                mockChild.tabs = tabs;
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
mockChild.isRoot  = false;
mockChild.hasTabs = false;
mockChild.tabs    = '';


var Vows    = require('vows'),
    Assert  = require('assert'),
    CronTab = require('../lib/index');

Vows.describe('crontab').addBatch({
    'io': {
        topic: loadTabs,
        'will load user tabs':function(err, tab) {
            Assert.isNull(err);
            Assert.isObject(tab);
        },
        'after tabs are loaded': {
            topic:saveTabs,
            'will save user tabs':function(err, tab) {
                Assert.isNull(err);
                Assert.isObject(tab);
            },
            'then saved': {
                topic: loadTabs,
                'will load user tabs again':function(err, tab) {
                    Assert.isNull(err);
                    Assert.isObject(tab);
                },
                'and then loaded again': {
                    topic: makeTabArrayFromTopicStack,
                    'they will be the same':function(tabs) {
                        Assert.equal(tabs[0].render(), tabs[1].render());
                    }
                }
            }
        }
    }
}).export(module);

function loadTabs() {
    var promise = new(process.EventEmitter);
    
    CronTab.load('', function(err, tab) {
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