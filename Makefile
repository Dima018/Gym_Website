NPM := npm
DOCKER := docker
POWERSHELL := powershell.exe
WAIT_DOCKER_PS := scripts/wait-docker.ps1
DB_SERVICE := db

.DEFAULT_GOAL := run
.NOTPARALLEL:
.PHONY: all setup docker-start db db-init run test

all: run

node_modules: package.json package-lock.json
	$(NPM) ci

.env: scripts/setup.js
	$(NPM) run setup

setup: node_modules .env

docker-start:
	$(DOCKER) desktop start
	$(POWERSHELL) -NoProfile -ExecutionPolicy Bypass -File "$(WAIT_DOCKER_PS)"

db: setup docker-start
	$(DOCKER) compose up -d --wait $(DB_SERVICE)

db-init: db
	$(NPM) run db:init

run: db-init
	$(NPM) start

test: db-init
	$(NPM) test
