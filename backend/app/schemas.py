from pydantic import BaseModel, EmailStr, Field


class RequestLinkIn(BaseModel):
    email: EmailStr


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
    start_at: str  # 'YYYY-MM-DDTHH:MM'
    end_at: str


class ActivityUpdateIn(BaseModel):
    title: str | None = None
    description: str | None = None
    location: str | None = None
    category: str | None = None
    color: str | None = None
    start_at: str | None = None
    end_at: str | None = None


class ActivityOut(BaseModel):
    id: int
    project_id: int
    title: str
    description: str
    location: str
    category: str
    color: str
    start_at: str
    end_at: str
    created_by: str
    created_at: str
    updated_at: str


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
