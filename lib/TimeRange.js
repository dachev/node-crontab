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
  var self  = this;
  var slot  = s;
  var from  = null;
  var to    = null;
  var step  = 1;
  
  
  /**
   * Renders the object to a string as it would be written to the system.
   * 
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *         
   *         var jobs = tab.jobs({command:'ls -l /'});
   *         for (var i = 0; i < jobs.length; i++) {
   *             console.log(jobs[i].hour().between(9, 17).render());
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
   *         var jobs = tab.jobs({command:'ls -l /'});
   *         for (var i = 0; i < jobs.length; i++) {
   *             // every other business hour
   *             jobs[i].hour().between(9, 17).every(2);
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
   *         var jobs = tab.jobs({command:'ls -l /'});
   *         for (var i = 0; i < jobs.length; i++) {
   *             console.log(jobs[i].hour().between(9, 17).toString());
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
    var sValue   = String(value);
    var lValue   = sValue.toLowerCase();
    var enummIdx = (slot.getEnum() || []).indexOf(lValue);
    
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

module.exports = TimeRange;
