const COMMAND  = '/usr/bin/crontab';
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
	{ 'name' : 'Minutes',      'max' : 59, 'min' : 0 },
	{ 'name' : 'Hours',        'max' : 23, 'min' : 0 },
	{ 'name' : 'Day of Month', 'max' : 31, 'min' : 1 },
	{ 'name' : 'Month',        'max' : 12, 'min' : 1, 'enum' : MONTH_ENUM },
	{ 'name' : 'Day of Week',  'max' : 7,  'min' : 0, 'enum' : WEEK_ENUM },
];

var Spawn = require('child_process').spawn,
    Exec  = require('child_process').exec;

// Crontab object which can access any time based cron using the standard.
function CronTab(u, cb) {
    var self   = this;
        user   = u || '',
        root   = (process.getuid() == 0),
        lines  = [],
        crons  = [];
    
    load(cb);
    
    
    // accessor
    this.getItems = function() {
        return crons;
    }
    // Write the crontab to the system. Saves all information
    this.save = function(cb) {
        var crontab = Spawn(COMMAND, ['-', userExecute().trim()]);
        
        crontab.on('exit', function (code) {
            if (code == 0) {
                cb(null, self);
            }
            else {
                cb({message:'Failed to save crontabs'}, self);
            }
        });
        
        crontab.stdin.write(this.render());
        crontab.stdin.end();
    }
    // Render this crontab as it would be in the crontab.
    this.render = function() {
        var tokens = [];
        
        for (var i = 0; i < lines.length; i++) {
            var cron = lines[i];
            
            if (cron.isValid && !cron.isValid()) {
                tokens.push('# ' + cron.toString());
                continue;
            }
            
            tokens.push(cron.toString());
        }
        
        return tokens.join('\n').trim() + '\n';
    }
    // Create a new cron with a command and comment. Returns the new CronItem object.
    this.create = function(command, comment) {
        var item = makeItem(null, command, comment);
        
        if (item != null) {
            crons.push(item);
            lines.push(item);
            
            return item;
        }
    }
    // Return a list of crons using a command.
    this.findCommand = function(command) {
        var results = [];
        
        for (var i = 0; i < crons.length; i++) {
            var cron = crons[i];
            
            if (cron.getCommand().match(command)) {
                results.push(cron);
            }
        }
        
        return results;
    }
    // Removes all crons using the provided command.
    this.removeAll = function(command) {
        var results = this.findCommand(command);
        
        for (var i = 0; i < results.length; i++) {
            var result = results[i];
            this.remove(result);
        }
        
        truncateLines();
    }
    //Remove a selected cron from the crontab.
    this.remove = function(item) {
        var oldCrons = crons;
        var oldLines = lines;
        
        crons = [];
        lines = [];
        
        for (var i = 0; i < oldCrons.length; i++) {
            var cron = oldCrons[i];
            
            if (cron != item) {
                crons.push(cron);
            }
        }
        for (var i = 0; i < oldLines.length; i++) {
            var line = oldLines[i];
            
            if (line != item) {
                lines.push(line);
            }
        }
    }
    
    
    // Read in the crontab from the system into the object, called
    // automatically when listing or using the object. use for refresh.
    function load(cb) {
        crons = [];
        lines = [];
        
        Exec(COMMAND + ' -l ' + userExecute(), function(err, stdout, stderr) {
            if (err) {
                if (!err.message || err.message.indexOf('no crontab for ') < 0) {
                    cb(err, null);
                    return;
                }
                // The child exited with "no crontab for user" error. We are OK with that.
            }
            
            var tokens = stdout.split('\n');
            for (var i = 0; i < tokens.length; i++) {
                var token = tokens[i],
                    item  = makeItem(token);
                
                if (item != null && item.isValid()) {
                    crons.push(item);
                    lines.push(item);
                }
                else {
                    lines.push(token);
                }
            }
            
            truncateLines();
            
            cb(null, self);
        });
    }
    // User command switches to append to the read and write commands
    function userExecute() {
        return (user) ? '-u ' + user : '';
    }
    function makeItem(line, command, meta) {
        try {
            return new CronItem(line, command, meta);
        } catch(e) {}
        
        return null;
    }
    // Removes all empty lines from the end
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


// An item which objectifies a single line of a crontab and
// may be considered to be a cron job object.
function CronItem(line, c, m) {
    var self    = this,
        command = null,
        meta    = m || '',
        valid   = false,
        slots   = [],
        special = false;
    
    setSlots();
    
    if (line) {
        var result = line.match(ITEMREX);
        
        if (result && result.length > 0) {
            command = new CronCommand(result[6]);
            meta    = result[8];
            valid   = true;
            
            setSlots(result);
        }
        else if (line.indexOf('@') < line.indexOf('#') || line.indexOf('#') == -1) {
            var result = line.match(SPECREX);
            
            if (result && result.length > 0 && SPECIALS[result[1]]) {
                command = new CronCommand(result[2]);
                meta    = result[3];
                
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
        command = new CronCommand(c.toString());
    }
    
    
    // Accessor
    this.getCommand = function() {
        return command;
    }
    // Return true if this slot set is valid
    this.isValid = function() {
        return valid;
    }
    // Render this set slot to a string
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
        
        var keys = getKeys.call(SPECIALS),
            vals = getVals.call(SPECIALS);
        
        if (time in vals) {
            time = '@' + keys[vals.indexOf(time)];
        }
    
        var result = time + ' ' + command.toString()
        if (meta) {
            result += ' #' + meta;
        }
        
        return result;
    }
    // Set to every reboot instead of a time pattern
    this.everyReboot = function() {
        special = '@reboot';
    }
    // Clear the special and set values
    this.clear = function() {
        special = null;
        
        for (var i = 0; i < slots.length; i++) {
            slots[i].clear();
        }
    }
    // Return the minute slot
    this.minute = function() {
        return slots[0];
    }
    // Return the hour slot
    this.hour = function() {
        return slots[1];
    }
    // Return the day-of-the month slot
    this.dom = function() {
        return slots[2];
    }
    // Return the month slot
    this.month = function() {
        return slots[3];
    }
    // Return the day of the week slot
    this.dow = function() {
        return slots[4];
    }
    this.toString = function() {
        return this.render();
    }
    
    
    // Set the values of this slot set. Call this method ONLY from the CronItem constructor!
    function setSlots(o) {
        slots = [];
        
        for (var i = 0; i < 5; i++) {
            var info  = SINFO[i],
                value = (o && o[i+1] || null),
                slot  = new CronSlot(info.name, info.min, info.max, info.enum, value);
            
            slots.push(slot);
        }
    }
}


// Cron slot object which shows a time pattern
function CronSlot(name, min, max, enum, value) {
    var self  = this,
        name  = name,
        min   = min,
        max   = max,
        enum  = enum,
        parts = [];
    
    if (value) {
        var tokens = value.split(',');
        for (var i = 0; i < tokens.length; i++) {
            var token = tokens[i];
            
            if (token.indexOf('/') > 0 || token.indexOf('-') > 0 || token == '*') {
                var range = new CronRange(this, token);
                parts.push(range);
            }
            else {
                var lPart   = token.toLowerCase(),
                    enumIdx = (enum || []).indexOf(lPart);
                
                if (enumIdx >= 0) {
                    token = enumIdx;
                }
                    
                var iPart = parseInt(token);
                if (iPart !== iPart) {
                    throw {message:'Unknown cron time part for ' + name + ': ' + token};
                }
                
                parts.push(iPart);
            }
        }
    }
    
    
    // accessors
    this.getMin = function() {
        return min;
    }
    this.getMax = function() {
        return max;
    }
    this.getEnum = function() {
        return enum;
    }
    // Return the slot rendered as a crontab
    this.render = function() {
        var result = [];
        
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            
            result.push(String(part));
        }
        
        return result.join(',') || '*';
    }
    // Set the every X units value
    this.every = function(n) {
        try {
            var range  = new CronRange(this, '*/' + parseInt(n));
            parts = [range];
        }
        catch (e) {}
    }
    // Set the on the time value.
    this.on = function() {
        for (var i = 0; i < arguments.length; i++) {
            parts.push(arguments[i]);
        }
    }
    // Set the During value, which sets a range
    this.during = function(from, to) {
        try {
            var range = new CronRange(this, from + '-' + to);
            parts.push(range);
            
            return range;
        }
        catch (e) {}
        
        return null;
    }
    // clear the slot ready for new vaues
    this.clear = function() {
        parts = [];
    }
    this.toString = function() {
        return this.render();
    }
}


// A range between one value and another for a time range
function CronRange(slot, range) {
    var self  = this,
        slot  = slot,
        from  = null,
        to    = null,
        step  = 1;
    
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
        
        return;
    }
    else if (range == '*') {
        from = slot.getMin();
        to   = slot.getMax();
        
        return;
    }
    
    throw {message:'Unknown cron range value ' + range};
    
    
    // Render the ranged value for a cronjob
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
    // Set the sequence value for this range
    this.every = function(value) {
        step = parseInt(value);
    }
    this.toString = function() {
        return this.render();
    }
    
    // private
    function cleanValue(value) {
        var sValue  = String(value),
            lValue  = sValue.toLowerCase(),
            enumIdx = (slot.getEnum() || []).indexOf(lValue);
        
        if (enumIdx >= 0) {
            value = enumIdx;
        }
        
        var iValue = parseInt(value);
        if (iValue >= slot.getMin() && iValue <= slot.getMax()) {
            return iValue
        }
        
        return null;
    }
}


// Reprisent a cron command as an object.
function CronCommand(line) {
    var command = line;
    
    // Match the command given
    this.match = function(line) {
        if (command.indexOf(line) >= 0) {
            return true;
        }
        
        return false;
    }
    this.toString = function() {
        return command;
    }
}


// helpers
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


