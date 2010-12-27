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
function CronTab(user) {
    var self   = this;
    
    this.user  = user || '';
    this.root  = (process.getuid() == 0);
    this.lines = [];
    this.crons = [];
    
    process.nextTick(function() {
        self.load();
    });
}
CronTab.prototype = new process.EventEmitter();
// Read in the crontab from the system into the object, called
// automatically when listing or using the object. use for refresh.
CronTab.prototype.load = function() {
    var self = this;
    
    this.crons = [];
    this.lines = [];
    
    Exec(this.readExecute(), function(err, stdout, stderr) {
        if (err) {
            if (!err.message || err.message.indexOf('no crontab for ') < 0) {
                self.emit('error', err, self);
                return;
            }
            // The child exited with "no crontab for user" error. We are fine with that.
        }
        
        var lines = stdout.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i],
                cron = new CronItem(self, line);
            
            if (cron.isValid()) {
                self.crons.push(cron);
                self.lines.push(cron);
            }
            else {
                self.lines.push(line.replace('\n',''));
            }
        }
        
        self.emit('loaded', self);
    });
}
// Write the crontab to the system. Saves all information
CronTab.prototype.save = function() {
    var self    = this,
        crontab = Spawn(COMMAND, ['-', self.userExecute().trim()]);
    
    crontab.on('exit', function (code) {
        if (code == 0) {
            self.emit('saved', self);
        }
        else {
            self.emit('error', {message:'Failed to save crontabs'}, self);
        }
    });
    
    crontab.stdin.write(this.render());
    crontab.stdin.end();
}
// Render this crontab as it would be in the crontab.
CronTab.prototype.render = function() {
    var crons = [];
    
    for (var i = 0; i < this.lines.length; i++) {
        var cron = this.lines[i];
        
        if (cron.isValid && !cron.isValid()) {
            crons.push('# ' + cron.toString());
            continue;
        }
        
        crons.push(cron.toString());
    }
    
    return crons.join('\n').trim() + '\n';
}
// Create a new cron with a command and comment. Returns the new CronItem object.
CronTab.prototype.create = function(command, comment) {
    var item = new CronItem(this, null, command, comment);
    
    this.crons.push(item);
    this.lines.push(item);
    
    return item;
}
// Return a list of crons using a command.
CronTab.prototype.findCommand = function(command) {
    var result = [];
    
    for (var i = 0; i < this.crons.length; i++) {
        var cron = this.crons[i];
        
        if (cron.command.match(command)) {
            result.push(cron);
        }
    }
    
    return result;
}
// Removes all crons using the stated command.
CronTab.prototype.removeAll = function(command) {
    var items = this.findCommand(command);
    
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        this.remove(item);
    }
}
//Remove a selected cron from the crontab.
CronTab.prototype.remove = function(item) {
    var crons = this.crons;
    var lines = this.lines;
    
    this.crons = [];
    this.lines = [];
    
    for (var i = 0; i < crons.length; i++) {
        var cron = crons[i];
        
        if (cron != item) {
            this.crons.push(cron);
        }
    }
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        
        if (line != item) {
            this.lines.push(line);
        }
    }
}
// User command switches to append to the read and write commands
CronTab.prototype.userExecute = function() {
    if (this.user) {
        return '-u ' + this.user;
    }
    
    return '';
}
// Returns the command line for reading a crontab
CronTab.prototype.readExecute = function() {
    return COMMAND + ' -l ' + this.userExecute();
}


// An item which objectifies a single line of a crontab and
// may be considered to be a cron job object.
function CronItem(tab, line, command, meta) {
    this.tab     = tab;
    this.command = null;
    this._meta   = meta || '';
    this.valid   = false;
    this.slices  = [];
    this.special = false;
    
    this.setSlices();
    
    if (line) {
        this.parse(line);
    }
    else if (command) {
        this.valid   = true;
        this.command = new CronCommand(command.toString());
    }
}
// Parse a cron line string and save the info as the objects
CronItem.prototype.parse = function(line) {
    var result = line.match(ITEMREX);
    
    if (result && result.length > 0) {
        this.command = new CronCommand(result[6]);
        this._meta   = result[8];
        this.valid   = true;
        
        this.setSlices(result);
    }
    else if (line.indexOf('@') < line.indexOf('#') || line.indexOf('#') == -1) {
        var result = line.match(SPECREX);
        
        if (result && result.length > 0 && SPECIALS[result[1]]) {
            this.command = new CronCommand(result[2]);
            this._meta   = result[3];
            
            var value = SPECIALS[result[1]];
            if (value.indexOf('@') >= 1) {
                this.special = value;
            }
            else {
                this.setSlices(value.split(' '));
            }
            this.valid = true;
        }
    }
}
// Set the values of this slice set
CronItem.prototype.setSlices = function(o) {
    this.slices = [];
    
    for (var i = 0; i < 5; i++) {
        var info  = SINFO[i],
            value = (o && o[i+1] || null),
            slice = new CronSlice(this, info.name, info.min, info.max, info.enum, value);
        
        this.slices.push(slice);
    }
}
// Return true if this slice set is valid
CronItem.prototype.isValid = function() {
    return this.valid;
}
// Render this set slice to a string
CronItem.prototype.render = function() {
    var time = '';
    
    if (!this.special) {
        var slices = [];
        
        for (var i = 0; i < 5; i++) {
            slices.push(this.slices[i].toString());
        }
        
        time = slices.join(' ');
    }
    
    var keys = getKeys.call(SPECIALS),
        vals = getVals.call(SPECIALS);
    
    if (this.special || time in vals) {
        if (this.special) {
            time = this.special;
        }
        else {
            time = '@' % keys[vals.indexOf(time)];
        }
    }

    var result = time + ' ' + this.command.toString(),
        meta   = this.meta();
    
    if (meta) {
        result += ' # ' + meta;
    }
    
    return result;
}
// Return or set the meta value to replace the set values
CronItem.prototype.meta = function(value) {
    if (value) {
        this._meta = value;
    }
    
    return this._meta;
}
// Set to every reboot instead of a time pattern
CronItem.prototype.everyReboot = function() {
    this.special = '@reboot';
}
// Clear the special and set values
CronItem.prototype.clear = function() {
    this.special = null;
    
    for (var i = 0; i < this.slices.length; i++) {
        var slice = this.slices[i];
        slice.clear();
    }
}
// Return the minute slice
CronItem.prototype.minute = function() {
    return this.slices[0];
}
// Return the hour slice
CronItem.prototype.hour = function() {
    return this.slices[1];
}
// Return the day-of-the month slice
CronItem.prototype.dom = function() {
    return this.slices[2];
}
// Return the month slice
CronItem.prototype.month = function() {
    return this.slices[3];
}
// Return the day of the week slice
CronItem.prototype.dow = function() {
    return this.slices[4];
}
CronItem.prototype.toString = function() {
    return this.render();
}


