from datetime import date, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field, model_validator


def _iso_date(v: str) -> str:
    date.fromisoformat(v)
    return v


def _iso_datetime(v: str) -> str:
    datetime.strptime(v, "%Y-%m-%dT%H:%M")
    return v


# Le email vanno in minuscolo: "Andrea@x.it" e "andrea@x.it" sono la stessa persona.
Email = Annotated[EmailStr, AfterValidator(str.lower)]
IsoDate = Annotated[str, AfterValidator(_iso_date)]  # 'YYYY-MM-DD'
IsoDateTime = Annotated[str, AfterValidator(_iso_datetime)]  # 'YYYY-MM-DDTHH:MM'


class RequestLinkIn(BaseModel):
    email: Email


class OwnerSessionOut(BaseModel):
    session_token: str
    email: str


class OwnerSetPasswordIn(BaseModel):
    new_password: str = Field(min_length=10)


class OwnerLoginIn(BaseModel):
    email: Email
    password: str


class ProjectCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    start_date: IsoDate
    end_date: IsoDate


class ProjectUpdateIn(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    start_date: IsoDate | None = None
    end_date: IsoDate | None = None


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
    start_at: IsoDateTime
    end_at: IsoDateTime
    group_ids: list[int] = []


class ActivityUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    location: str | None = None
    category: str | None = None
    color: str | None = None
    materials: str | None = None
    start_at: IsoDateTime | None = None
    end_at: IsoDateTime | None = None
    group_ids: list[int] | None = None

    @model_validator(mode="after")
    def no_explicit_null(self):
        # Le colonne sono NOT NULL: un "null" esplicito darebbe un errore 500 sul database.
        for name in self.model_fields_set - {"group_ids"}:
            if getattr(self, name) is None:
                raise ValueError(f"{name} non può essere null")
        return self


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
    kind: str  # 'image' | 'gpx'


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
    email: Email
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
    email: Email
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
