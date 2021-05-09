help:
	@echo
	@echo "💉  Please use 'make <target>' where <target> is one of the commands below:"
	@echo
	@fgrep -h "##" $(MAKEFILE_LIST) | fgrep -v fgrep | sed -e "s/\\$$//" | sed -e "s/##//"
	@echo

# ------------------------------------------------------------------------------------ #

amount: amount-check
amount-check: ## Check the current amount of users in the bot
	node -e 'const users = require("./resources/telegram/users.json"); console.log(users.ids.length)'

backup: ## Backup and mention amount of telegram users
	cp ./resources/telegram/users.json .
	make amount

clear: clean
clean: ## Clear stuff
	npm run clean
	sudo pm2 delete npm

restart: ## Restart the app
	make start
	make log

logs: log
log: ## Check upon recent logs in pm2
	sudo pm2 log npm

start: ## Start prod
	make build
	sudo pm2 start npm -- start

build: ## Build for prod env
	npm run build

dev: ## Run dev
	npm run start:dev