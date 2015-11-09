/**
 * Constants
 */
const ITEMREX = /^\s*([^@#\s]+)\s+([^@#\s]+)\s+([^@#\s]+)\s+([^@#\s]+)\s+([^@#\s]+)\s+([^#\n]*)(\s+#\s*([^\n]*)|$)/;
const SPECREX = /@(\w+)\s([^#\n]*)(\s+#\s*([^\n]*)|$)/;

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
const WEEK_ENUM = ['sun','mon','tue','wed','thu','fri','sat','sun'];
const SINFO = [
  { 'name' : 'Minute',       'max' : 59, 'min' : 0 },
  { 'name' : 'Hours',        'max' : 23, 'min' : 0 },
  { 'name' : 'Day of Month', 'max' : 31, 'min' : 1 },
  { 'name' : 'Month',        'max' : 12, 'min' : 1, 'enumm' : MONTH_ENUM },
  { 'name' : 'Day of Week',  'max' : 7,  'min' : 0, 'enumm' : WEEK_ENUM },
];

/**
 * Imports
 */
var TimeSlot    = require('./TimeSlot');
var CronCommand = require('./CronCommand');
var CronComment = require('./CronComment');

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
  var self    = this;
  var command = null;
  var comment = null;
  var valid   = false;
  var slots   = [];
  var special = false;
  
  
  /**
   * Returns true if this cron job is valid.
   * 
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *         
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
    
    var keys    = getKeys.call(SPECIALS);
    var vals    = getVals.call(SPECIALS);
    var timeIdx = vals.indexOf(time);
    
    if (timeIdx >=0 ) {
      time = '@' + keys[timeIdx];
    }
    
    var result = time + ' ' + command.toString();
    if (comment.toString() != '') {
      result += ' #' + comment.toString();
    }
    
    return result;
  }
  /**
   * Clears all time slots. Calling this method amounts to setting the time to '* * * * *'.
   * 
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *         
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
      var info  = SINFO[i];
      var value = (tokens && tokens[i] || null);
      var name  = info.name;
      var min   = info.min;
      var max   = info.max;
      var enumm = info.enumm;
      var slot  = new TimeSlot(name, min, max, enumm, value);
      
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
    else {
      throw 'Expected either a canonical crontab line or a command string';
    }
  }
  
  init();
}

/* @api private */
function getKeys() {
  return Object.keys(this);
}

function getVals() {
  var keys = getKeys.call(this);
  var vals = [];
  
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    vals.push(this[key]);
  }
  
  return vals;
}

module.exports = CronJob;
