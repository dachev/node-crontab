install:
	mkdir -p ~/.node_libraries
	cp -fr lib ~/.node_libraries/crontab

uninstall:
	rm -fr ~/.node_libraries/crontab

test:
	vows test/runner.js --spec

docs:
	dox --ribbon "http://github.com/dachev/node-crontab" \
		--title "Crontab" \
		--desc "A module for reading, manipulating, and writing user cron \
		jobs with [node](http://www.nodejs.org). Check out [github] \
		(http://github.com/dachev/node-crontab) for the source and \
		installation guide."\
		lib/*.js > index.html

.PHONY: install uninstall test docs