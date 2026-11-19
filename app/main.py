from __future__ import annotations

from functools import lru_cache
from io import BytesIO
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageFilter, ImageOps
from rembg import new_session, remove

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_SIDE = 6000
MAX_SCALE = 4.0
MAX_OUTPUT_PIXELS = 40_000_000
ALLOWED_MODELS = ("u2net", "u2netp", "isnet-general-use")
ALLOWED_FORMATS = ("png", "jpeg", "webp")

app = FastAPI(title="ZoroCut API", version="0.1.0")


@lru_cache(maxsize=4)
def get_session(model: str):
    return new_session(model)


def normalize_model(model: str) -> str:
    value = (model or "u2net").strip().lower()
    if value not in ALLOWED_MODELS:
        raise HTTPException(status_code=400, detail="Modelo no soportado.")
    return value


def normalize_format(fmt: str) -> str:
    value = (fmt or "png").strip().lower()
    if value == "jpg":
        value = "jpeg"
    if value not in ALLOWED_FORMATS:
        raise HTTPException(status_code=400, detail="Formato no soportado.")
    return value


async def read_image(file: UploadFile) -> Image.Image:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Archivo demasiado grande (máx. 25 MB).")
    try:
        image = Image.open(BytesIO(data))
        image.load()
    except Exception:
        raise HTTPException(status_code=400, detail="No pude leer la imagen. Usa PNG, JPG o WEBP.")
    image = ImageOps.exif_transpose(image)
    if max(image.size) > MAX_SIDE:
        raise HTTPException(
            status_code=413,
            detail=f"La imagen supera el lado máximo de {MAX_SIDE}px.",
        )
    return image


def cut_background(image: Image.Image, model: str, alpha_matting: bool) -> Image.Image:
    try:
        result = remove(image, session=get_session(model), alpha_matting=alpha_matting)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"No pude ejecutar el modelo ({exc}).")
    if isinstance(result, Image.Image):
        return result.convert("RGBA")
    return Image.open(BytesIO(result)).convert("RGBA")


def encode(image: Image.Image, fmt: str, quality: int) -> tuple[bytes, str]:
    quality = max(40, min(100, int(quality)))
    buffer = BytesIO()
    if fmt == "jpeg":
        alpha = image.getchannel("A")
        canvas = Image.new("RGB", image.size, (255, 255, 255))
        canvas.paste(image.convert("RGB"), mask=alpha)
        canvas.save(buffer, format="JPEG", quality=quality, optimize=True, progressive=True)
        return buffer.getvalue(), "image/jpeg"
    if fmt == "webp":
        image.save(buffer, format="WEBP", quality=quality, method=6)
        return buffer.getvalue(), "image/webp"
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue(), "image/png"


def enhance(image: Image.Image, scale: float, sharpen: float) -> Image.Image:
    scale = max(1.0, min(MAX_SCALE, float(scale)))
    sharpen = max(0.0, min(2.0, float(sharpen)))
    if scale > 1.0:
        width = max(1, round(image.width * scale))
        height = max(1, round(image.height * scale))
        if width * height > MAX_OUTPUT_PIXELS:
            raise HTTPException(
                status_code=413,
                detail="El resultado sería demasiado grande. Baja la escala.",
            )
        image = image.resize((width, height), Image.LANCZOS)
    if sharpen > 0.0:
        alpha = image.getchannel("A")
        rgb = image.convert("RGB").filter(
            ImageFilter.UnsharpMask(radius=2, percent=round(80 * sharpen), threshold=2)
        )
        image = Image.merge("RGBA", (*rgb.split(), alpha))
    return image


def build_response(image: Image.Image, fmt: str, quality: int) -> Response:
    payload, media_type = encode(image, fmt, quality)
    return Response(content=payload, media_type=media_type)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/remove")
async def api_remove(
    file: UploadFile = File(...),
    model: str = Form("u2net"),
    alpha_matting: bool = Form(True),
    fmt: str = Form("png"),
    quality: int = Form(94),
):
    image = await read_image(file)
    model = normalize_model(model)
    fmt = normalize_format(fmt)
    result = cut_background(image, model, alpha_matting)
    return build_response(result, fmt, quality)


@app.post("/api/upscale")
async def api_upscale(
    file: UploadFile = File(...),
    scale: float = Form(2.0),
    sharpen: float = Form(1.0),
    fmt: str = Form("png"),
    quality: int = Form(94),
):
    image = await read_image(file)
    fmt = normalize_format(fmt)
    result = enhance(image.convert("RGBA"), scale, sharpen)
    return build_response(result, fmt, quality)


@app.post("/api/process")
async def api_process(
    file: UploadFile = File(...),
    model: str = Form("u2net"),
    alpha_matting: bool = Form(True),
    scale: float = Form(2.0),
    sharpen: float = Form(1.0),
    fmt: str = Form("png"),
    quality: int = Form(94),
):
    image = await read_image(file)
    model = normalize_model(model)
    fmt = normalize_format(fmt)
    result = cut_background(image, model, alpha_matting)
    result = enhance(result, scale, sharpen)
    return build_response(result, fmt, quality)


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
