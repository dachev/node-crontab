#!/usr/bin/env node

var Vows    = require('vows'),
    Assert  = require('assert'),
    Crontab = require('../lib/crontab');

Vows.describe('crontab').addBatch({
    'can load user crontab': {
        topic:3,
        'test':function(v) {
            Assert.equal(v, 3);
        }
    }
}).export(module);