// Cron slice object which shows a time pattern
function CronSlice(item, name, min, max, enum, value) {
    this.item  = item,
    this.name  = name;
    this.min   = min;
    this.max   = max;
    this.enum  = enum;
    this.parts = [];
    
    this.value(value);
}
// Return the value of the entire slice.
CronSlice.prototype.value = function(value) {
    if (value) {
        this.parts = [];
        
        var parts = value.split(',');
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            
            if (part.indexOf('/') > 0 || part.indexOf('-') > 0 || part == '*') {
                this.parts.push(this.getRange(part));
            }
            else {
                var lPart   = part.toLowerCase(),
                    enumIdx = (this.enum || []).indexOf(lPart);
                
                if (enumIdx >= 0) {
                    part = enumIdx;
                }
                    
                var iPart = parseInt(part);
                if (iPart !== iPart) {
                    var err = {message:'Unknown cron time part for ' + this.name + ': ' + part};
                    this.item.tab.emit('error', err);
                    return;
                }
                
                this.parts.push(iPart);
            }
        }
    }
    
    return this.render();
}
// Return the slice rendered as a crontab
CronSlice.prototype.render = function() {
    var result = [];
    
    for (var i = 0; i < this.parts.length; i++) {
        var part = this.parts[i];
        
        result.push(String(part));
    }
    
    return result.join(',') || '*';
}
// Set the every X units value
CronSlice.prototype.every = function(n) {
    this.parts = [this.getRange('*/' + parseInt(n))];
}
// Set the on the time value.
CronSlice.prototype.on = function() {
    for (var i = 0; i < arguments.length; i++) {
        var argument = arguments[i];
        
        this.parts.push(argument);
    }
}
// Set the During value, which sets a range
CronSlice.prototype.during = function(from, to) {
    var range = this.getRange(from + '-' + to);
    
    this.parts.push(range);
    
    return range;
}
// clear the slice ready for new vaues
CronSlice.prototype.clear = function() {
    this.parts = [];
}
// Return a cron range for this slice
CronSlice.prototype.getRange = function(range) {
    return new CronRange(this, range);
}
CronSlice.prototype.toString = function() {
    return this.render();
}


// A range between one value and another for a time range
function CronRange(slice, range) {
    this.slice = slice;
    this.from  = null;
    this.to    = null;
    this.slice = slice;
    this.step  = 1;
    
    if (!range) {
        range = '*';
    }
    
    this.parse(range);
}
// Parse a ranged value in a cronjob
CronRange.prototype.parse = function(value) {
    if (value.indexOf('/') > 0) {
        var tokens = value.split('/');
        
        value     = tokens[0];
        this.step = tokens[1];
    }
    if (value.indexOf('-') > 0) {
        var tokens = value.split('-');
        
        this.from = this.cleanValue(tokens[0]);
        this.to   = this.cleanValue(tokens[1]);
    }
    else if (value == '*') {
        this.from = this.slice.min;
        this.to   = this.slice.max;
    }
    else {
        this.slice.item.tab.emit('error', {message:'Unknown cron range value ' + value});
        return;
    }
}
// Render the ranged value for a cronjob
CronRange.prototype.render = function() {
    var value = '*';
    
    if (this.from > this.slice.min || this.to < this.slice.max) {
        value = this.from + '-' + this.to;
    }
    if (this.step != 1) {
        value += '/' + this.step;
    }
    
    return value;
}
// Return a cleaned value of the ranged value
CronRange.prototype.cleanValue = function(value) {
    var sValue  = String(value),
        lValue  = sValue.toLowerCase(),
        enumIdx = (this.slice.enum || []).indexOf(lValue);
    
    if (enumIdx >= 0) {
        value = enumIdx;
    }
    
    var iValue = parseInt(value);
    if (iValue >= this.slice.min && iValue <= this.slice.max) {
        return iValue
    }
    
    this.slice.item.tab.emit('error', {message:'Invalid range value ' + value});
}
// Set the sequence value for this range
CronRange.prototype.every = function(value) {
    this.step = parseInt(value);
}
CronRange.prototype.toString = function() {
    return this.render();
}


// Reprisent a cron command as an object.
function CronCommand(line) {
    this.command = line;
}
// Match the command given
CronCommand.prototype.match = function(line) {
    if (this.command.indexOf(line) >= 0) {
        return true;
    }
    
    return false;
}
CronCommand.prototype.toString = function() {
    return this.command;
}

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

module.exports = CronTab;


