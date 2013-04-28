/**
 * Constants
 */
const COMMAND  = 'crontab';
const ITEMREX  = /^\s*([^@#\s]+)\s+([^@#\s]+)\s+([^@#\s]+)\s+([^@#\s]+)\s+([^@#\s]+)\s+([^#\n]*)(\s+#\s*([^\n]*)|$)/;
const SPECREX  = /@(\w+)\s([^#\n]*)(\s+#\s*([^\n]*)|$)/;
const SPECIALS = {
	'reboot'   : '@reboot',
	'hourly'   : '0 * * * *',
	'daily'    : '0 0 * * *',
	'weekly'   : '0 0 * * 0',
	'monthly'  : '0 0 1 * *',
	'yearly'   : '0 0 1 1 *',
	'annually' : '0 0 1 1 *',
	'midnight' : '0 0 * * *'
};

const MONTH_ENUM = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const WEEK_ENUM  = ['sun','mon','tue','wed','thu','fri','sat','sun'];
const SINFO = [
	{ 'name' : 'Minute',       'max' : 59, 'min' : 0 },
	{ 'name' : 'Hours',        'max' : 23, 'min' : 0 },
	{ 'name' : 'Day of Month', 'max' : 31, 'min' : 1 },
	{ 'name' : 'Month',        'max' : 12, 'min' : 1, 'enumm' : MONTH_ENUM },
	{ 'name' : 'Day of Week',  'max' : 7,  'min' : 0, 'enumm' : WEEK_ENUM },
];

/**
 * @ignore
 */
var Spawn = require('child_process').spawn;

/**
 * @class CronTab
 * A JavaScript representation of a user crontab. Each tab has zero or more cron jobs coresponding
 * to the individual lines in the cron sytax.
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
    var self   = this,
        user   = u || '',
        root   = (process.getuid() == 0),
        backup = {lines:[], jobs:[]},
        lines  = [],
        jobs   = [];
    
    load(cb);
    
    
    /**
     * Provides access to the jobs collection.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.getJobs();
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].render());
     *         }
     *     });
     *
     * @return {Array[CronJob]}
     */
    this.getJobs = function() {
        return jobs;
    }
    /**
     * Writes the crontab to the system. Saves all information.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
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
        var stdout = '',
            stderr = '',
            args   = makeChildArgs('save'),
            child  = Spawn(COMMAND, args);
        
        child.stdout.on('data', function(chunk) {
            stdout += chunk;
        });
        child.stderr.on('data', function(chunk) {
            stderr += chunk;
        });
        child.on('exit', function (code) {
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
     * @param {String} __[comment]__
     * @param {Date} __[date]__
     * @return {CronJob|null}
     */
    this.create = function(command) {
        var args    = Array.prototype.slice.call(arguments),
            types   = args.map(function(arg) { return typeof arg; }),
            comment = (types[1] == 'string') ? args[1] : null,
            job     = makeJob(null, command, comment);
        
        if (job == null) { return job; }
        
        jobs.push(job);
        lines.push(job);
    
        var date = (args[1] instanceof Date) ?
            args[1] : (args[2] instanceof Date) ?
                args[2] :
                null;
        
        if (date && date instanceof Date) {
            job.minute().on(date.getMinutes());
            job.hour().on(date.getHours());
            job.dom().on(date.getDate());
            job.month().on(date.getMonth()+1);
        }
        
        return job;
    }
    /**
     * Returns a list of jobs matching the specified command.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].render());
     *         }
     *     });
     *
     * @param {String|RegEx} __pattern__
     * @return {Array[CronJob]}
     */
    this.findCommand = function(pattern) {
        var results = [];
        
        for (var i = 0; i < jobs.length; i++) {
            var job = jobs[i];
            
            if (job.command().match(pattern)) {
                results.push(job);
            }
        }
        
        return results;
    }
    /**
     * Returns a list of jobs matching the specified inline comment.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findComment('this should run every night');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].render());
     *         }
     *     });
     *
     * @param {String|RegEx} __pattern__
     * @return {Array[CronJob]}
     */
    this.findComment = function(pattern) {
        var results = [];
        
        for (var i = 0; i < jobs.length; i++) {
            var job = jobs[i];
            
            if (job.comment().match(pattern)) {
                results.push(job);
            }
        }
        
        return results;
    }
    /**
     * Removes the specified jobs from the crontab.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         tab.remove(jobs);
     *     });
     *
     * @param {String} __Array[CronJob]__
     */
    this.remove = function(jobs) {
        if (!(jobs instanceof CronJob) && !(jobs instanceof Array)) {
            return;
        }
        
        if (jobs instanceof CronJob) {
            jobs = [jobs];
        }
        
        for (var i = 0; i < jobs.length; i++) {
            var job = jobs[i];
            remove(job);
        }
        
        truncateLines();
    }
    /**
     * Restores this crontab to its original state.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         tab.remove(jobs);
     *         tab.reset();
     *     });
     */
    this.reset = function() {
        lines = backup.lines;
        jobs  = backup.jobs;
    }
    
    
    /**
     * Loads the system crontab into this object.
     *
     * @param {function} __callback__
     * 
     * @api private
     */
    function load(cb) {
        var stdout = '',
            stderr = '',
            args   = makeChildArgs('load'),
            child  = Spawn(COMMAND, args);
        
        jobs  = [];
        lines = [];
        
        child.stdout.on('data', function(chunk) {
            stdout += chunk;
        });
        child.stderr.on('data', function(chunk) {
            stderr += chunk;
        });
        child.on('exit', function (code) {
            if (code != 0 && stderr.indexOf('no crontab for ') < 0) {
                cb && cb({message:stderr}, null);
                return;
            }
            
            var tokens = stdout.split('\n');
            for (var i = 0; i < tokens.length; i++) {
                var token = tokens[i],
                    job   = makeJob(token);
                
                if (job != null && job.isValid()) {
                    jobs.push(job);
                    lines.push(job);
                }
                else {
                    lines.push(token);
                }
            }
            
            truncateLines();
            
            backup.lines = lines;
            backup.jobs  = jobs;
            
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
    }
    /**
     * Creates an array of CL arguments for the sysem "crontab" command. Intended to be passed to
     * child_process.spawn.
     *
     * @param {String} __action__ 'load' | 'save'
     * 
     * @api private
     */
    function makeChildArgs(action) {
        var actions = {load:'-l', save:'-'},
            args    = [actions[action]];
        
        if (user) {
            args.push(userExecute().trim());
        }
        
        return args;
    }
    /**
     * Returns a user CL switch for the sysem "crontab" command.
     * 
     * @api private
     */
    function userExecute() {
        return (user) ? '-u ' + user : '';
    }
    /**
     * Creates a new job. This method exists to catch possible exceptions thrown during
     * instantiation.
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
            return new CronJob(line, command, comment);
        } catch(e) {}
        
        return null;
    }
    /**
     * Compacts the line collection by removes empty lines from the end.
     * 
     * @api private
     */
    function truncateLines() {
        var undefined,
            line = lines.pop();
        
        while (line != undefined && line.toString().trim() == '') {
            line = lines.pop();
        }
        
        if (line != undefined) {
            lines.push(line);
        }
    }
}


/**
 * @class CronJob
 * A JavaScript representation of a cron job. Each job has exactly 5 time slots as per cron sytax:
 * _minute_, _hour_, _day-of-the-month_, _month_, _day-of-the-week_.
 * 
 * Examples:
 *     var job1 = new CronJob('* * * * * ls -l / #comment');
 *     var job2 = new CronJob(null, 'ls -l /', 'comment');
 *
 * @param {String|null} __line__
 * @param {String} __[command]__
 * @param {String} __[comment]__
 */
function CronJob(line, c, m) {
    var self    = this,
        command = null,
        comment = null,
        valid   = false,
        slots   = [],
        special = false;
    
    
    /**
     * Returns true if this cron job is valid.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].isValid());
     *         }
     *     });
     *
     * @return {Boolean}
     */
    this.isValid = function() {
        return valid;
    }
    /**
     * Renders the object to a string as it would be written to the system.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].render());
     *         }
     *     });
     *
     * @return {String}
     */
    this.render = function() {
        var time = '';
        
        if (special) {
            time = special;
        }
        else {
            var tokens = [];
            
            for (var i = 0; i < 5; i++) {
                tokens.push(slots[i].toString());
            }
            
            time = tokens.join(' ');
        }
        
        var keys    = getKeys.call(SPECIALS),
            vals    = getVals.call(SPECIALS),
            timeIdx = vals.indexOf(time);
        
        if (timeIdx >=0 ) {
            time = '@' + keys[timeIdx];
        }
        
        var result = time + ' ' + command.toString()
        if (comment.toString() != '') {
            result += ' #' + comment.toString();
        }
        
        return result;
    }
    /**
     * Sets the cron job to every reboot instead of a time pattern.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var command = '/usr/bin/env echo "starting some service..."';
     *             jobs    = tab.findCommand(command);
     *         tab.remove(jobs);
     *         
     *         var job = tabs.create(command);
     *         job.everyReboot();
     *     });
     */
    this.everyReboot = function() {
        this.clear();
        
        special = '@reboot';
    }
    /**
     * Clears all time slots. Calling this method amounts to setting the time to '* * * * *'.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].clear());
     *         }
     *     });
     */
    this.clear = function() {
        special = false;
        
        for (var i = 0; i < slots.length; i++) {
            slots[i].clear();
        }
    }
    /**
     * Returns the minute time slot.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].minute().render());
     *         }
     *     });
     *
     * @return {TimeSlot}
     */
    this.minute = function() {
        return slots[0];
    }
    /**
     * Returns the hour time slot.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].hour().render());
     *         }
     *     });
     *
     * @return {TimeSlot}
     */
    this.hour = function() {
        return slots[1];
    }
    /**
     * Returns the day-of-the-month time slot.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].dom().render());
     *         }
     *     });
     *
     * @return {TimeSlot}
     */
    this.dom = function() {
        return slots[2];
    }
    /**
     * Returns the month time slot.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].month().render());
     *         }
     *     });
     *
     * @return {TimeSlot}
     */
    this.month = function() {
        return slots[3];
    }
    /**
     * Returns the day-of-the-week time slot.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].dow().render());
     *         }
     *     });
     *
     * @return {TimeSlot}
     */
    this.dow = function() {
        return slots[4];
    }
    /**
     * Command getter/setter.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].command('new command'));
     *         }
     *     });
     *
     * @param {String} __[command]__
     * @return {String}
     */
    this.command = function(c) {
        if (c) {
            command = new CronCommand(c.toString());
        }
        
        return command.toString();
    }
    /**
     * Comment getter/setter.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].comment('new comment'));
     *         }
     *     });
     *
     * @param {String} __[comment]__
     * @return {String}
     */
    this.comment = function(c) {
        if (c) {
            comment = new CronComment(c.toString());
        }
        
        return comment.toString();
    }
    /**
     * Renders the object to a string as it would be written to the system. See __render__.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].toString());
     *         }
     *     });
     *
     * @return {String}
     */
    this.toString = function() {
        return this.render();
    }
    
    
    /**
     * Populates the time slots with TimeSlot objects. Call this method ONLY from __init__!
     *
     * @param {Array[String]} __[tokens]__ string tokens to parse
     * 
     * @api private
     */
    function setSlots(tokens) {
        slots = [];
        
        for (var i = 0; i < 5; i++) {
            var info  = SINFO[i],
                value = (tokens && tokens[i] || null),
                name  = info.name,
                min   = info.min,
                max   = info.max,
                enumm = info.enumm,
                slot  = new TimeSlot(name, min, max, enumm, value);
            
            slots.push(slot);
        }
    }
    /**
     * Initializes a new CronJob object.
     *
     * @api private
     */
    function init() {
        setSlots();
        
        if (line) {
            var result = line.match(ITEMREX);
            
            if (result && result.length > 0) {
                command = new CronCommand(result[6]);
                comment = new CronComment(result[8] || '');
                valid   = true;
                
                setSlots(result.slice(1,6));
            }
            else if (line.indexOf('@') < line.indexOf('#') || line.indexOf('#') == -1) {
                var result = line.match(SPECREX);
                
                if (result && result.length > 0 && SPECIALS[result[1]]) {
                    command = new CronCommand(result[2]);
                    comment = new CronComment(result[4] || '');
                    
                    var value = SPECIALS[result[1]];
                    if (value.indexOf('@') >= 0) {
                        special = value;
                    }
                    else {
                        setSlots(value.split(' '));
                    }
                    valid = true;
                }
            }
        }
        else if (c) {
            valid   = true;
            command = new CronCommand(c && c.toString() || '');
            comment = new CronComment(m && m.toString() || '');
        }
    }
    
    init();
}


/**
 * @class TimeSlot
 * A JavaScript representation of a time slot (e.g. minute, hour, month). Each slot has zero or
 * more time ranges coresponding to the comma separated list in the cron sytax 
 * (e.g. _* / 4_, _10_, 5-15/2).
 * 
 * Examples:
 *     var enumm = ['jan','feb','mar','apr',
 *                 'may','jun','jul','aug',
 *                 'sep','oct','nov','dec'];
 *
 *     var slot1 = new TimeSlot('Month', 1, 12, enumm);
 *     var slot2 = new TimeSlot('Minute', 0, 59, null, '');
 *
 * @param {String} __name__ (e.g 'Minute', 'Month')
 * @param {Number} __min__ minimum value
 * @param {Number} __max__ maximum value
 * @param {Object|null} __enumm__ an object enumerating all possible values
 * @param {String|null} __value__ a value to parse (e.g '19-0/2,0-3')
 */
function TimeSlot(name, min, max, enumm, value) {
    var self  = this,
        name  = name,
        min   = min,
        max   = max,
        enumm = enumm,
        parts = [];
    
    
    /**
     * Returns the minimum value for this time slot.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].month().getMin());
     *         }
     *     });
     *
     * @return {Number}
     */
    this.getMin = function() {
        return min;
    }
    /**
     * Returns the maximum value for this time slot.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].month().getMax());
     *         }
     *     });
     *
     * @return {Number}
     */
    this.getMax = function() {
        return max;
    }
    /**
     * Returns the allowed value enumeration for this time slot.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].month().getEnum());
     *         }
     *     });
     *
     * @return {Object}
     */
    this.getEnum = function() {
        return enumm;
    }
    /**
     * Renders the object to a string as it would be written to the system.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].month().render());
     *         }
     *     });
     *
     * @return {Object}
     */
    this.render = function() {
        return parts.map(function(part) {
            return part.toString();
        }).join(',') || '*';
    }
    /**
     * Set this time slot to repeat every n units e.g. _* / n_
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             // every other month
     *             jobs[i].month().every(2);
     *         }
     *     });
     *
     * @param {Number} __number__
     * @return {TimeRange}
     */
    this.every = function(n) {
        try {
            var range = new TimeRange(self, '*/' + parseInt(n));
            parts.push(range);
            
            return range;
        }
        catch (e) {}
        
        return null;
    }
    /**
     * Set this time slot to repeat exactly at the specified values e.g. _0,12_
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             // at midnight and noon
     *             jobs[i].hour().on(0, 12);
     *             jobs[i].minute().on(0);
     *         }
     *     });
     *
     * @param {Number} __value+__ one or more values
     * @return {TimeRange}
     */
    this.on = function() {
        for (var i = 0; i < arguments.length; i++) {
            parts.push(arguments[i]);
        }
    }
    /**
     * Set this time slot to repeat between from and to e.g. _from - to_
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             // business hours
     *             jobs[i].hour().during(9, 17);
     *         }
     *     });
     *
     * @param {Number} __from__
     * @param {Number} __to__
     * @return {TimeRange}
     */
    this.during = function(from, to) {
        try {
            var range = new TimeRange(self, from + '-' + to);
            parts.push(range);
            
            return range;
        }
        catch (e) {}
        
        return null;
    }
    /**
     * Clears this time slot. Calling this method amounts to setting the slot to '*'.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].month().clear());
     *         }
     *     });
     */
    this.clear = function() {
        parts = [];
    }
    /**
     * Renders the object to a string as it would be written to the system. See __render__.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].month().toString());
     *         }
     *     });
     *
     * @return {String}
     */
    this.toString = function() {
        return this.render();
    }
    
    
    /**
     * Initializes a new TimeSlot object.
     *
     * @api private
     */
    function init() {
        if (value) {
            var tokens = value.split(',');
            for (var i = 0; i < tokens.length; i++) {
                var token = tokens[i];
                
                if (token.indexOf('/') > 0 || token.indexOf('-') > 0 || token == '*') {
                    var range = new TimeRange(self, token);
                    parts.push(range);
                }
                else {
                    var lPart    = token.toLowerCase(),
                        enummIdx = (enumm || []).indexOf(lPart);
                    
                    if (enummIdx >= 0) {
                        token = enummIdx;
                    }
                        
                    var iPart = parseInt(token);
                    if (iPart !== iPart) {
                        throw {message:'Unknown cron time part for ' + name + ': ' + token};
                    }
                    
                    parts.push(iPart);
                }
            }
        }
    }
    
    init();
}


/**
 * @class TimeRange
 * A JavaScript representation of a time range. Each range has a _from_, _to_, and _step_ values.
 * 
 * Examples:
 *     var enumm = ['jan','feb','mar','apr',
 *                 'may','jun','jul','aug',
 *                 'sep','oct','nov','dec'];
 *
 *     var slot   = new TimeSlot('Month', 1, 12, enumm);
 *     var range1 = new TimeRange(slot, '* / 2'); // every other month
 *     var range2 = new TimeRange(slot, 'jun - sep'); // every summer
 *
 * @param {TimeSlot} __slot__ The owner time slot object
 * @param {String} __range__ The range string e.g. _* / 2_, _jun - sep_
 */
function TimeRange(s, range) {
    var self  = this,
        slot  = s,
        from  = null,
        to    = null,
        step  = 1;
    
    
    /**
     * Renders the object to a string as it would be written to the system.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].hour().during(9, 17).render());
     *         }
     *     });
     *
     * @return {String}
     */
    this.render = function() {
        var value = '*';
        
        if (from > slot.getMin() || to < slot.getMax()) {
            value = from + '-' + to;
        }
        if (step != 1) {
            value += '/' + step;
        }
        
        return value;
    }
    /**
     * Set the step value for this range.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             // every other business hour
     *             jobs[i].hour().during(9, 17).every(2);
     *         }
     *     });
     */
    this.every = function(value) {
        step = parseInt(value);
    }
    /**
     * Renders the object to a string as it would be written to the system. See __render__.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].hour().during(9, 17).toString());
     *         }
     *     });
     *
     * @return {String}
     */
    this.toString = function() {
        return this.render();
    }
    
    
    /**
     * Converts a string value representing a range limit to an integer.
     *
     * @param {String} __value__ e.g. _5_,_mon_,_jan_
     * @return {Number}
     *
     * @api private
     */
    function cleanValue(value) {
        var sValue   = String(value),
            lValue   = sValue.toLowerCase(),
            enummIdx = (slot.getEnum() || []).indexOf(lValue);
        
        if (enummIdx >= 0) {
            value = enummIdx;
        }
        
        var iValue = parseInt(value);
        if (iValue >= slot.getMin() && iValue <= slot.getMax()) {
            return iValue
        }
        
        return null;
    }
    
    /**
     * Initializes a new TimeRange object.
     *
     * @api private
     */
    function init() {
        if (!range) {
            range = '*';
        }
        
        if (range.indexOf('/') > 0) {
            var tokens = range.split('/');
            
            range = tokens[0];
            step  = tokens[1];
        }
        
        if (range.indexOf('-') > 0) {
            var tokens = range.split('-');
            
            from = cleanValue(tokens[0]);
            to   = cleanValue(tokens[1]);
            
            if (from == null) {
                throw {message:'Invalid range value ' + tokens[0]};
            }
            else if (to == null) {
                throw {message:'Invalid range value ' + tokens[1]};
            }
        }
        else if (range == '*') {
            from = slot.getMin();
            to   = slot.getMax();
        }
        else {
            throw {message:'Unknown time range value ' + range};
        }
    }
    
    init();
}


/**
 * @class CronCommand
 * A JavaScript representation of the command part of a cron job.
 * 
 * Examples:
 *     var command = new CronCommand('ls -l /');
 *
 * @param {String} __line__
 */
function CronCommand(line) {
    var command = line;
    
    
    /**
     * Returns true if the pattern that was passed matches this command.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             // true
     *             console.log(jobs[i].command().match('ls -l /'));
     *         }
     *     });
     *
     * @param {String|RegEx} __pattern__
     * @return {Boolean}
     */
    this.match = function(pattern) {
        if ((pattern instanceof String) == true && command.indexOf(pattern) >= 0) {
            return true;
        }
        if ((pattern instanceof RegEx) == true) {
            return pattern.test(command);
        }
        
        return false;
    }
    /**
     * Renders the object to a string as it would be written to the system.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findCommand('ls -l /');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].command().toString());
     *         }
     *     });
     *
     * @return {String}
     */
    this.toString = function() {
        return command;
    }
}


/**
 * @class CronComment
 * A JavaScript representation of the inline comment part of a cron job.
 * 
 * Examples:
 *     var comment = new CronComment('run this on the weekend');
 *
 * @param {String} __line__
 */
function CronComment(line) {
    var comment = line;
    
    
    /**
     * Returns true if the pattern that was passed matches this comment.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findComment('run this on the weekend');
     *         for (var i = 0; i < jobs.length; i++) {
     *             // true
     *             console.log(jobs[i].comment().match('run this on the weekend'));
     *         }
     *     });
     *
     * @param {String|RegEx} __pattern__
     * @return {Boolean}
     */
    this.match = function(pattern) {
        if ((pattern instanceof String) == true && comment.indexOf(pattern) >= 0) {
            return true;
        }
        if ((pattern instanceof RegEx) == true) {
            return pattern.test(comment);
        }
        
        return false;
    }
    /**
     * Renders the object to a string as it would be written to the system.
     * 
     * Examples:
     *     new CronTab(function(err, tab) {
     *         if (err) { console.log(err); process.exit(1); }
     *         
     *         var jobs = tab.findComment('run this on the weekend');
     *         for (var i = 0; i < jobs.length; i++) {
     *             console.log(jobs[i].comment().toString());
     *         }
     *     });
     *
     * @return {String}
     */
    this.toString = function() {
        return comment;
    }
}


/* @api private */
function getKeys() {
    return Object.keys(this);
}

function getVals() {
    var keys = getKeys.call(this),
        vals = [];
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        vals.push(this[key]);
    }
    
    return vals;
}


// public API
module.exports = {
    load:function() {
        if (typeof arguments[0] == 'string' && typeof arguments[1] == 'function') {
            new CronTab(arguments[0], arguments[1]);
        }
        else if (typeof arguments[0] == 'function') {
            new CronTab('', arguments[0]);
        }
    }
};


