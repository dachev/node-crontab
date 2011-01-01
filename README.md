
# node-crontab
      
Allows reading, manipulating, and writing user crontabs from [node.js](http://nodejs.org).

## Installation
    $ npm install crontab

## Usage
    require('crontab').load(cronLoaded);

    function cronLoaded(err, tabs) {
        if (err) { console.log(err); process.exit(1); }
        
        var command = '/usr/bin/env echo "starting some service..."';
        tabs.removeAll(command);
        
        var item = tabs.create(command);
        item.everyReboot();
        
        tabs.save(cronSaved);
    }
    
    function cronSaved(err, tabs) {
        if (err) { console.log(err); process.exit(1); }
        
        console.log('saved');
    }

## Documentation
API [reference](http://dachev.github.com/node-crontab).

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
