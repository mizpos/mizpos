import os
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from auth import get_current_user
from models import (
    AdjustStockRequest,
    CreateProductRequest,
    CreatePublisherRequest,
    GenerateBarcodeRequest,
    GenerateISDNRequest,
    UpdateProductRequest,
    UpdatePublisherRequest,
)
from isdn import generate_full_barcode_info, generate_isdn, validate_isdn
from services import (
    build_update_expression,
    dynamo_to_dict,
    get_publisher,
    list_publishers,
    publishers_table,
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
async def list_products(
    category: str | None = Query(default=None, description="カテゴリでフィルタ"),
    current_user: dict = Depends(get_current_user),
):
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
async def create_product(request: CreateProductRequest, current_user: dict = Depends(get_current_user)):
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

        # 新しいフィールドを追加（nullの場合は含めない）
        if request.publisher_id:
            product_item["publisher_id"] = request.publisher_id
        if request.isdn:
            product_item["isdn"] = request.isdn
        if request.download_url:
            product_item["download_url"] = request.download_url

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
async def get_product(product_id: str, current_user: dict = Depends(get_current_user)):
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
async def update_product(
    product_id: str, request: UpdateProductRequest, current_user: dict = Depends(get_current_user)
):
    """商品情報更新"""
    try:
        request_dict = request.model_dump(exclude_unset=True)
        if not request_dict:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_expressions, expression_values, expression_names = build_update_expression(request_dict)

        now = datetime.now(timezone.utc).isoformat()
        update_expressions.append("updated_at = :updated_at")
        expression_values[":updated_at"] = now

        update_params = {
            "Key": {"product_id": product_id},
            "UpdateExpression": "SET " + ", ".join(update_expressions),
            "ExpressionAttributeValues": expression_values,
            "ReturnValues": "ALL_NEW",
        }

        # 予約語がある場合のみExpressionAttributeNamesを追加
        if expression_names:
            update_params["ExpressionAttributeNames"] = expression_names

        response = stock_table.update_item(**update_params)

        return {"product": dynamo_to_dict(response["Attributes"])}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(product_id: str, current_user: dict = Depends(get_current_user)):
    """商品削除"""
    try:
        stock_table.delete_item(Key={"product_id": product_id})
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# 在庫管理エンドポイント
@router.post("/products/{product_id}/adjust", response_model=dict)
async def adjust_stock(
    product_id: str, request: AdjustStockRequest, current_user: dict = Depends(get_current_user)
):
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
    product_id: str,
    limit: int = Query(default=50, ge=1, le=1000, description="取得件数"),
    current_user: dict = Depends(get_current_user),
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
async def list_categories(current_user: dict = Depends(get_current_user)):
    """カテゴリ一覧取得"""
    try:
        response = stock_table.scan(ProjectionExpression="category")
        items = response.get("Items", [])
        categories = sorted(set(item.get("category") for item in items if item.get("category")))
        return {"categories": categories}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# 出版社/サークル管理エンドポイント
@router.get("/publishers", response_model=dict)
async def list_publishers_endpoint(current_user: dict = Depends(get_current_user)):
    """出版社/サークル一覧取得"""
    try:
        publishers = list_publishers()
        return {"publishers": publishers}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/publishers", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_publisher(request: CreatePublisherRequest, current_user: dict = Depends(get_current_user)):
    """出版社/サークル作成"""
    try:
        publisher_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        publisher_item = {
            "publisher_id": publisher_id,
            "name": request.name,
            "description": request.description,
            "contact_email": request.contact_email or "",
            "commission_rate": Decimal(str(request.commission_rate)),
            "stripe_online_fee_rate": Decimal(str(request.stripe_online_fee_rate)),
            "stripe_terminal_fee_rate": Decimal(str(request.stripe_terminal_fee_rate)),
            "is_active": True,
            "created_at": now,
            "updated_at": now,
        }

        publishers_table.put_item(Item=publisher_item)
        return {"publisher": dynamo_to_dict(publisher_item)}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/publishers/{publisher_id}", response_model=dict)
async def get_publisher_endpoint(publisher_id: str, current_user: dict = Depends(get_current_user)):
    """出版社/サークル詳細取得"""
    try:
        publisher = get_publisher(publisher_id)
        if not publisher:
            raise HTTPException(status_code=404, detail="Publisher not found")
        return {"publisher": publisher}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/publishers/{publisher_id}", response_model=dict)
async def update_publisher(
    publisher_id: str, request: UpdatePublisherRequest, current_user: dict = Depends(get_current_user)
):
    """出版社/サークル情報更新"""
    try:
        request_dict = request.model_dump(exclude_unset=True)
        if not request_dict:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_expressions, expression_values, expression_names = build_update_expression(request_dict)

        now = datetime.now(timezone.utc).isoformat()
        update_expressions.append("updated_at = :updated_at")
        expression_values[":updated_at"] = now

        update_params = {
            "Key": {"publisher_id": publisher_id},
            "UpdateExpression": "SET " + ", ".join(update_expressions),
            "ExpressionAttributeValues": expression_values,
            "ReturnValues": "ALL_NEW",
        }

        # 予約語がある場合のみExpressionAttributeNamesを追加
        if expression_names:
            update_params["ExpressionAttributeNames"] = expression_names

        response = publishers_table.update_item(**update_params)

        return {"publisher": dynamo_to_dict(response["Attributes"])}
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/publishers/{publisher_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_publisher(publisher_id: str, current_user: dict = Depends(get_current_user)):
    """出版社/サークル削除"""
    try:
        publishers_table.delete_item(Key={"publisher_id": publisher_id})
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ISDN/JAN バーコード生成エンドポイント
@router.post("/isdn/generate", response_model=dict)
async def generate_new_isdn(
    request: GenerateISDNRequest = GenerateISDNRequest(),
    current_user: dict = Depends(get_current_user),
):
    """新しいISDNを生成"""
    try:
        isdn = generate_isdn(request.group)
        return {"isdn": isdn}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/isdn/validate", response_model=dict)
async def validate_isdn_endpoint(
    isdn: str = Query(..., description="検証するISDN（ハイフン区切り）"),
    current_user: dict = Depends(get_current_user),
):
    """ISDNの形式とチェックデジットを検証"""
    is_valid = validate_isdn(isdn)
    return {"isdn": isdn, "is_valid": is_valid}


@router.post("/barcode/generate", response_model=dict)
async def generate_barcode(
    request: GenerateBarcodeRequest,
    current_user: dict = Depends(get_current_user),
):
    """ISDN/JANバーコード情報を生成"""
    try:
        barcode_info = generate_full_barcode_info(
            isdn=request.isdn,
            product_id=request.product_id,
            price=request.price,
            c_code=request.c_code,
        )
        return barcode_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/products/{product_id}/barcode", response_model=dict)
async def get_product_barcode(
    product_id: str,
    c_code: str = Query(default="3055", description="Cコード（4桁）"),
    current_user: dict = Depends(get_current_user),
):
    """商品のバーコード情報を取得"""
    try:
        # 商品情報を取得
        response = stock_table.get_item(Key={"product_id": product_id})
        product = response.get("Item")

        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        product_dict = dynamo_to_dict(product)
        isdn = product_dict.get("isdn")
        price = int(product_dict.get("price", 0))

        # バーコード情報を生成
        barcode_info = generate_full_barcode_info(
            isdn=isdn,
            product_id=product_id,
            price=price,
            c_code=c_code,
        )

        return {
            "product_id": product_id,
            "product_name": product_dict.get("name", ""),
            **barcode_info,
        }
    except HTTPException:
        raise
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ルーターを登録
app.include_router(router)

# Mangum ハンドラー（API Gateway base path対応）
def handler(event, context):
    # OPTIONS リクエストは認証なしで即座にCORSレスポンスを返す
    request_context = event.get("requestContext", {})
    http_info = request_context.get("http", {})
    method = http_info.get("method", event.get("httpMethod", ""))

    if method == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Max-Age": "300",
            },
            "body": "",
        }

    # HTTP API v2.0ではrawPathにステージ名が含まれるため、動的にbase pathを設定
    environment = os.environ.get("ENVIRONMENT", "dev")
    api_gateway_base_path = f"/{environment}/stock"
    mangum_handler = Mangum(app, lifespan="off", api_gateway_base_path=api_gateway_base_path)
    return mangum_handler(event, context)
