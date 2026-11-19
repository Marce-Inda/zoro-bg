# ZoroCut

Clon de [remove.bg](https://remove.bg) con diseño inspirado en **Zoro** (One Piece). Quita el fondo de tus imágenes sin perder calidad y mejora su resolución localmente, usando [rembg](https://github.com/danielgatis/rembg) + ONNX en el backend y vanilla JS en el frontend.

---

## Características

- 🗡️ **Quitar fondo** con `rembg` (modelos `u2net`, `u2netp`, `isnet-general-use`)
- 🔍 **Mejorar calidad**: escalado hasta 4× con LANCZOS + nitidez (UnsharpMask)
- ⚡ **Ambos a la vez**: quita fondo y mejora calidad en un solo paso
- 📊 Barra de progreso durante el procesamiento
- 🔄 Comparador antes/después con slider interactivo
- 📜 Historial de imágenes procesadas en la sesión
- 💾 Descarga del resultado en PNG, WEBP o JPEG
- 🖥️ **Procesamiento local**: nada sale de tu máquina

---

## Endpoints API

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/health` | GET | Estado del servicio |
| `/api/remove` | POST | Quita fondo de la imagen |
| `/api/upscale` | POST | Mejora calidad (escala + nitidez) |
| `/api/process` | POST | Quita fondo **y** mejora calidad |

Parámetros comunes: `file` (imagen), `model`, `alpha_matting`, `scale`, `sharpen`, `fmt`, `quality`.

---

## Uso local (sin Docker)

```bash
# 1. Clonar
git clone https://github.com/Marce-Inda/zoro-bg.git
cd zoro-bg

# 2. Crear entorno virtual
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Ejecutar
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Abre http://localhost:8000 en tu navegador.

---

## Uso con Docker

```bash
# Construir y levantar
docker compose up --build

# O solo construir la imagen
docker build -t zoro-bg .
```

El servicio quedará disponible en http://localhost:8000.

---

## Tests

```bash
pip install -r requirements-dev.txt
python -m pytest tests/ -v
```

---

## CI

Cada push/PR a `main` ejecuta:
1. Compilación de los archivos Python (lint básico)
2. Tests con pytest
3. Build de la imagen Docker

---

## Estructura del proyecto

```
zoro-bg/
├── app/
│   ├── __init__.py
│   └── main.py          # Backend FastAPI
├── static/
│   ├── index.html       # Frontend
│   ├── styles.css       # Estilos (tema Zoro)
│   └── app.js           # Lógica del frontend
├── tests/
│   └── test_main.py     # Tests de la API
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── requirements-dev.txt
├── .dockerignore
├── .github/workflows/ci.yml
└── README.md
```

---

## Licencia

MIT
