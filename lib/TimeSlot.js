/**
 * Imports
 */
var TimeRange = require('./TimeRange');

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
  var self  = this;
  var name  = name;
  var min   = min;
  var max   = max;
  var enumm = enumm;
  var parts = [];
  
  
  /**
   * Returns the minimum value for this time slot.
   * 
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *         
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   * Set this time slot to repeat exactly at the specified values e.g. _0,12_
   * 
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *         
   *         var jobs = tab.jobs({command:'ls -l /'});
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
  this.at = this.on;
  this.in = this.on;
  /**
   * Set this time slot to repeat between from and to e.g. _from - to_
   * 
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *         
   *         var jobs = tab.jobs({command:'ls -l /'});
   *         for (var i = 0; i < jobs.length; i++) {
   *             // business hours
   *             jobs[i].hour().between(9, 17);
   *         }
   *     });
   *
   * @param {Number} __from__
   * @param {Number} __to__
   * @return {TimeRange}
   */
  this.between = function(from, to) {
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
   *         var jobs = tab.jobs({command:'ls -l /'});
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
          var lPart    = token.toLowerCase();
          var enummIdx = (enumm || []).indexOf(lPart);
          
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

module.exports = TimeSlot;
