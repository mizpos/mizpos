# IAM Roles and Policies

# Cognito Identity Pool - 認証済みユーザー用ロール
resource "aws_iam_role" "authenticated" {
  name = "${var.environment}-${var.project_name}-authenticated-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "cognito-identity.amazonaws.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.main.id
          }
          "ForAnyValue:StringLike" = {
            "cognito-identity.amazonaws.com:amr" = "authenticated"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.environment}-${var.project_name}-authenticated-role"
  }
}

# 認証済みユーザーのポリシー
resource "aws_iam_role_policy" "authenticated" {
  name = "${var.environment}-${var.project_name}-authenticated-policy"
  role = aws_iam_role.authenticated.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "mobileanalytics:PutEvents",
          "cognito-sync:*",
          "cognito-identity:*"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda実行ロール - accounts
resource "aws_iam_role" "lambda_accounts" {
  name = "${var.environment}-${var.project_name}-lambda-accounts-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.environment}-${var.project_name}-lambda-accounts-role"
  }
}

# Lambda accounts用ポリシー
resource "aws_iam_role_policy" "lambda_accounts" {
  name = "${var.environment}-${var.project_name}-lambda-accounts-policy"
  role = aws_iam_role.lambda_accounts.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.users.arn,
          "${aws_dynamodb_table.users.arn}/index/*",
          aws_dynamodb_table.roles.arn,
          "${aws_dynamodb_table.roles.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminCreateUser",
          "cognito-idp:AdminDeleteUser",
          "cognito-idp:AdminGetUser",
          "cognito-idp:AdminUpdateUserAttributes",
          "cognito-idp:AdminSetUserPassword",
          "cognito-idp:ListUsers"
        ]
        Resource = aws_cognito_user_pool.main.arn
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda実行ロール - stock
resource "aws_iam_role" "lambda_stock" {
  name = "${var.environment}-${var.project_name}-lambda-stock-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.environment}-${var.project_name}-lambda-stock-role"
  }
}

# Lambda stock用ポリシー
resource "aws_iam_role_policy" "lambda_stock" {
  name = "${var.environment}-${var.project_name}-lambda-stock-policy"
  role = aws_iam_role.lambda_stock.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.stock.arn,
          "${aws_dynamodb_table.stock.arn}/index/*",
          aws_dynamodb_table.stock_history.arn,
          "${aws_dynamodb_table.stock_history.arn}/index/*",
          aws_dynamodb_table.publishers.arn,
          "${aws_dynamodb_table.publishers.arn}/index/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.cdn_assets.arn}/*"
      }
    ]
  })
}

# Lambda実行ロール - sales
resource "aws_iam_role" "lambda_sales" {
  name = "${var.environment}-${var.project_name}-lambda-sales-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.environment}-${var.project_name}-lambda-sales-role"
  }
}

# Lambda sales用ポリシー
resource "aws_iam_role_policy" "lambda_sales" {
  name = "${var.environment}-${var.project_name}-lambda-sales-policy"
  role = aws_iam_role.lambda_sales.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.sales.arn,
          "${aws_dynamodb_table.sales.arn}/index/*",
          aws_dynamodb_table.stock.arn,
          "${aws_dynamodb_table.stock.arn}/index/*",
          aws_dynamodb_table.stock_history.arn,
          "${aws_dynamodb_table.stock_history.arn}/index/*",
          aws_dynamodb_table.events.arn,
          "${aws_dynamodb_table.events.arn}/index/*",
          aws_dynamodb_table.config.arn,
          aws_dynamodb_table.users.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = aws_secretsmanager_secret.stripe_api_key.arn
      },
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
      }
    ]
  })
}
