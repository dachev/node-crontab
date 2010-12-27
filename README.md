
# node-crontab
      
Allows reading, manipulating, and writing user crontabs from [node.js](http://nodejs.org).

## Installation
    $ npm install crontab

## Usage
    var CronTab = require('./node-crontab');
    
    var tab = new CronTab();
    tab.on('loaded', tabsLoaded);
    tab.on('saved',  tabsSaved);
    tab.on('error',  tabsError);
    
    function tabsLoaded() {
        var checkEmail   = '/usr/bin/env echo "check email"',
            haveFun      = '/usr/bin/env echo "hack node.js"',
            sleepLate    = '/usr/bin/env echo "wake up"',
            takeVacation = '/usr/bin/env echo "go to Bulgaria"',
            beSurprised  = '/usr/bin/env echo "get presents"',
            startServer  = '/usr/bin/env echo "starting some service..."';
        
        //console.log(tab.lines);
        
        tab.removeAll(checkEmail);
        tab.removeAll(haveFun);
        tab.removeAll(sleepLate);
        tab.removeAll(takeVacation);
        tab.removeAll(beSurprised);
        tab.removeAll(startServer);
        
        var everyBusinessHour = tab.create(checkEmail);
        everyBusinessHour.minute().on(0);
        everyBusinessHour.hour().during(8, 17);
        everyBusinessHour.dow().during('mon', 'fri');
        
        var everyWeekDayNight = tab.create(haveFun);
        everyWeekDayNight.hour().during(19, 0);
        everyWeekDayNight.hour().during(0, 3);
        everyWeekDayNight.dow().during('mon', 'fri');
        
        var everyWeekEndMorning = tab.create(sleepLate);
        everyWeekEndMorning.minute().on(30);
        everyWeekEndMorning.hour().on(11);
        everyWeekEndMorning.dow().during('sat', 'sun');
        
        var everySummer = tab.create(takeVacation);
        everySummer.month().during('jun', 'sep');
        
        var everyChristmas = tab.create(beSurprised);
        everyChristmas.minute().on(30);
        everyChristmas.hour().on(9);
        everyChristmas.dom().on(24);
        everyChristmas.month().on('dec');
        
        var item = tab.create(startServer);
        item.everyReboot();
        
        tab.save();
    }
    
    function tabsSaved() {
        console.log('saved');
    }
    
    function tabsError(err) {
        console.log(err);
        console.log(tab.render());
    }

## Node Compatibility
    
The latest revision of node-crontab is compatible with node --version:

    >= 0.2.5

## License
Copyright 2010, Blagovest Dachev.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

This is a JavaScript port of a Python package with the same name written by
- Martin Owens <doctormo at gmail com>
