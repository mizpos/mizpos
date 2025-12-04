.PHONY: deploy

deploy:
	pip install . -t . --upgrade --quiet 2>/dev/null || pip install . -t . --upgrade
	lambroll deploy --function function.jsonnet --ext-str ENV=$(ENV)
