import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from botocore.exceptions import ClientError
from fastapi import APIRouter, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from models import AdjustStockRequest, CreateProductRequest, UpdateProductRequest
from services import (
    build_update_expression,
    dynamo_to_dict,
    record_stock_history,
    stock_history_table,
    stock_table,
)

# FastAPI アプリ
app = FastAPI(
    title="Stock API",
    description="在庫管理・商品情報管理API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ルーター
router = APIRouter()


# 商品管理エンドポイント
@router.get("/products", response_model=dict)
async def list_products(category: str | None = Query(default=None, description="カテゴリでフィルタ")):
    """商品一覧取得"""
    try:
        if category:
            response = stock_table.query(
                IndexName="CategoryIndex",
                KeyConditionExpression="category = :cat",
                ExpressionAttributeValues={":cat": category},
            )
        else:
            response = stock_table.scan()

        products = [dynamo_to_dict(item) for item in response.get("Items", [])]
        return {"products": products}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/products", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_product(request: CreateProductRequest):
    """商品作成"""
    try:
        product_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        product_item = {
            "product_id": product_id,
            "name": request.name,
            "description": request.description,
            "category": request.category,
            "price": Decimal(str(request.price)),
            "stock_quantity": request.stock_quantity,
            "image_url": request.image_url,
            "author": request.author,
            "publisher": request.publisher,
            "variant_type": request.variant_type.value,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }

        stock_table.put_item(Item=product_item)

        # 初期在庫の履歴を記録
        if request.stock_quantity > 0:
            record_stock_history(
                product_id=product_id,
                quantity_before=0,
                quantity_after=request.stock_quantity,
                quantity_change=request.stock_quantity,
                reason="初期登録",
                operator_id=request.operator_id or "system",
            )

        return {"product": dynamo_to_dict(product_item)}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/products/{product_id}", response_model=dict)
async def get_product(product_id: str):
    """商品詳細取得"""
    try:
        response = stock_table.get_item(Key={"product_id": product_id})
        product = response.get("Item")
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return {"product": dynamo_to_dict(product)}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/products/{product_id}", response_model=dict)
async def update_product(product_id: str, request: UpdateProductRequest):
    """商品情報更新"""
    try:
        request_dict = request.model_dump(exclude_unset=True)
        if not request_dict:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_expressions, expression_values = build_update_expression(request_dict)

        now = datetime.now(timezone.utc).isoformat()
        update_expressions.append("updated_at = :updated_at")
        expression_values[":updated_at"] = now

        response = stock_table.update_item(
            Key={"product_id": product_id},
            UpdateExpression="SET " + ", ".join(update_expressions),
            ExpressionAttributeValues=expression_values,
            ReturnValues="ALL_NEW",
        )

        return {"product": dynamo_to_dict(response["Attributes"])}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: str):
    """商品削除"""
    try:
        stock_table.delete_item(Key={"product_id": product_id})
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# 在庫管理エンドポイント
@router.post("/products/{product_id}/adjust", response_model=dict)
async def adjust_stock(product_id: str, request: AdjustStockRequest):
    """在庫調整"""
    try:
        # 現在の在庫を取得
        product_response = stock_table.get_item(Key={"product_id": product_id})
        product = product_response.get("Item")

        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        quantity_before = int(product.get("stock_quantity", 0))
        quantity_after = quantity_before + request.quantity_change

        if quantity_after < 0:
            raise HTTPException(status_code=400, detail="Insufficient stock")

        now = datetime.now(timezone.utc).isoformat()

        # 在庫を更新
        response = stock_table.update_item(
            Key={"product_id": product_id},
            UpdateExpression="SET stock_quantity = :sq, updated_at = :ua",
            ExpressionAttributeValues={":sq": quantity_after, ":ua": now},
            ReturnValues="ALL_NEW",
        )

        # 履歴を記録
        record_stock_history(
            product_id=product_id,
            quantity_before=quantity_before,
            quantity_after=quantity_after,
            quantity_change=request.quantity_change,
            reason=request.reason,
            operator_id=request.operator_id,
        )

        return {"product": dynamo_to_dict(response["Attributes"])}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/products/{product_id}/history", response_model=dict)
async def get_stock_history(
    product_id: str, limit: int = Query(default=50, ge=1, le=1000, description="取得件数")
):
    """在庫変動履歴取得"""
    try:
        response = stock_history_table.query(
            KeyConditionExpression="product_id = :pid",
            ExpressionAttributeValues={":pid": product_id},
            ScanIndexForward=False,
            Limit=limit,
        )
        history = [dynamo_to_dict(item) for item in response.get("Items", [])]
        return {"history": history}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/categories", response_model=dict)
async def list_categories():
    """カテゴリ一覧取得"""
    try:
        response = stock_table.scan(ProjectionExpression="category")
        items = response.get("Items", [])
        categories = sorted(set(item.get("category") for item in items if item.get("category")))
        return {"categories": categories}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ルーターを登録
app.include_router(router)

# Mangum ハンドラー（API Gateway base path対応）
def handler(event, context):
    # HTTP API v2.0ではrawPathにステージ名が含まれるため、動的にbase pathを設定
    environment = os.environ.get("ENVIRONMENT", "dev")
    api_gateway_base_path = f"/{environment}/stock"
    mangum_handler = Mangum(app, lifespan="off", api_gateway_base_path=api_gateway_base_path)
    return mangum_handler(event, context)
