import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile

from ..config import MAX_UPLOAD_BYTES, UPLOADS_BASE_URL, UPLOADS_DIR
from ..deps import Actor, require_project_role
from ..schemas import UploadOut

router = APIRouter(prefix="/projects/{project_id}/uploads", tags=["uploads"])

# Niente .svg: aperto direttamente dal browser può eseguire script sul dominio dell'API.
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
GPX_EXTENSIONS = {".gpx"}


@router.post("", response_model=UploadOut, status_code=201)
async def upload_file(file: UploadFile, actor: Actor = Depends(require_project_role("editor"))):
    original_name = file.filename or "file"
    ext = os.path.splitext(original_name)[1].lower()

    if ext in IMAGE_EXTENSIONS:
        kind = "image"
    elif ext in GPX_EXTENSIONS:
        kind = "gpx"
    else:
        raise HTTPException(400, "Tipo di file non supportato")

    # Lettura a blocchi: ci si ferma al limite invece di caricare tutto il file in memoria.
    chunks, size = [], 0
    while chunk := await file.read(1024 * 1024):
        size += len(chunk)
        if size > MAX_UPLOAD_BYTES:
            raise HTTPException(400, "File troppo grande (max 15 MB)")
        chunks.append(chunk)
    body = b"".join(chunks)

    project_dir = os.path.join(UPLOADS_DIR, str(actor.project_id))
    os.makedirs(project_dir, exist_ok=True)

    stored_name = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(project_dir, stored_name), "wb") as f:
        f.write(body)

    url = f"{UPLOADS_BASE_URL}/{actor.project_id}/{stored_name}"
    return UploadOut(url=url, filename=original_name, kind=kind)
