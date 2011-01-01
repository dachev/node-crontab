install:
	mkdir -p ~/.node_libraries
	cp -fr lib ~/.node_libraries/crontab

uninstall:
	rm -fr ~/.node_libraries/crontab

docs: uninstall install
	dox --ribbon "http://github.com/dachev/node-crontab" \
		--title "Crontab" \
		--desc "A module for reading, manipulating, and writing user cron jobs \
		from [node](http://www.nodejs.org). Check out the [github]\
		(http://github.com/dachev/node-crontab) for the source and installation guide."\
		lib/*.js > index.html

.PHONY: install uninstall docs