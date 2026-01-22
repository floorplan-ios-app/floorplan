SHELL := /bin/bash

.PHONY: bootstrap dev dev-api dev-web test lint fmt docs-lint db-up db-down ios-gen

bootstrap:
	./scripts/bootstrap.sh

dev:
	bun run dev

dev-api:
	bun run dev:api

dev-web:
	bun run dev:web

test:
	bun run test

lint:
	bun run lint

fmt:
	bun run fmt

docs-lint:
	bun run docs:lint

db-up:
	bun run db:up

db-down:
	bun run db:down

ios-gen:
	bun run ios:gen

db-migrate:
	bun run db:migrate

.PHONY: db-migrate
