import json
import logging
import os
import traceback
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from botocore.exceptions import ClientError
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum

from auth import get_current_user
from models import (
    AdjustStockRequest,
    CreateEventRequest,
    CreateProductRequest,
    CreatePublisherRequest,
    EventProductRequest,
    GenerateBarcodeRequest,
    GenerateISDNRequest,
    SetEventProductsRequest,
    UpdateEventRequest,
    UpdateProductRequest,
    UpdatePublisherRequest,
    UploadRequest,
    UploadResponse,
)
from services import (
    add_event_product,
    build_update_expression,
    create_event,
    delete_event,
    dynamo_to_dict,
    generate_presigned_upload_url,
    get_event,
    get_event_products,
    get_publisher,
    list_events,
    list_publishers,
    publishers_table,
    record_stock_history,
    remove_event_product,
    set_event_products,
    stock_history_table,
    stock_table,
    update_event,
)
from isdn import generate_full_barcode_info, generate_isdn, validate_isdn

# ロガーの設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

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


# グローバル例外ハンドラー
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    すべての予期しない例外をキャッチして適切に処理する
    これにより1つのエンドポイントの500エラーが他のエンドポイントに影響しない
    """
    logger.error(f"Unhandled exception: {exc}")
    logger.error(f"Request path: {request.url.path}")
    logger.error(f"Request method: {request.method}")
    logger.error(f"Traceback: {traceback.format_exc()}")

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "error_type": type(exc).__name__,
            "path": str(request.url.path),
        },
    )


# ルーター
router = APIRouter()


# 商品管理エンドポイント
@router.get("/products", response_model=dict)
async def list_products(
    category: str | None = Query(default=None, description="カテゴリでフィルタ"),
):
    """商品一覧取得（認証不要）"""
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
async def create_product(
    request: CreateProductRequest, current_user: dict = Depends(get_current_user)
):
    """商品作成"""
    try:
        product_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        # バーコードを生成（書籍/非書籍で分岐）
        barcode_info = generate_full_barcode_info(
            isdn=request.isdn,
            product_id=product_id,
            price=int(request.price),
            c_code=request.c_code or "3055",
            is_book=request.is_book,
            jan_code=request.jan_code,
        )

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
            "is_book": request.is_book,
            "is_online": request.is_online,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            # バーコード情報を保存
            "jan_barcode_1": barcode_info["jan_barcode_1"],
        }

        # 2段目バーコードは書籍の場合のみ保存
        if barcode_info.get("jan_barcode_2"):
            product_item["jan_barcode_2"] = barcode_info["jan_barcode_2"]

        # 新しいフィールドを追加（nullの場合は含めない）
        if request.publisher_id:
            product_item["publisher_id"] = request.publisher_id
        if request.isdn:
            product_item["isdn"] = request.isdn
        if barcode_info.get("isdn_formatted"):
            product_item["isdn_formatted"] = barcode_info["isdn_formatted"]
        if request.c_code:
            product_item["c_code"] = request.c_code
        if request.jan_code:
            product_item["jan_code"] = request.jan_code
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
async def get_product(product_id: str):
    """商品詳細取得（認証不要）"""
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
    product_id: str,
    request: UpdateProductRequest,
    current_user: dict = Depends(get_current_user),
):
    """商品情報更新"""
    try:
        request_dict = request.model_dump(exclude_unset=True)
        if not request_dict:
            raise HTTPException(status_code=400, detail="No fields to update")

        # 価格またはCコードが変更される場合、書籍なら2段目バーコードを再生成
        price_changed = "price" in request_dict
        c_code_changed = "c_code" in request_dict
        jan_code_changed = "jan_code" in request_dict

        if price_changed or c_code_changed or jan_code_changed:
            # 現在の商品情報を取得
            product_response = stock_table.get_item(Key={"product_id": product_id})
            product = product_response.get("Item")

            if product:
                product_dict = dynamo_to_dict(product)
                is_book = product_dict.get("is_book", True)

                if is_book:
                    # 新しい値を取得（更新リクエストに含まれていればそれを、なければ既存値を使用）
                    new_price = int(
                        request_dict.get("price", product_dict.get("price", 0))
                    )
                    new_c_code = (
                        request_dict.get("c_code", product_dict.get("c_code", "3055"))
                        or "3055"
                    )

                    # 2段目バーコードを再生成
                    from isdn import generate_secondary_barcode, format_isdn_with_price

                    new_jan_barcode_2 = generate_secondary_barcode(
                        new_c_code, new_price
                    )
                    request_dict["jan_barcode_2"] = new_jan_barcode_2

                    # ISDN表記も更新
                    isdn = product_dict.get("isdn")
                    if isdn:
                        new_isdn_formatted = format_isdn_with_price(
                            isdn, new_c_code, new_price
                        )
                        request_dict["isdn_formatted"] = new_isdn_formatted

                    # jan_codeが変更された場合は1段目バーコードも更新
                    if jan_code_changed and request_dict.get("jan_code"):
                        request_dict["jan_barcode_1"] = request_dict["jan_code"]

        update_expressions, expression_values, expression_names = (
            build_update_expression(request_dict)
        )

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
async def delete_product(
    product_id: str, current_user: dict = Depends(get_current_user)
):
    """商品削除"""
    try:
        stock_table.delete_item(Key={"product_id": product_id})
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# 在庫管理エンドポイント
@router.post("/products/{product_id}/adjust", response_model=dict)
async def adjust_stock(
    product_id: str,
    request: AdjustStockRequest,
    current_user: dict = Depends(get_current_user),
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
        categories = sorted(
            set(item.get("category") for item in items if item.get("category"))
        )
        return {"categories": categories}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# 出版社/サークル管理エンドポイント
@router.get("/publishers", response_model=dict)
async def list_publishers_endpoint(current_user: dict = Depends(get_current_user)):
    """出版社/サークル一覧取得（権限フィルタリング付き）"""
    try:
        user_email = current_user.get("email")
        publishers = list_publishers(user_email=user_email)
        return {"publishers": publishers}
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/publishers", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_publisher(
    request: CreatePublisherRequest, current_user: dict = Depends(get_current_user)
):
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
async def get_publisher_endpoint(
    publisher_id: str, current_user: dict = Depends(get_current_user)
):
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
    publisher_id: str,
    request: UpdatePublisherRequest,
    current_user: dict = Depends(get_current_user),
):
    """出版社/サークル情報更新"""
    try:
        request_dict = request.model_dump(exclude_unset=True)
        if not request_dict:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_expressions, expression_values, expression_names = (
            build_update_expression(request_dict)
        )

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
async def delete_publisher(
    publisher_id: str, current_user: dict = Depends(get_current_user)
):
    """出版社/サークル削除"""
    try:
        publishers_table.delete_item(Key={"publisher_id": publisher_id})
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# イベント管理エンドポイント
# ==========================================


@router.get("/events", response_model=dict)
async def get_events_list(
    publisher_id: str | None = Query(
        None, description="サークルID（指定した場合はそのサークルのイベントのみ取得）"
    ),
    current_user: dict = Depends(get_current_user),
):
    """イベント一覧取得"""
    try:
        events = list_events(publisher_id)
        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/events", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_new_event(
    request: CreateEventRequest, current_user: dict = Depends(get_current_user)
):
    """イベント作成

    権限: システム管理者、またはサークル管理者（自分のサークルのイベントのみ）
    """
    try:
        # TODO: 権限チェックを実装
        # - システム管理者: すべてのイベントを作成可能
        # - サークル管理者: 自分のサークルのイベントのみ作成可能

        event_data = request.model_dump()
        event = create_event(event_data)
        return {"event": event}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/events/{event_id}", response_model=dict)
async def get_event_detail(
    event_id: str, current_user: dict = Depends(get_current_user)
):
    """イベント詳細取得"""
    try:
        event = get_event(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return {"event": event}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/events/{event_id}", response_model=dict)
async def update_event_detail(
    event_id: str,
    request: UpdateEventRequest,
    current_user: dict = Depends(get_current_user),
):
    """イベント更新

    権限: システム管理者、またはサークル管理者（自分のサークルのイベントのみ）
    """
    try:
        # TODO: 権限チェックを実装

        update_data = request.model_dump(exclude_none=True)
        event = update_event(event_id, update_data)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return {"event": event}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event_endpoint(
    event_id: str, current_user: dict = Depends(get_current_user)
):
    """イベント削除（論理削除）

    権限: システム管理者、またはサークル管理者（自分のサークルのイベントのみ）
    """
    try:
        # TODO: 権限チェックを実装

        success = delete_event(event_id)
        if not success:
            raise HTTPException(status_code=404, detail="Event not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# イベント-商品紐づけエンドポイント
@router.get("/events/{event_id}/products", response_model=dict)
async def get_event_products_endpoint(
    event_id: str, current_user: dict = Depends(get_current_user)
):
    """イベントに紐づく商品IDリストを取得"""
    try:
        product_ids = get_event_products(event_id)
        return {"event_id": event_id, "product_ids": product_ids}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/events/{event_id}/products", response_model=dict)
async def set_event_products_endpoint(
    event_id: str,
    request: SetEventProductsRequest,
    current_user: dict = Depends(get_current_user),
):
    """イベントに紐づく商品リストを設定（一括更新）"""
    try:
        event = set_event_products(event_id, request.product_ids)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return {"event": event}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/events/{event_id}/products", response_model=dict)
async def add_event_product_endpoint(
    event_id: str,
    request: EventProductRequest,
    current_user: dict = Depends(get_current_user),
):
    """イベントに商品を追加"""
    try:
        event = add_event_product(event_id, request.product_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return {"event": event}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/events/{event_id}/products/{product_id}", response_model=dict)
async def remove_event_product_endpoint(
    event_id: str,
    product_id: str,
    current_user: dict = Depends(get_current_user),
):
    """イベントから商品を削除"""
    try:
        event = remove_event_product(event_id, product_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")
        return {"event": event}
    except HTTPException:
        raise
    except Exception as e:
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


@router.post("/barcode/migrate", response_model=dict)
async def migrate_barcodes(
    current_user: dict = Depends(get_current_user),
):
    """既存商品にバーコード情報を追加するマイグレーション"""
    try:
        # 全商品を取得
        response = stock_table.scan()
        products = response.get("Items", [])

        updated_count = 0
        skipped_count = 0

        for product in products:
            product_id = product.get("product_id")
            # 既にバーコードがある場合はスキップ
            if product.get("jan_barcode_1"):
                skipped_count += 1
                continue

            product_dict = dynamo_to_dict(product)
            isdn = product_dict.get("isdn")
            price = int(product_dict.get("price", 0))

            # バーコード情報を生成
            barcode_info = generate_full_barcode_info(
                isdn=isdn,
                product_id=product_id,
                price=price,
                c_code="3055",
            )

            # 更新
            update_expr = (
                "SET jan_barcode_1 = :jb1, jan_barcode_2 = :jb2, updated_at = :ua"
            )
            expr_values = {
                ":jb1": barcode_info["jan_barcode_1"],
                ":jb2": barcode_info["jan_barcode_2"],
                ":ua": datetime.now(timezone.utc).isoformat(),
            }

            # ISDN情報も追加
            if barcode_info.get("isdn_formatted"):
                update_expr += ", isdn_formatted = :isdn_fmt"
                expr_values[":isdn_fmt"] = barcode_info["isdn_formatted"]

            stock_table.update_item(
                Key={"product_id": product_id},
                UpdateExpression=update_expr,
                ExpressionAttributeValues=expr_values,
            )
            updated_count += 1

        return {
            "message": "Migration completed",
            "updated": updated_count,
            "skipped": skipped_count,
        }
    except ClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/products/{product_id}/barcode", response_model=dict)
async def get_product_barcode(
    product_id: str,
    c_code: str = Query(default="3055", description="Cコード（4桁）"),
    current_user: dict = Depends(get_current_user),
):
    """商品のバーコード情報を取得（DynamoDBに保存済みの場合はそれを返す）"""
    try:
        # 商品情報を取得
        response = stock_table.get_item(Key={"product_id": product_id})
        product = response.get("Item")

        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        product_dict = dynamo_to_dict(product)
        is_book = product_dict.get("is_book", True)  # デフォルトは書籍（後方互換性）

        # DynamoDBに保存されたバーコードがあればそれを返す
        if product_dict.get("jan_barcode_1"):
            if is_book:
                full_display = (
                    f"{product_dict.get('isdn_formatted') or 'インストアコード'}\n"
                    f"{product_dict.get('jan_barcode_1')} / {product_dict.get('jan_barcode_2')}"
                )
            else:
                full_display = f"JANコード\n{product_dict.get('jan_barcode_1')}"

            return {
                "product_id": product_id,
                "product_name": product_dict.get("name", ""),
                "is_book": is_book,
                "isdn": product_dict.get("isdn"),
                "isdn_formatted": product_dict.get("isdn_formatted"),
                "c_code": product_dict.get("c_code"),
                "jan_barcode_1": product_dict.get("jan_barcode_1"),
                "jan_barcode_2": product_dict.get("jan_barcode_2"),
                "full_display": full_display,
            }

        # バーコードが保存されていない場合は動的に生成
        isdn = product_dict.get("isdn")
        price = int(product_dict.get("price", 0))
        stored_c_code = product_dict.get("c_code") or c_code
        jan_code = product_dict.get("jan_code")

        barcode_info = generate_full_barcode_info(
            isdn=isdn,
            product_id=product_id,
            price=price,
            c_code=stored_c_code,
            is_book=is_book,
            jan_code=jan_code,
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


# アップロードエンドポイント
@router.post("/uploads", response_model=UploadResponse)
async def create_upload_url(
    request: UploadRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    CDNへのアップロード用Presigned URLを生成

    クライアントは返却されたupload_urlに対して、指定したcontent_typeで
    PUTリクエストを送信することでファイルをアップロードできます。
    アップロード完了後、cdn_urlでファイルにアクセスできます。
    """
    try:
        # 許可されたMIMEタイプのチェック
        allowed_types = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/svg+xml",
        ]
        if request.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Content type {request.content_type} is not allowed. Allowed types: {', '.join(allowed_types)}",
            )

        # Presigned URLを生成
        upload_info = generate_presigned_upload_url(
            filename=request.filename,
            content_type=request.content_type,
            upload_type=request.upload_type.value,
        )

        return UploadResponse(**upload_info)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ルーターを登録
