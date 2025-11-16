from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    display_name: str = Field(..., min_length=1, max_length=100)


class CreateUserRequest(UserBase):
    password: str = Field(..., min_length=8)


class UpdateUserRequest(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=100)


class UserResponse(UserBase):
    user_id: str
    cognito_user_id: str | None = None
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class ConfirmEmailRequest(BaseModel):
    email: EmailStr
    confirmation_code: str = Field(..., min_length=6, max_length=6)


class ResendConfirmationRequest(BaseModel):
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8)


class AdminResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)


class AssignRoleRequest(BaseModel):
    event_id: str = Field(..., min_length=1)
    role_type: str = Field(..., pattern="^(admin|sales|viewer)$")


class RoleResponse(BaseModel):
    user_id: str
    role_id: str
    event_id: str
    role_type: str
    created_at: str

    class Config:
        from_attributes = True
