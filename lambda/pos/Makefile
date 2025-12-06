.PHONY: deploy install sync

install:
	uv sync

sync:
	uv pip compile pyproject.toml -o requirements.txt
	uv pip install -r requirements.txt --target . --upgrade

deploy:
	uv pip compile pyproject.toml -o requirements.txt
	uv pip install -r requirements.txt --target . --upgrade
	lambroll deploy --function function.jsonnet --ext-str ENV=$(ENV)
