import io
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def make_png_image(name="test.png", size=(100, 100), color=(120, 60, 30)):
    buf = io.BytesIO()
    img = Image.new("RGB", size, color)
    img.save(buf, format="PNG")
    buf.seek(0)
    return (name, buf, "image/png")


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_remove_background():
    name, buf, content_type = make_png_image()
    response = client.post(
        "/api/remove",
        files={"file": (name, buf, content_type)},
        data={"model": "u2net", "alpha_matting": "true", "fmt": "png", "quality": 94},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert len(response.content) > 0


def test_remove_background_invalid_model():
    name, buf, content_type = make_png_image()
    response = client.post(
        "/api/remove",
        files={"file": (name, buf, content_type)},
        data={"model": "modelo-inexistente", "fmt": "png"},
    )
    assert response.status_code == 400


def test_upscale():
    name, buf, content_type = make_png_image()
    response = client.post(
        "/api/upscale",
        files={"file": (name, buf, content_type)},
        data={"scale": "2", "sharpen": "1", "fmt": "png"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"


def test_process_both():
    name, buf, content_type = make_png_image()
    response = client.post(
        "/api/process",
        files={"file": (name, buf, content_type)},
        data={
            "model": "u2net",
            "alpha_matting": "true",
            "scale": "2",
            "sharpen": "1",
            "fmt": "png",
        },
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"


def test_remove_no_file():
    response = client.post(
        "/api/remove",
        data={"model": "u2net", "fmt": "png"},
    )
    assert response.status_code == 422
