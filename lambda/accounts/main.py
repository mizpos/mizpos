import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from models import AssignRoleRequest, CreateUserRequest, UpdateUserRequest
from services import (
    DynamoDBClientError,
    UsernameExistsException,
    create_cognito_user,
    delete_cognito_user,
    delete_user_roles,
    dynamo_to_dict,
    roles_table,
    users_table,
)

# FastAPI アプリ
app = FastAPI(
    title="Accounts API",
    description="ユーザーアカウントとロール管理API",
    version="1.0.0",
    root_path="/accounts",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ユーザー管理エンドポイント
@app.get("/users", response_model=dict)
async def list_users():
    """ユーザー一覧取得"""
    try:
        response = users_table.scan()
        users = [dynamo_to_dict(item) for item in response.get("Items", [])]
        return {"users": users}
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/users", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_user(request: CreateUserRequest):
    """ユーザー作成"""
    try:
        cognito_user_id = create_cognito_user(request.email, request.password)

        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        user_item = {
            "user_id": user_id,
            "cognito_user_id": cognito_user_id,
            "email": request.email,
            "display_name": request.display_name,
            "created_at": now,
            "updated_at": now,
        }

        users_table.put_item(Item=user_item)

        return {"user": user_item}

    except UsernameExistsException as e:
        raise HTTPException(status_code=409, detail="User already exists") from e
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/users/{user_id}", response_model=dict)
async def get_user(user_id: str):
    """ユーザー詳細取得"""
    try:
        response = users_table.get_item(Key={"user_id": user_id})
        user = response.get("Item")
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"user": dynamo_to_dict(user)}
    except HTTPException:
        raise
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.put("/users/{user_id}", response_model=dict)
async def update_user(user_id: str, request: UpdateUserRequest):
    """ユーザー更新"""
    try:
        now = datetime.now(timezone.utc).isoformat()

        response = users_table.update_item(
            Key={"user_id": user_id},
            UpdateExpression="SET display_name = :dn, updated_at = :ua",
            ExpressionAttributeValues={":dn": request.display_name, ":ua": now},
            ReturnValues="ALL_NEW",
        )

        return {"user": dynamo_to_dict(response["Attributes"])}
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(user_id: str):
    """ユーザー削除"""
    try:
        # ユーザー情報を取得してCognitoユーザーも削除
        user_response = users_table.get_item(Key={"user_id": user_id})
        user = user_response.get("Item")

        if user and "email" in user:
            delete_cognito_user(user["email"])

        users_table.delete_item(Key={"user_id": user_id})

        # ユーザーのロールも削除
        delete_user_roles(user_id)

    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# ロール管理エンドポイント
@app.get("/users/{user_id}/roles", response_model=dict)
async def get_user_roles(user_id: str):
    """ユーザーのロール一覧取得"""
    try:
        response = roles_table.query(
            KeyConditionExpression="user_id = :uid", ExpressionAttributeValues={":uid": user_id}
        )
        roles = [dynamo_to_dict(item) for item in response.get("Items", [])]
        return {"roles": roles}
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/users/{user_id}/roles", response_model=dict, status_code=status.HTTP_201_CREATED)
async def assign_role(user_id: str, request: AssignRoleRequest):
    """ロール割り当て"""
    try:
        role_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        role_item = {
            "user_id": user_id,
            "role_id": role_id,
            "event_id": request.event_id,
            "role_type": request.role_type,
            "created_at": now,
        }

        roles_table.put_item(Item=role_item)

        return {"role": role_item}
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.delete("/users/{user_id}/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_role(user_id: str, role_id: str):
    """ロール削除"""
    try:
        roles_table.delete_item(Key={"user_id": user_id, "role_id": role_id})
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.get("/events/{event_id}/roles", response_model=dict)
async def get_event_roles(event_id: str):
    """イベントのロール一覧取得"""
    try:
        response = roles_table.query(
            IndexName="EventIndex",
            KeyConditionExpression="event_id = :eid",
            ExpressionAttributeValues={":eid": event_id},
        )
        roles = [dynamo_to_dict(item) for item in response.get("Items", [])]
        return {"roles": roles}
    except DynamoDBClientError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


# Mangum ハンドラー
handler = Mangum(app, lifespan="off")
