# Training Environment

トレーニング用環境のTerraform設定です。本番環境と同様の構成でデプロイされます。

## セットアップ

### 1. S3バケットの作成

Terraform stateを保存するためのS3バケットを作成します：

```bash
aws s3 mb s3://mizphses-opensource-mizpos-training --region ap-northeast-1
```

### 2. Terraformの初期化とデプロイ

```bash
cd terraform/tf-training
terraform init
terraform plan
terraform apply
```

### 3. トレーニングデータのセットアップ

GitHub Actionsワークフロー `setup-training-environment.yml` を使用して、
初期データ（管理者ユーザー、商品、出版社、イベントなど）をセットアップします。

または、スクリプトを直接実行：

```bash
# 管理者ユーザーを作成
python3 scripts/setup_admin_user.py \
  --environment training \
  --email admin@example.com \
  --password YourPassword123! \
  --display-name "トレーニング管理者"

# トレーニングデータを投入
python3 scripts/seed_training_data.py --environment training
```

## 環境の特徴

- **環境名**: `training`
- **コストタグ**: `mizpos-training`
- **カスタムドメイン**: デフォルトでは無効（CloudFrontのデフォルトドメインを使用）
- **データ**: トレーニング用のサンプルデータが投入されます

## 削除

トレーニング環境が不要になった場合：

```bash
cd terraform/tf-training
terraform destroy
```

**注意**: S3バケット内のstateファイルは手動で削除する必要があります。
