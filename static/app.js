const $ = (id) => document.getElementById(id);

const state = { file: null, beforeUrl: null, afterUrl: null, mode: "before", busy: false };

const els = {
  dropzone: $("dropzone"),
  file: $("file"),
  model: $("model"),
  scale: $("scale"),
  scaleOut: $("scaleOut"),
  sharpen: $("sharpen"),
  sharpenOut: $("sharpenOut"),
  fmt: $("fmt"),
  alpha: $("alpha"),
  btnRemove: $("btnRemove"),
  btnUpscale: $("btnUpscale"),
  btnBoth: $("btnBoth"),
  status: $("status"),
  tabBefore: $("tabBefore"),
  tabAfter: $("tabAfter"),
  download: $("download"),
  imgBefore: $("imgBefore"),
  imgAfter: $("imgAfter"),
  empty: $("empty"),
};

const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function setStatus(text, kind) {
  els.status.textContent = text;
  els.status.className = "status" + (kind ? " is-" + kind : "");
}

function setBusy(busy) {
  state.busy = busy;
  for (const button of [els.btnRemove, els.btnUpscale, els.btnBoth]) {
    button.disabled = busy || !state.file;
  }
  els.dropzone.classList.toggle("is-busy", busy);
  if (busy) {
    setStatus("Procesando... la primera vez puede tardar en descargar el modelo.", "busy");
  }
}

function releaseUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

function render() {
  const hasBefore = Boolean(state.beforeUrl);
  const hasAfter = Boolean(state.afterUrl);
  els.imgBefore.hidden = state.mode !== "before" || !hasBefore;
  els.imgAfter.hidden = state.mode !== "after" || !hasAfter;
  els.empty.hidden = state.mode === "after" ? hasAfter : hasBefore;
  els.tabBefore.classList.toggle("is-active", state.mode === "before");
  els.tabAfter.classList.toggle("is-active", state.mode === "after");
}

function showTab(mode) {
  state.mode = mode;
  render();
}

function setFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Ese archivo no es una imagen.", "error");
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    setStatus("Archivo demasiado grande (max. 25 MB).", "error");
    return;
  }
  releaseUrl(state.beforeUrl);
  releaseUrl(state.afterUrl);
  state.file = file;
  state.beforeUrl = URL.createObjectURL(file);
  state.afterUrl = null;
  els.imgBefore.src = state.beforeUrl;
  els.imgAfter.removeAttribute("src");
  els.download.removeAttribute("href");
  els.download.classList.add("is-disabled");
  showTab("before");
  for (const button of [els.btnRemove, els.btnUpscale, els.btnBoth]) {
    button.disabled = false;
  }
  setStatus("Imagen lista: " + file.name, "ok");
}

async function run(endpoint) {
  if (!state.file || state.busy) return;
  setBusy(true);
  const body = new FormData();
  body.append("file", state.file);
  body.append("model", els.model.value);
  body.append("alpha_matting", els.alpha.checked ? "true" : "false");
  body.append("fmt", els.fmt.value);
  body.append("quality", "94");
  body.append("scale", els.scale.value);
  body.append("sharpen", els.sharpen.value);
  try {
    const response = await fetch(endpoint, { method: "POST", body });
    if (!response.ok) {
      let message = "Error " + response.status;
      try {
        const data = await response.json();
        if (data.detail) message = data.detail;
      } catch {}
      throw new Error(message);
    }
    const blob = await response.blob();
    releaseUrl(state.afterUrl);
    state.afterUrl = URL.createObjectURL(blob);
    els.imgAfter.src = state.afterUrl;
    const ext = EXT[blob.type] || "png";
    els.download.href = state.afterUrl;
    els.download.download = "zorocut-" + Date.now() + "." + ext;
    els.download.classList.remove("is-disabled");
    showTab("after");
    setStatus("Listo. " + Math.round(blob.size / 1024) + " KB generados.", "ok");
  } catch (error) {
    setStatus(error.message || "Algo salio mal.", "error");
  } finally {
    setBusy(false);
  }
}

function syncRanges() {
  els.scaleOut.textContent = String(parseFloat(els.scale.value).toFixed(1)).replace(/\.0$/, "");
  els.sharpenOut.textContent = parseFloat(els.sharpen.value).toFixed(1);
}

els.file.addEventListener("change", () => setFile(els.file.files[0]));

for (const type of ["dragenter", "dragover"]) {
  els.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropzone.classList.add("is-drag");
  });
}

for (const type of ["dragleave", "dragend"]) {
  els.dropzone.addEventListener(type, () => els.dropzone.classList.remove("is-drag"));
}

els.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.dropzone.classList.remove("is-drag");
  setFile(event.dataTransfer.files[0]);
});

els.scale.addEventListener("input", syncRanges);
els.sharpen.addEventListener("input", syncRanges);

els.tabBefore.addEventListener("click", () => showTab("before"));
els.tabAfter.addEventListener("click", () => showTab("after"));

els.btnRemove.addEventListener("click", () => run("/api/remove"));
els.btnUpscale.addEventListener("click", () => run("/api/upscale"));
els.btnBoth.addEventListener("click", () => run("/api/process"));

els.download.addEventListener("click", (event) => {
  if (els.download.classList.contains("is-disabled")) event.preventDefault();
});

syncRanges();
render();
