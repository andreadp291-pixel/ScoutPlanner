from pydantic import BaseModel, EmailStr, Field


class RequestLinkIn(BaseModel):
    email: EmailStr


class OwnerSessionOut(BaseModel):
    session_token: str
    email: str


class OwnerSetPasswordIn(BaseModel):
    new_password: str = Field(min_length=10)


class OwnerLoginIn(BaseModel):
    email: EmailStr
    password: str


class ProjectCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    start_date: str  # 'YYYY-MM-DD'
    end_date: str    # 'YYYY-MM-DD'


class ProjectUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    start_date: str | None = None
    end_date: str | None = None


class ProjectOut(BaseModel):
    id: int
    name: str
    owner_email: str
    start_date: str
    end_date: str
    created_at: str


class ActivityCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    location: str = ""
    category: str
    color: str
    materials: str = ""
    start_at: str  # 'YYYY-MM-DDTHH:MM'
    end_at: str
    group_ids: list[int] = []


class ActivityUpdateIn(BaseModel):
    title: str | None = None
    description: str | None = None
    location: str | None = None
    category: str | None = None
    color: str | None = None
    materials: str | None = None
    start_at: str | None = None
    end_at: str | None = None
    group_ids: list[int] | None = None


class GroupCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class GroupOut(BaseModel):
    id: int
    project_id: int
    name: str
    created_at: str


class UploadOut(BaseModel):
    url: str
    filename: str
    kind: str  # 'image'


class ActivitySwapIn(BaseModel):
    id_a: int
    id_b: int


class ActivityOut(BaseModel):
    id: int
    project_id: int
    title: str
    description: str
    location: str
    category: str
    color: str
    materials: str
    start_at: str
    end_at: str
    created_by: str
    created_at: str
    updated_at: str
    group_ids: list[int] = []


class TokenCreateIn(BaseModel):
    person_name: str = Field(min_length=1, max_length=100)
    role: str = Field(pattern="^(editor|viewer)$")


class TokenOut(BaseModel):
    id: int
    person_name: str
    role: str
    revoked_at: str | None
    created_at: str
    last_used_at: str | None


class TokenCreatedOut(TokenOut):
    raw_token: str


class MemberInviteIn(BaseModel):
    person_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    role: str = Field(pattern="^(editor|viewer)$")


class MemberRoleUpdateIn(BaseModel):
    role: str = Field(pattern="^(editor|viewer)$")


class MemberOut(BaseModel):
    id: int  # project_members.id
    display_name: str
    email: str
    role: str
    must_change_password: bool
    created_at: str


class MemberLoginIn(BaseModel):
    email: EmailStr
    password: str


class MemberSessionOut(BaseModel):
    session_token: str
    display_name: str
    must_change_password: bool


class MemberChangePasswordIn(BaseModel):
    new_password: str = Field(min_length=10)


class MemberProjectOut(BaseModel):
    id: int
    name: str
    start_date: str
    end_date: str
    role: str
