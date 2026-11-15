// ============================================================
//  App del MÓVIL: hacer foto / escanear -> cola -> subir a internet
//  Si no hay cobertura, las fotos esperan en el móvil y se suben solas.
// ============================================================
let procesando = false;

// ---------- Carpetas recientes ----------
function carpetasRecientes() {
  try { return JSON.parse(localStorage.getItem("fotopc_carpetas")) || []; } catch (e) { return []; }
}
function recordarCarpeta(c) {
  const l = [c, ...carpetasRecientes().filter((x) => x !== c)].slice(0, 10);
  try { localStorage.setItem("fotopc_carpetas", JSON.stringify(l)); localStorage.setItem("fotopc_actual", c); } catch (e) {}
  pintarCarpetas();
}
function pintarCarpetas() {
  const l = carpetasRecientes();
  $("carpetasList").innerHTML = l.map((c) => `<option value="${c}">`).join("");
  $("chips").innerHTML = "";
  l.slice(0, 6).forEach((c) => {
    const b = document.createElement("button");
    b.textContent = c;
    b.className = c === $("carpeta").value ? "on" : "";
    b.onclick = () => { $("carpeta").value = c; pintarCarpetas(); };
    $("chips").appendChild(b);
  });
}
function carpetaActual() {
  const c = limpiarRuta($("carpeta").value) || "Sin_carpeta";
  $("carpeta").value = c;
  return c;
}

// ---------- Historial ----------
function hist() { try { return JSON.parse(localStorage.getItem("fotopc_hist")) || []; } catch (e) { return []; } }
function guardarHist(h) { try { localStorage.setItem("fotopc_hist", JSON.stringify(h.slice(0, 40))); } catch (e) {} pintarHist(); }
function addHist(path) { guardarHist([{ path, estado: "pendiente", fecha: Date.now() }, ...hist()]); }
function setHist(path, estado) { guardarHist(hist().map((x) => (x.path === path ? { ...x, estado } : x))); }

function pintarHist() {
  const ul = $("historial");
  const h = hist();
  ul.innerHTML = h.length ? "" : '<li class="muted">Todavía no hay nada.</li>';
  const icono = { pendiente: "⏳", subida: "✅", error: "⚠️" };
  h.forEach((x) => {
    const li = document.createElement("li");
    const partes = x.path.split("/");
    li.innerHTML = `<span>${icono[x.estado] || ""}</span>
      <span class="grow"><b>${partes.pop()}</b><br><small class="muted">${partes.join("/")}</small></span>`;
    if (x.estado === "subida") {
      const b = document.createElement("button");
      b.className = "link"; b.textContent = "🔗";
      b.title = "Compartir enlace";
      b.onclick = () => compartirEnlace(x.path);
      li.appendChild(b);
    }
    ul.appendChild(li);
  });
}

async function compartirEnlace(path) {
  try {
    const url = await API.signedUrl(path);
    if (navigator.share) await navigator.share({ title: path.split("/").pop(), url });
    else { await navigator.clipboard.writeText(url); toast("Enlace copiado (válido 7 días)"); }
  } catch (e) {
    if (e.name !== "AbortError") toast(e.message === "NO_SESSION" ? "Vuelve a entrar" : "No se pudo crear el enlace");
  }
}

// ---------- Cola de subida ----------
async function encolar(blob, ext, tipo) {
  const carpeta = carpetaActual();
  recordarCarpeta(carpeta);
  const path = `${carpeta}/${sello()}_${rand()}.${ext}`;
  await DB.put("cola", { id: path, path, blob, type: tipo, fecha: Date.now() });
  addHist(path);
  procesarCola();
}

async function actualizarPend() {
  const n = (await DB.all("cola")).length;
  const b = $("pendCount");
  b.textContent = `${n} pendiente${n === 1 ? "" : "s"}`;
  b.classList.toggle("hidden", n === 0);
}

async function procesarCola() {
  if (procesando) return;
  procesando = true;
  try {
    const items = (await DB.all("cola")).sort((a, b) => a.fecha - b.fecha);
    for (const it of items) {
      try {
        await API.upload(it.path, it.blob, it.type);
        await DB.del("cola", it.id);
        setHist(it.path, "subida");
      } catch (e) {
        if (e.message === "NO_SESSION") { toast("Sesión caducada: vuelve a entrar"); volverLogin(); break; }
        setHist(it.path, navigator.onLine ? "error" : "pendiente");
        if (!navigator.onLine) toast("Sin conexión: se subirá automáticamente");
        break;
      }
    }
  } finally {
    procesando = false;
    actualizarPend();
  }
}

