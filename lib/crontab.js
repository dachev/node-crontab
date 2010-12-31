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
function CronTab(user, cb) {
    var self   = this;
    
    self.user  = user || '';
    self.root  = (process.getuid() == 0);
    self.lines = [];
    self.crons = [];
    
    self.load(cb);
}
// Read in the crontab from the system into the object, called
// automatically when listing or using the object. use for refresh.
CronTab.prototype.load = function(cb) {
    var self = this;
    
    self.crons = [];
    self.lines = [];
    
    Exec(COMMAND + ' -l ' + this.userExecute(), function(err, stdout, stderr) {
        if (err) {
            if (!err.message || err.message.indexOf('no crontab for ') < 0) {
                cb(err, null);
                return;
            }
            // The child exited with "no crontab for user" error. We are fine with that.
        }
        
        var lines = stdout.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i],
                item = self.makeItem(line);
            
            if (item != null && item.isValid()) {
                self.crons.push(item);
                self.lines.push(item);
            }
            else {
                self.lines.push(line);
            }
        }
        
        self.truncateLines();
        
        cb(null, self);
    });
}
CronTab.prototype.makeItem = function(line, command, meta) {
    try {
        return new CronItem(line, command, meta);
    } catch(e) {}
    
    return null;
}
// Removes all empty lines from the end
CronTab.prototype.truncateLines = function() {
    var undefined,
        line = this.lines.pop();
    
    while (line != undefined && line.toString().trim() == '') {
        line = this.lines.pop();
    }
    
    if (line != undefined) {
        this.lines.push(line);
    }
}
// Write the crontab to the system. Saves all information
CronTab.prototype.save = function(cb) {
    var self    = this,
        crontab = Spawn(COMMAND, ['-', self.userExecute().trim()]);
    
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
    var item = this.makeItem(null, command, comment);
    
    if (item != null) {
        this.crons.push(item);
        this.lines.push(item);
        
        return item;
    }
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
// Removes all crons using the provided command.
CronTab.prototype.removeAll = function(command) {
    var items = this.findCommand(command);
    
    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        this.remove(item);
    }
    
    this.truncateLines();
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


// An item which objectifies a single line of a crontab and
// may be considered to be a cron job object.
function CronItem(line, command, meta) {
    this.command = null;
    this._meta   = meta || '';
    this.valid   = false;
    this.slots   = [];
    this.special = false;
    
    this.setSlots();
    
    if (line) {
        var result = line.match(ITEMREX);
        
        if (result && result.length > 0) {
            this.command = new CronCommand(result[6]);
            this._meta   = result[8];
            this.valid   = true;
            
            this.setSlots(result);
        }
        else if (line.indexOf('@') < line.indexOf('#') || line.indexOf('#') == -1) {
            var result = line.match(SPECREX);
            
            if (result && result.length > 0 && SPECIALS[result[1]]) {
                this.command = new CronCommand(result[2]);
                this._meta   = result[3];
                
                var value = SPECIALS[result[1]];
                if (value.indexOf('@') >= 0) {
                    this.special = value;
                }
                else {
                    this.setSlots(value.split(' '));
                }
                this.valid = true;
            }
        }
    }
    else if (command) {
        this.valid   = true;
        this.command = new CronCommand(command.toString());
    }
}
// Set the values of this slot set
// Call this method ONLY from the CronItem constructor!
CronItem.prototype.setSlots = function(o) {
    this.slots = [];
    
    for (var i = 0; i < 5; i++) {
        var info  = SINFO[i],
            value = (o && o[i+1] || null),
            slot  = new CronSlot(info.name, info.min, info.max, info.enum, value);
        
        this.slots.push(slot);
    }
}
// Return true if this slot set is valid
CronItem.prototype.isValid = function() {
    return this.valid;
}
// Render this set slot to a string
CronItem.prototype.render = function() {
    var time = '';
    
    if (!this.special) {
        var slots = [];
        
        for (var i = 0; i < 5; i++) {
            slots.push(this.slots[i].toString());
        }
        
        time = slots.join(' ');
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
    
    for (var i = 0; i < this.slots.length; i++) {
        var slot = this.slots[i];
        slot.clear();
    }
}
// Return the minute slot
CronItem.prototype.minute = function() {
    return this.slots[0];
}
// Return the hour slot
CronItem.prototype.hour = function() {
    return this.slots[1];
}
// Return the day-of-the month slot
CronItem.prototype.dom = function() {
    return this.slots[2];
}
// Return the month slot
CronItem.prototype.month = function() {
    return this.slots[3];
}
// Return the day of the week slot
CronItem.prototype.dow = function() {
    return this.slots[4];
}
CronItem.prototype.toString = function() {
    return this.render();
}


// Cron slot object which shows a time pattern
function CronSlot(name, min, max, enum, value) {
    this.name  = name;
    this.min   = min;
    this.max   = max;
    this.enum  = enum;
    this.parts = [];
    
    if (value) {
        this.parts = [];
        
        var parts = value.split(',');
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i];
            
            if (part.indexOf('/') > 0 || part.indexOf('-') > 0 || part == '*') {
                var range = new CronRange(this, part);
                this.parts.push(range);
            }
            else {
                var lPart   = part.toLowerCase(),
                    enumIdx = (this.enum || []).indexOf(lPart);
                
                if (enumIdx >= 0) {
                    part = enumIdx;
                }
                    
                var iPart = parseInt(part);
                if (iPart !== iPart) {
                    throw {message:'Unknown cron time part for ' + this.name + ': ' + part};
                }
                
                this.parts.push(iPart);
            }
        }
    }
}
// Return the slot rendered as a crontab
CronSlot.prototype.render = function() {
    var result = [];
    
    for (var i = 0; i < this.parts.length; i++) {
        var part = this.parts[i];
        
        result.push(String(part));
    }
    
    return result.join(',') || '*';
}
// Set the every X units value
CronSlot.prototype.every = function(n) {
    try {
        var range  = new CronRange(this, '*/' + parseInt(n));
        this.parts = [range];
    }
    catch (e) {}
}
// Set the on the time value.
CronSlot.prototype.on = function() {
    for (var i = 0; i < arguments.length; i++) {
        var argument = arguments[i];
        
        this.parts.push(argument);
    }
}
// Set the During value, which sets a range
CronSlot.prototype.during = function(from, to) {
    try {
        var range = new CronRange(this, from + '-' + to);
        this.parts.push(range);
        
        return range;
    }
    catch (e) {}
}
// clear the slot ready for new vaues
CronSlot.prototype.clear = function() {
    this.parts = [];
}
CronSlot.prototype.toString = function() {
    return this.render();
}


