/**
 * Constants
 */
const ITEMREX = /^(\S+)=(.+)$/;

/**
 * @class CronVar
 * A JavaScript representation of a cron environment variable.
 * 
 * Examples:
 *     var env = new CronVar('MAIL=user@domain.org');
 *
 * @param {String} __line__
 */
function CronVar(line) {
  var self  = this;
  var name  = null;
  var val   = null;
  var valid = false;
  
  
  /**
   * Returns true if this env variable is valid.
   * 
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *         
   *         var vars = tab.vars({name:'MAIL'});
   *         for (var i = 0; i < vars.length; i++) {
   *             console.log(vars[i].isValid());
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
   *         var vars = tab.vars({name:'MAIL'});
   *         for (var i = 0; i < vars.length; i++) {
   *             console.log(vars[i].render());
   *         }
   *     });
   *
   * @return {String}
   */
  this.render = function() {
  	return name + '=' + val;
  }
  /**
   * Comment getter/setter.
   * 
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *         
   *         var vars = tab.vars({name:'MAIL'});
   *         for (var i = 0; i < vars.length; i++) {
   *             console.log(vars[i].name('PATH'));
   *         }
   *     });
   *
   * @param {String} __[name]__
   * @return {String}
   */
  this.name = function(c) {
    if (c) {
      name = ''+c;
    }
    
    return name;
  }
  /**
   * Comment getter/setter.
   * 
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *         
   *         var vars = tab.vars({name:'MAIL'});
   *         for (var i = 0; i < vars.length; i++) {
   *             console.log(vars[i].val('user@domain.org'));
   *         }
   *     });
   *
   * @param {String} __[val]__
   * @return {String}
   */
  this.val = function(c) {
    if (c) {
      val = ''+c;
    }
    
    return val;
  }
  /**
   * Renders the object to a string as it would be written to the system. See __render__.
   * 
   * Examples:
   *     new CronTab(function(err, tab) {
   *         if (err) { console.log(err); process.exit(1); }
   *         
   *         var vars = tab.vars({name:'MAIL'});
   *         for (var i = 0; i < vars.length; i++) {
   *             console.log(vars[i].toString());
   *         }
   *     });
   *
   * @return {String}
   */
  this.toString = function() {
    return this.render();
  }

  /**
   * Initializes a new CronVar object.
   *
   * @api private
   */
  function init() {
	var tokens = (line||'').match(ITEMREX);
  	
  	if (tokens && tokens.length > 0) {
  	  name  = tokens[1];
  	  val   = tokens[2];
  	  valid = true;
  	}
    else {
      throw new Error('Expected an env variable declaration line');
    }
  }
  
  init();
}

module.exports = CronVar;