// ---------- Foto normal ----------
async function fotoAJpeg(file) {
  const c = await cargarImagen(file, CONFIG.FOTO_MAX_PX);
  return canvasABlob(c, CONFIG.FOTO_CALIDAD);
}

$("btnFoto").onclick = () => { $("inFoto").value = ""; $("inFoto").click(); };
$("inFoto").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    await encolar(await fotoAJpeg(f), "jpg", "image/jpeg");
    toast("📤 Foto guardada en " + carpetaActual());
  } catch (err) { toast(err.message); }
};

$("btnGaleria").onclick = () => { $("inGaleria").value = ""; $("inGaleria").click(); };
$("inGaleria").onchange = async (e) => {
  const files = [...e.target.files];
  for (const f of files) {
    try {
      if (f.type === "application/pdf") await encolar(f, "pdf", "application/pdf");
      else await encolar(await fotoAJpeg(f), "jpg", "image/jpeg");
    } catch (err) { toast(err.message); }
  }
  if (files.length) toast(`📤 ${files.length} archivo(s) en cola`);
};

// ---------- Escáner ----------
const editor = new EditorEsquinas($("scanCanvas"));
let paginas = [];       // [{jpeg, w, h}]
let recorte = null;     // canvas enderezado actual
let filtro = "doc";
let resultado = null;   // canvas con filtro

function abrirScan() { $("vScan").classList.remove("hidden"); }
function cerrarScan() { $("vScan").classList.add("hidden"); paginas = []; recorte = resultado = null; }
function modoEsquinas() {
  $("scanInfo").textContent = "Arrastra las 4 esquinas al borde del papel";
  $("filtros").classList.add("hidden");
  $("scanBar1").classList.remove("hidden");
  $("scanBar2").classList.add("hidden");
}
function modoResultado() {
  $("scanInfo").textContent = `Página ${paginas.length + 1}`;
  $("filtros").classList.remove("hidden");
  $("scanBar1").classList.add("hidden");
  $("scanBar2").classList.remove("hidden");
  $("nPag").textContent = paginas.length + 1;
}
function pedirFotoScan() { $("inScan").value = ""; $("inScan").click(); }

$("btnScan").onclick = () => { paginas = []; pedirFotoScan(); };
$("inScan").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) { if (!paginas.length) cerrarScan(); return; }
  abrirScan();
  modoEsquinas();
  const c = await cargarImagen(f, 2400);
  requestAnimationFrame(() => editor.cargar(c));
};
$("scanCancel").onclick = cerrarScan;
$("scanOk").onclick = () => {
  $("scanInfo").textContent = "Procesando…";
  setTimeout(() => {
    recorte = enderezar(editor.img, editor.q);
    pintarFiltro();
    modoResultado();
  }, 30);
};
function pintarFiltro() {
  resultado = aplicarFiltro(recorte, filtro);
  editor.mostrarResultado(resultado);
  document.querySelectorAll("#filtros button").forEach((b) => b.classList.toggle("on", b.dataset.f === filtro));
}
document.querySelectorAll("#filtros button").forEach((b) => {
  b.onclick = () => { filtro = b.dataset.f; pintarFiltro(); };
});
async function guardarPagina() {
  const blob = await canvasABlob(resultado, 0.8);
  paginas.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), w: resultado.width, h: resultado.height });
}
$("scanRetry").onclick = pedirFotoScan;
$("scanAdd").onclick = async () => { await guardarPagina(); pedirFotoScan(); };
$("scanFin").onclick = async () => {
  $("scanFin").disabled = true;
  try {
    await guardarPagina();
    const n = paginas.length;
    await encolar(crearPdf(paginas), "pdf", "application/pdf");
    toast(`📤 PDF de ${n} página(s) guardado`);
    cerrarScan();
  } catch (err) { toast(err.message); }
  finally { $("scanFin").disabled = false; }
};
window.addEventListener("resize", () => { if (editor.img && !$("vScan").classList.contains("hidden")) editor.ajustar(); });

// ---------- Arranque ----------
$("carpeta").value = localStorage.getItem("fotopc_actual") || "";
$("carpeta").addEventListener("change", () => { $("carpeta").value = limpiarRuta($("carpeta").value); pintarCarpetas(); });
pintarCarpetas();
pintarHist();

const volverLogin = iniciarLogin(() => { procesarCola(); });
window.addEventListener("online", procesarCola);
setInterval(() => { if (navigator.onLine) procesarCola(); }, 30000);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
