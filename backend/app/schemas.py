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


class GoogleLoginIn(BaseModel):
    access_token: str = Field(min_length=1)


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
    assignees: list[str] = []


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
    assignees: list[str] | None = None

    @model_validator(mode="after")
    def no_explicit_null(self):
        # Le colonne sono NOT NULL: un "null" esplicito darebbe un errore 500 sul database.
        for name in self.model_fields_set - {"group_ids", "assignees"}:
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
    assignees: list[str] = []
    done_refs: list[str] = []  # responsabili che hanno segnato la loro parte come fatta


class ActivityDoneIn(BaseModel):
    done: bool
    person_ref: str | None = None  # di chi; se manca, di chi fa la richiesta


class EmailPrefsIO(BaseModel):
    notifications: bool
    report: bool


class TokenCreateIn(BaseModel):
    person_name: str = Field(min_length=1, max_length=100)
    role: str = Field(pattern="^(editor|commenter|viewer)$")
    expires_in_days: int | None = Field(default=None, ge=1, le=365)  # None = non scade


class TokenUpdateIn(BaseModel):
    role: str | None = Field(default=None, pattern="^(editor|commenter|viewer)$")
    expires_in_days: int | None = Field(default=None, ge=1, le=365)  # nuova scadenza, da adesso
    no_expiry: bool = False  # toglie la scadenza


class TokenOut(BaseModel):
    id: int
    person_name: str
    role: str
    revoked_at: str | None
    created_at: str
    last_used_at: str | None
    expires_at: str | None = None


class TokenCreatedOut(TokenOut):
    raw_token: str


class MemberInviteIn(BaseModel):
    person_name: str = Field(min_length=1, max_length=100)
    email: Email
    role: str = Field(pattern="^(editor|commenter|viewer)$")


class MemberRoleUpdateIn(BaseModel):
    role: str = Field(pattern="^(editor|commenter|viewer)$")


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


class ProjectLocationIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    lat: float
    lon: float


class ProjectLocationOut(BaseModel):
    project_id: int
    name: str
    lat: float
    lon: float
    updated_at: str


class PoiCreateIn(BaseModel):
    kind: str = Field(pattern="^(hospital|pharmacy|fire_station|other)$")
    name: str = Field(min_length=1, max_length=200)
    phone: str = ""
    address: str = ""
    lat: float | None = None
    lon: float | None = None
    notes: str = ""
    hours: str = ""


class PoiUpdateIn(BaseModel):
    kind: str | None = Field(default=None, pattern="^(hospital|pharmacy|fire_station|other)$")
    name: str | None = Field(default=None, min_length=1, max_length=200)
    phone: str | None = None
    address: str | None = None
    lat: float | None = None
    lon: float | None = None
    notes: str | None = None
    hours: str | None = None
    @model_validator(mode="after")
    def no_explicit_null(self):
        for name in self.model_fields_set - {"lat", "lon"}:
            if getattr(self, name) is None:
                raise ValueError(f"{name} non può essere null")
        return self


class PoiOut(BaseModel):
    id: int
    project_id: int
    kind: str
    name: str
    phone: str
    address: str
    lat: float | None
    lon: float | None
    notes: str
    hours: str
    created_at: str


class PageCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = ""


class PageUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = None
    @model_validator(mode="after")
    def no_explicit_null(self):
        for name in self.model_fields_set - {"lat", "lon"}:
            if getattr(self, name) is None:
                raise ValueError(f"{name} non può essere null")
        return self


class PageOut(BaseModel):
    id: int
    project_id: int
    title: str
    content: str
    position: int
    created_by: str
    created_at: str
    updated_at: str


class PersonOut(BaseModel):
    ref: str
    name: str
    kind: str  # 'owner' | 'member' | 'link'


class MaterialActivityOut(BaseModel):
    id: int
    title: str


class MaterialOut(BaseModel):
    key: str
    name: str
    activities: list[MaterialActivityOut]
    procure_ref: str | None = None
    transport_ref: str | None = None


class MaterialAssignIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    procure_ref: str | None = None
    transport_ref: str | None = None


class GoogleSessionOut(BaseModel):
    owner: OwnerSessionOut
    member: MemberSessionOut | None = None  # presente se l'email è di un membro invitato
    owner_projects: int  # quanti progetti ha come owner: serve a scegliere la pagina d'arrivo


class HistoryOut(BaseModel):
    id: int
    entity: str  # 'activity' | 'page'
    entity_id: int
    action: str  # create | update | delete | restore | purge
    actor: str
    title: str
    summary: str
    created_at: str
    restorable: bool  # c'è lo stato precedente da ripristinare


class TrashItemOut(BaseModel):
    entity: str
    id: int
    title: str
    deleted_at: str


class CommentCreateIn(BaseModel):
    entity: str = Field(pattern="^(activity|page)$")
    entity_id: int
    parent_id: int | None = None
    body: str = Field(min_length=1, max_length=2000)


class CommentResolveIn(BaseModel):
    resolved: bool


class CommentOut(BaseModel):
    id: int
    entity: str
    entity_id: int
    parent_id: int | None
    author: str
    author_ref: str
    body: str
    resolved_at: str | None
    created_at: str


class AccessRequestIn(BaseModel):
    name: str = Field(default="", max_length=100)
    message: str = Field(default="", max_length=500)


class AccessRequestOut(BaseModel):
    id: int
    email: str
    name: str
    message: str
    status: str
    created_at: str


class AccessApproveIn(BaseModel):
    role: str = Field(pattern="^(editor|commenter|viewer)$")


class TransferIn(BaseModel):
    email: Email
