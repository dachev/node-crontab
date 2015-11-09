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
   *         var jobs = tab.jobs({comment:'run this on the weekend'});
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
    if (_.isString(pattern) && !!~command.indexOf(pattern)) {
      return true;
    }
    if (_.isRegExp(pattern)) {
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
   *         var jobs = tab.jobs({comment:'run this on the weekend'});
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

module.exports = CronComment;