// A range between one value and another for a time range
function CronRange(slot, range) {
    this.slot  = slot;
    this.from  = null;
    this.to    = null;
    this.step  = 1;
    
    if (!range) {
        range = '*';
    }
    
    if (value.indexOf('/') > 0) {
        var tokens = value.split('/');
        
        value     = tokens[0];
        this.step = tokens[1];
    }
    
    if (value.indexOf('-') > 0) {
        var tokens = value.split('-');
        
        this.from = this.cleanValue(tokens[0]);
        this.to   = this.cleanValue(tokens[1]);
        
        if (this.from == null) {
            throw {message:'Invalid range value ' + tokens[0]};
        }
        else if (this.to == null) {
            throw {message:'Invalid range value ' + tokens[1]};
        }
        
        return;
    }
    else if (value == '*') {
        this.from = this.slot.min;
        this.to   = this.slot.max;
        
        return;
    }
    
    throw {message:'Unknown cron range value ' + value};
}
// Render the ranged value for a cronjob
CronRange.prototype.render = function() {
    var value = '*';
    
    if (this.from > this.slot.min || this.to < this.slot.max) {
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
        enumIdx = (this.slot.enum || []).indexOf(lValue);
    
    if (enumIdx >= 0) {
        value = enumIdx;
    }
    
    var iValue = parseInt(value);
    if (iValue >= this.slot.min && iValue <= this.slot.max) {
        return iValue
    }
    
    return null;
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

module.exports = {
    load:function(user, cb) { new CronTab(user, cb); }
};


