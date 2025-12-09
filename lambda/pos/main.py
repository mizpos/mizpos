"""
POS Lambda Function
POS端末専用のAPI（端末認証・従業員認証・販売処理）
"""

import json
import logging
import os
import traceback

from fastapi import APIRouter, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum

from auth import get_pos_session
from models import (
    ApplyCouponRequest,
    OfflineSalesSyncRequest,
    PosLoginRequest,
    PosRefundRequest,
    PosSaleRequest,
    PosSessionRefreshRequest,
    PosSetEventRequest,
    TerminalAuthRequest,
)
from services.coupon import apply_coupon, get_coupon_by_code
from services.employee import (
    authenticate_pos_employee,
    get_pending_offline_sales,
    get_sale_by_id,
    invalidate_session,
    mark_offline_sale_failed,
    mark_offline_sale_synced,
    process_refund,
    record_pos_sale,
    refresh_pos_session,
    save_offline_sale_to_db,
    set_session_event,
    verify_pos_session,
)
from services.sync import get_events_for_pos
from services.terminal import (
    authenticate_terminal,
    check_terminal_registered,
)

# ロガーの設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# FastAPI アプリ
app = FastAPI(
    title="POS API",
    description="POS端末専用API（端末認証・従業員認証・販売処理）",
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
    """すべての予期しない例外をキャッチして適切に処理する"""
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


# ==========================================
# 端末認証エンドポイント（認証不要）
# ==========================================


@router.post("/terminals/auth", response_model=dict)
async def authenticate_terminal_endpoint(request: TerminalAuthRequest):
    """端末認証

    認証不要（端末からの呼び出し）
    Ed25519署名を検証して端末を認証
    """
    try:
        terminal = authenticate_terminal(
            terminal_id=request.terminal_id,
            timestamp=request.timestamp,
            signature=request.signature,
        )
        return {
            "valid": True,
            "terminal": {
                "terminal_id": terminal["terminal_id"],
                "device_name": terminal["device_name"],
                "status": terminal["status"],
            },
        }
    except ValueError as e:
        # 認証失敗
        return {"valid": False, "error": str(e)}
    except Exception as e:
        logger.error(f"Error authenticating terminal: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/terminals/check/{terminal_id}", response_model=dict)
async def check_terminal_endpoint(terminal_id: str):
    """端末登録確認

    認証不要（端末からの呼び出し）
    端末が登録済みかどうかを確認
    """
    try:
        is_registered, terminal_status = check_terminal_registered(terminal_id)
        return {
            "registered": is_registered,
            "status": terminal_status,
        }
    except Exception as e:
        logger.error(f"Error checking terminal: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# 従業員認証エンドポイント（認証不要）
# ==========================================


@router.post("/auth/login", response_model=dict)
async def pos_login(request: PosLoginRequest):
    """POS端末ログイン

    従業員番号とPINで認証し、セッショントークンを発行
    認証不要エンドポイント（POS端末専用）
    """
    try:
        session = authenticate_pos_employee(
            employee_number=request.employee_number,
            pin=request.pin,
            terminal_id=request.terminal_id,
        )
        if not session:
            raise HTTPException(
                status_code=401, detail="Invalid employee number or PIN"
            )
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in POS login: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/auth/refresh", response_model=dict)
async def pos_refresh_session(request: PosSessionRefreshRequest):
    """POSセッション延長

    有効なセッションの有効期限を延長
    """
    try:
        session = refresh_pos_session(request.session_id)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing POS session: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/auth/logout", status_code=status.HTTP_204_NO_CONTENT)
async def pos_logout(request: PosSessionRefreshRequest):
    """POSログアウト

    セッションを無効化
    """
    try:
        invalidate_session(request.session_id)
    except Exception as e:
        logger.error(f"Error in POS logout: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/auth/verify", response_model=dict)
async def pos_verify_session(session_id: str):
    """POSセッション検証

    セッションが有効かどうかを確認
    """
    try:
        session = verify_pos_session(session_id)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return {"valid": True, "session": session}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying POS session: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# POS業務エンドポイント（セッション認証必要）
# ==========================================


@router.get("/events", response_model=dict)
async def pos_get_events(request: Request):
    """POS端末からイベント一覧を取得

    X-POS-Session ヘッダーでセッションIDを指定
    アクティブなイベントのみ返却
    """
    _ = await get_pos_session(request)
    try:
        events = get_events_for_pos()
        return {"events": events}
    except Exception as e:
        logger.error(f"Error fetching events for POS: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/auth/set-event", response_model=dict)
async def pos_set_event(request: Request, body: PosSetEventRequest):
    """POSセッションにイベントを設定

    イベント紐づけがない従業員がログイン後にイベントを選択する場合に使用
    X-POS-Session ヘッダーでセッションIDを指定
    """
    session_id = request.headers.get("X-POS-Session")
    if not session_id:
        raise HTTPException(status_code=401, detail="Missing POS session")

    try:
        session = set_session_event(session_id, body.event_id)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return {"success": True, "session": session}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting event for POS session: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/sales", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_pos_sale(request: Request, sale_request: PosSaleRequest):
    """POS端末からの販売を記録

    X-POS-Session ヘッダーでセッションIDを指定
    リアルタイムで販売を処理し、在庫を減らす
    """
    session_id = request.headers.get("X-POS-Session")
    if not session_id:
        raise HTTPException(status_code=401, detail="Missing POS session")

    try:
        result = record_pos_sale(
            session_id=session_id,
            items=[item.model_dump() for item in sale_request.items],
            total_amount=sale_request.total_amount,
            payment_method=sale_request.payment_method,
            event_id=sale_request.event_id,
            terminal_id=sale_request.terminal_id,
            coupon_code=sale_request.coupon_code,
            subtotal=sale_request.subtotal,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error recording POS sale: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# 返金エンドポイント（セッション認証必要・職長権限必要）
# ==========================================


@router.get("/sales/{sale_id}", response_model=dict)
async def get_sale(request: Request, sale_id: str):
    """販売データを取得

    X-POS-Session ヘッダーでセッションIDを指定
    レシート番号（sale_id）で販売データを取得
    """
    session_id = request.headers.get("X-POS-Session")
    if not session_id:
        raise HTTPException(status_code=401, detail="Missing POS session")

    session = verify_pos_session(session_id)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    try:
        sale = get_sale_by_id(sale_id)
        if not sale:
            raise HTTPException(status_code=404, detail="販売データが見つかりません")
        return {"sale": sale}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sale: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/refunds", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_refund(request: Request, refund_request: PosRefundRequest):
    """返金を処理

    X-POS-Session ヘッダーでセッションIDを指定
    職長権限が必要
    元の販売を返金済みにマークし、在庫を戻す
    """
    session_id = request.headers.get("X-POS-Session")
    if not session_id:
        raise HTTPException(status_code=401, detail="Missing POS session")

    try:
        result = process_refund(
            session_id=session_id,
            original_sale_id=refund_request.original_sale_id,
            items=[item.model_dump() for item in refund_request.items],
            refund_amount=refund_request.refund_amount,
            reason=refund_request.reason,
        )
        return result
    except ValueError as e:
        if "職長権限" in str(e):
            raise HTTPException(status_code=403, detail=str(e)) from e
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error processing refund: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# クーポンエンドポイント（セッション認証必要）
# ==========================================


@router.post("/coupons/apply", response_model=dict)
async def apply_coupon_endpoint(request: Request, coupon_request: ApplyCouponRequest):
    """クーポン適用（POS用）

    クーポンコードを検証し、割引額を計算
    X-POS-Session ヘッダーでセッションIDを指定
    """
    try:
        session_id = request.headers.get("X-POS-Session")
        if not session_id:
            raise HTTPException(status_code=401, detail="POS session required")

        session = verify_pos_session(session_id)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        result, error = apply_coupon(
            code=coupon_request.code,
            subtotal=coupon_request.subtotal,
            publisher_id=coupon_request.publisher_id,
            event_id=session.get("event_id"),
        )

        if error:
            raise HTTPException(status_code=400, detail=error)

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error applying coupon: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/coupons/lookup", response_model=dict)
async def lookup_coupon_endpoint(request: Request, code: str):
    """クーポンコード検索（POS用）

    クーポンコードで検索して情報を取得
    X-POS-Session ヘッダーでセッションIDを指定
    """
    try:
        session_id = request.headers.get("X-POS-Session")
        if not session_id:
            raise HTTPException(status_code=401, detail="POS session required")

        session = verify_pos_session(session_id)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        coupon = get_coupon_by_code(code)
        if not coupon:
            raise HTTPException(status_code=404, detail="Coupon not found")

        return {"coupon": coupon}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error looking up coupon: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


# ==========================================
# オフライン同期エンドポイント（端末認証のみ）
# ==========================================


@router.post("/sync/sales", response_model=dict)
async def sync_offline_sales(request: OfflineSalesSyncRequest):
    """オフライン販売データを同期

    オフラインで記録された販売データをサーバーに送信し、DBに保存
    """
    from datetime import datetime, timezone

    try:
        synced_count = 0
        failed_items = []

        for sale in request.sales:
            try:
                queue_id = sale.get("queue_id")
                created_at = sale.get("created_at")
                sale_data = sale.get("sale_data", {})

                if not sale_data:
                    logger.warning(f"Empty sale_data for queue_id: {queue_id}")
                    continue

                # 販売データをDBに保存
                logger.info(f"Saving offline sale: {queue_id}")
                save_offline_sale_to_db(sale_data)

                # キューのステータスを更新
                if queue_id and created_at:
                    mark_offline_sale_synced(queue_id, created_at)

                synced_count += 1
                logger.info(f"Successfully synced sale: {queue_id}")

            except Exception as e:
                logger.error(f"Error syncing sale {sale.get('queue_id')}: {e}")
                logger.error(f"Sale data: {sale}")
                failed_items.append({"queue_id": sale.get("queue_id"), "error": str(e)})
                if sale.get("queue_id") and sale.get("created_at"):
                    mark_offline_sale_failed(
                        sale["queue_id"], sale["created_at"], str(e)
                    )

        return {
            "synced_count": synced_count,
            "failed_items": failed_items,
            "sync_timestamp": int(datetime.now(timezone.utc).timestamp()),
        }
    except Exception as e:
        logger.error(f"Error in offline sales sync: {e}")
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/sync/pending", response_model=dict)
async def get_pending_sales(terminal_id: str):
    """端末の未同期販売を取得

    サーバー側に保存されている未同期販売データを取得
    """
    try:
        pending = get_pending_offline_sales(terminal_id)
        return {"pending_sales": pending, "count": len(pending)}
    except Exception as e:
        logger.error(f"Error getting pending sales: {e}")
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
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-POS-Session",
                    "Access-Control-Max-Age": "300",
                },
                "body": "",
            }

        # HTTP API v2.0ではrawPathにステージ名が含まれるため、動的にbase pathを設定
        environment = os.environ.get("ENVIRONMENT", "dev")
        api_gateway_base_path = f"/{environment}/pos"
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
