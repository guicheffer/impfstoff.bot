help:
	@echo
	@echo "💉  Please use 'make <target>' where <target> is one of the commands below:"
	@echo
	@fgrep -h "##" $(MAKEFILE_LIST) | fgrep -v fgrep | sed -e "s/\\$$//" | sed -e "s/##//"
	@echo

# ------------------------------------------------------------------------------------ #

amount: amount-check
amount-check: ## Check the current amount of users in the bot
	node -e 'const x = require("./telegram/resources/users.json"); console.log(x.ids.length)'

restart: ## Restart the app
	sudo pm2 delete npm
	sudo pm2 start npm -- start
	make log

log: ## Check upon recent logs in pm2
	sudo pm2 log npm