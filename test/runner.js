#!/usr/bin/env node

var Vows    = require('vows'),
    Assert  = require('assert'),
    CronTab = require('../lib/crontab');

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