app.include_router(router)


# Mangum ハンドラー（API Gateway base path対応）
def handler(event, context):
    """
    Lambda関数のエントリーポイント
    全体をtry-exceptでラップしてLambda関数のクラッシュを防止
    """
    try:
        # リクエスト情報をログ出力
        request_context = event.get("requestContext", {})
        http_info = request_context.get("http", {})
        method = http_info.get("method", event.get("httpMethod", ""))
        path = http_info.get("path", event.get("path", ""))

        logger.info(f"Request received - Method: {method}, Path: {path}")

        # OPTIONS リクエストは認証なしで即座にCORSレスポンスを返す
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
        mangum_handler = Mangum(
            app, lifespan="off", api_gateway_base_path=api_gateway_base_path
        )
        response = mangum_handler(event, context)
        logger.info(
            f"Request completed - Status: {response.get('statusCode', 'unknown')}"
        )
        return response

    except Exception as e:
        # Lambda関数レベルでの致命的なエラーをキャッチ
        logger.error(f"Fatal error in Lambda handler: {e}")
        logger.error(f"Event: {json.dumps(event, default=str)}")
        logger.error(f"Traceback: {traceback.format_exc()}")

        # エラーレスポンスを返す（Lambda関数自体はクラッシュしない）
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps(
                {
                    "detail": "Lambda handler error",
                    "error_type": type(e).__name__,
                    "error_message": str(e),
                }
            ),
        }
