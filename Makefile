.PHONY: help format lint fix check check-types build test clean install dev

# フロントエンド（Turborepo）のディレクトリ
FRONTEND_DIR := frontend
# バックエンドのディレクトリ
BACKEND_DIR := lambda
# Terraformのディレクトリ
TERRAFORM_DIR := terraform

help: ## このヘルプメッセージを表示
	@echo "使用可能なコマンド:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36mmake %-15s\033[0m %s\n", $$1, $$2}'

install: ## 依存関係をインストール
	@echo "📦 Installing frontend dependencies (Turborepo)..."
	cd $(FRONTEND_DIR) && pnpm install
	@echo "✅ Dependencies installed"

format: ## 全てのコードをフォーマット
	@echo "🎨 Formatting frontend code (all apps)..."
	cd $(FRONTEND_DIR) && pnpm run fix
	@echo "🎨 Formatting backend code..."
	uvx ruff format $(BACKEND_DIR)/
	@echo "🎨 Formatting Terraform code..."
	terraform fmt -recursive $(TERRAFORM_DIR)/
	@echo "✅ All code formatted"

lint: ## 全てのリントチェック
	@echo "🔍 Linting backend code..."
	uvx ruff check $(BACKEND_DIR)/
	@echo "✅ All linting checks passed"

fix: ## 自動修正可能な全ての問題を修正
	@echo "🔧 Fixing frontend code (all apps)..."
	cd $(FRONTEND_DIR) && pnpm run fix
	@echo "🔧 Fixing backend code..."
	uvx ruff format $(BACKEND_DIR)/
	uvx ruff check --fix $(BACKEND_DIR)/
	@echo "🔧 Formatting Terraform code..."
	terraform fmt -recursive $(TERRAFORM_DIR)/
	@echo "✅ All auto-fixable issues fixed"

check-types: ## TypeScriptの型チェック
	@echo "🔍 Checking TypeScript types (all apps)..."
	cd $(FRONTEND_DIR) && pnpm run check-types
	@echo "✅ Type checking passed"

check: fix check-types lint ## 全てのチェックを実行（自動修正 + 型チェック + リント）
	@echo "✅ All checks passed!"

build: ## フロントエンドを全てビルド
	@echo "🏗️  Building frontend (all apps with Turborepo)..."
	cd $(FRONTEND_DIR) && pnpm run build
	@echo "✅ Build completed"

test: ## テストを実行
	@echo "🧪 Running frontend tests (all apps)..."
	cd $(FRONTEND_DIR) && pnpm run test
	@echo "✅ Tests passed"

clean: ## ビルド成果物をクリーンアップ
	@echo "🧹 Cleaning frontend build artifacts..."
	rm -rf $(FRONTEND_DIR)/apps/*/dist
	rm -rf $(FRONTEND_DIR)/apps/*/styled-system
	rm -rf $(FRONTEND_DIR)/.turbo
	@echo "✅ Clean completed"

dev: ## フロントエンド開発サーバーを起動（全アプリ）
	@echo "🚀 Starting frontend development servers (all apps)..."
	cd $(FRONTEND_DIR) && pnpm run dev

ci: check build ## CI環境で実行するコマンド（チェック + ビルド）
	@echo "✅ CI checks completed!"
