const $ = (id) => document.getElementById(id);

const state = {
  file: null,
  beforeUrl: null,
  afterUrl: null,
  mode: "before",
  busy: false,
  comparePct: 50,
  history: [],
};

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
  tabCompare: $("tabCompare"),
  download: $("download"),
  imgBefore: $("imgBefore"),
  imgAfter: $("imgAfter"),
  emptyCompare: $("emptyCompare"),
  progressWrap: $("progressWrap") || null,
  progressBar: $("progressBar") || null,
  progressText: $("progressText") || null,
  progressPct: $("progressPct") || null,
  compareRange: $("compareRange") || null,
  compareBefore: $(".compare-before") || null,
  compareAfter: $(".compare-after") || null,
  compareHandle: $(".compare-handle") || null,
  toasts: $("toasts") || null,
  historyGrid: $("historyGrid") || null,
};

const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function setStatus(text, kind) {
  els.status.textContent = text;
  els.status.className = "status" + (kind ? " is-" + kind : "");
}

function showToast(text, kind) {
  if (!els.toasts) return;
  const toast = document.createElement("div");
  toast.className = "toast is-" + kind;
  toast.textContent = text;
  els.toasts.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

function setBusy(busy) {
  state.busy = busy;
  for (const button of [els.btnRemove, els.btnUpscale, els.btnBoth]) {
    button.disabled = busy || !state.file;
  }
  els.dropzone.classList.toggle("is-busy", busy);
  if (busy) {
    setStatus("Procesando... la primera vez puede tardar en descargar el modelo.", "busy");
    showToast("Procesando imagen...", "busy");
    startFakeProgress();
  } else {
    stopFakeProgress();
    if (els.progressWrap) els.progressWrap.style.display = "none";
  }
}

let progressInterval = null;
let progressValue = 0;

function startFakeProgress() {
  if (progressInterval) return;
  progressValue = 0;
  if (els.progressWrap) els.progressWrap.style.display = "flex";
  progressInterval = setInterval(() => {
    progressValue += Math.random() * 12;
    if (progressValue > 92) progressValue = 92;
    setProgress(progressValue);
  }, 200);
}

function stopFakeProgress() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
  progressValue = 0;
  setProgress(100);
  setTimeout(() => {
    if (els.progressWrap) els.progressWrap.style.display = "none";
  }, 400);
}

function setProgress(pct) {
  pct = Math.round(Math.max(0, Math.min(100, pct)));
  if (els.progressBar) els.progressBar.style.width = pct + "%";
  if (els.progressPct) els.progressPct.textContent = pct + "%";
}

function releaseUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

function render() {
  const hasBefore = Boolean(state.beforeUrl);
  const hasAfter = Boolean(state.afterUrl);
  const showCompare = state.mode === "compare" && hasBefore && hasAfter;

  els.imgBefore.hidden = state.mode !== "before" && state.mode !== "compare" || !hasBefore;
  els.imgAfter.hidden = state.mode !== "after" && state.mode !== "compare" || !hasAfter;

  if (els.emptyCompare) {
    els.emptyCompare.hidden = state.mode === "after" ? hasAfter : state.mode === "compare" ? false : hasBefore;
  }

  els.tabBefore.classList.toggle("is-active", state.mode === "before");
  els.tabAfter.classList.toggle("is-active", state.mode === "after");
  els.tabCompare.classList.toggle("is-active", state.mode === "compare");

  if (els.compareWrap) {
    els.compareWrap.classList.toggle("is-hidden", state.mode !== "compare");
  }

  applyCompare();
}

function showTab(mode) {
  state.mode = mode;
  render();
}

function applyCompare() {
  if (!els.compareRange || !els.compareBefore || !els.compareAfter || !els.compareHandle) return;
  const pct = state.comparePct;
  els.compareRange.value = pct;
  els.compareBefore.style.clipPath = "inset(0 " + (100 - pct) + "% 0 0)";
  els.compareAfter.style.clipPath = "inset(0 0 0 " + pct + "%)";
  els.compareHandle.style.left = pct + "%";
}

function addToHistory(url, name) {
  state.history.unshift({ url: url, name: name, id: Date.now() });
  if (state.history.length > 20) state.history.pop();
  renderHistory();
}

function renderHistory() {
  if (!els.historyGrid) return;
  els.historyGrid.innerHTML = "";
  if (state.history.length === 0) {
    els.historyGrid.innerHTML = '<p class="history-empty">Aun no hay imagenes procesadas.</p>';
    return;
  }
  for (const item of state.history) {
    const el = document.createElement("div");
    el.className = "history-item";
    el.title = item.name;
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Restaurar: " + item.name);
    const img = document.createElement("img");
    img.src = item.url;
    img.alt = item.name;
    img.loading = "lazy";
    const badge = document.createElement("span");
    badge.className = "history-badge";
    badge.textContent = item.name.length > 12 ? item.name.slice(0, 12) + "…" : item.name;
    el.appendChild(img);
    el.appendChild(badge);
    el.addEventListener("click", () => restoreFromHistory(item.url, item.name));
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        restoreFromHistory(item.url, item.name);
      }
    });
    els.historyGrid.appendChild(el);
  }
}

function restoreFromHistory(url, name) {
  releaseUrl(state.beforeUrl);
  releaseUrl(state.afterUrl);
  state.beforeUrl = url;
  state.afterUrl = null;
  els.imgBefore.src = state.beforeUrl;
  els.imgAfter.removeAttribute("src");
  els.download.removeAttribute("href");
  els.download.classList.add("is-disabled");
  showTab("before");
  for (const button of [els.btnRemove, els.btnUpscale, els.btnBoth]) {
    button.disabled = false;
  }
  setStatus("Restaurado: " + name, "ok");
  showToast("Restaurado: " + name, "ok");
}

function setFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Ese archivo no es una imagen.", "error");
    showToast("Ese archivo no es una imagen.", "error");
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    setStatus("Archivo demasiado grande (max. 25 MB).", "error");
    showToast("Archivo demasiado grande.", "error");
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
  showToast("Imagen cargada: " + file.name, "ok");
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
    showToast("Proceso completado.", "ok");
    addToHistory(state.afterUrl, state.file.name);
  } catch (error) {
    setStatus(error.message || "Algo salio mal.", "error");
    showToast(error.message || "Algo salio mal.", "error");
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
els.tabCompare.addEventListener("click", () => {
  if (state.beforeUrl && state.afterUrl) showTab("compare");
});

els.btnRemove.addEventListener("click", () => run("/api/remove"));
els.btnUpscale.addEventListener("click", () => run("/api/upscale"));
els.btnBoth.addEventListener("click", () => run("/api/process"));

els.download.addEventListener("click", (event) => {
  if (els.download.classList.contains("is-disabled")) event.preventDefault();
});

if (els.compareRange) {
  els.compareRange.addEventListener("input", (event) => {
    state.comparePct = parseInt(event.target.value, 10);
    applyCompare();
  });
}

syncRanges();
render();
renderHistory();
