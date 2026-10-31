.PHONY: up seed test down

up:
	docker compose up --build

seed:
	npm run seed

test:
	npm test

down:
	docker compose down
