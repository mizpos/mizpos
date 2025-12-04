.PHONY: deploy

deploy:
	pip install boto3 fastapi jinja2 mangum pydantic stripe "python-jose[cryptography]" httpx -t . --upgrade --quiet 2>/dev/null || \
		pip install boto3 fastapi jinja2 mangum pydantic stripe "python-jose[cryptography]" httpx -t . --upgrade
	lambroll deploy --function function.jsonnet --ext-str ENV=$(ENV)
