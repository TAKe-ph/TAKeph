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
  $("btnFoto").textContent = "📷 Foto → " + (limpiarRuta($("carpeta").value) || "Sin_carpeta");
  $("carpetasList").innerHTML = l.map((c) => `<option value="${c}">`).join("");
  $("chips").innerHTML = "";
  l.slice(0, 8).forEach((c) => {
    const b = document.createElement("button");
    b.textContent = c;
    b.className = c === $("carpeta").value ? "on" : "";
    b.onclick = () => { $("carpeta").value = c; pintarCarpetas(); };
    $("chips").appendChild(b);
  });
}
// "Muestra 3" -> "Muestra 4"
function siguienteNombre(c) {
  const m = c.match(/^(.*?)(\d+)$/);
  if (m) return m[1] + (parseInt(m[2], 10) + 1);
  return c ? c + " 2" : "Muestra 1";
}
$("btnNueva").onclick = () => {
  const n = prompt("Nombre de la nueva carpeta", siguienteNombre(limpiarRuta($("carpeta").value)));
  if (n === null) return;
  const c = limpiarRuta(n);
  if (!c) return;
  $("carpeta").value = c;
  recordarCarpeta(c);
  toast("📁 Ahora las fotos van a: " + c);
};

// ---------- Dictado por voz (si el navegador lo permite; si no, el 🎤 del teclado) ----------
const Reconocedor = window.SpeechRecognition || window.webkitSpeechRecognition;
function dictar(boton, alTexto) {
  let r;
  try { r = new Reconocedor(); } catch (e) { toast("Usa el 🎤 del teclado"); return; }
  r.lang = "es-ES"; r.interimResults = false; r.maxAlternatives = 1;
  boton.classList.add("escuchando");
  toast("🎤 Habla ahora…", 4000);
  r.onresult = (e) => {
    const t = e.results[0][0].transcript.trim();
    if (t) alTexto(t.charAt(0).toUpperCase() + t.slice(1));
  };
  r.onerror = () => toast("No se pudo usar el micro: usa el 🎤 del teclado");
  r.onend = () => boton.classList.remove("escuchando");
  r.start();
}
if (!Reconocedor) { $("btnMic").classList.add("hidden"); $("btnMicTitulo").classList.add("hidden"); }
// Carpeta por voz. Di "barra" para subcarpetas: "Obra Mayor barra Cuadro"
$("btnMic").onclick = () => dictar($("btnMic"), (t) => {
  const c = limpiarRuta(t.replace(/\s*\b(barra|slash)\b\s*/gi, "/"));
  if (c) { $("carpeta").value = c; recordarCarpeta(c); toast("📁 " + c); }
});
$("btnMicTitulo").onclick = () => dictar($("btnMicTitulo"), (t) => { $("titulo").value = t; });

// ---------- Título de cada foto ----------
function titulosRecientes() { try { return JSON.parse(localStorage.getItem("fotopc_titulos")) || []; } catch (e) { return []; } }
function recordarTitulo(t) {
  if (!t) return;
  const l = [t, ...titulosRecientes().filter((x) => x !== t)].slice(0, 12);
  try { localStorage.setItem("fotopc_titulos", JSON.stringify(l)); } catch (e) {}
}
// Muestra la vista previa y pide el título. onRepetir se llama dentro del clic (necesario en iPhone).
function pedirTitulo(blobPrevia, onRepetir) {
  return new Promise((res) => {
    const url = URL.createObjectURL(blobPrevia);
    $("tituloImg").src = url;
    $("titulo").value = "";
    $("tituloRepetir").classList.toggle("hidden", !onRepetir);
    const fin = (v) => { $("vTitulo").classList.add("hidden"); URL.revokeObjectURL(url); res(v); };
    $("chipsTitulo").innerHTML = "";
    titulosRecientes().forEach((t) => {
      const b = document.createElement("button");
      b.textContent = t;
      b.onclick = () => fin({ titulo: t });          // un toque y guardado
      $("chipsTitulo").appendChild(b);
    });
    $("tituloOk").onclick = () => fin({ titulo: $("titulo").value });
    $("tituloSin").onclick = () => fin({ titulo: "" });
    $("tituloRepetir").onclick = () => { fin({ repetir: true }); if (onRepetir) onRepetir(); };
    $("titulo").onkeydown = (e) => { if (e.key === "Enter") $("tituloOk").click(); };
    $("vTitulo").classList.remove("hidden");
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
function addHist(path, vista) { guardarHist([{ path, vista, estado: "pendiente", fecha: Date.now() }, ...hist()]); }
function setHist(path, estado) { guardarHist(hist().map((x) => (x.path === path ? { ...x, estado } : x))); }

function pintarHist() {
  const ul = $("historial");
  const h = hist();
  ul.innerHTML = h.length ? "" : '<li class="muted">Todavía no hay nada.</li>';
  const icono = { pendiente: "⏳", subida: "✅", error: "⚠️" };
  h.forEach((x) => {
    const li = document.createElement("li");
    const partes = (x.vista || x.path).split("/");
    li.innerHTML = `<span>${icono[x.estado] || ""}</span>
      <span class="grow"><b>${partes.pop()}</b><br><small class="muted">${partes.join("/")}</small></span>`;
    ul.appendChild(li);
  });
}


// ---------- Cola de subida ----------
async function encolar(blob, ext, tipo, titulo = "") {
  const carpeta = carpetaActual();
  recordarCarpeta(carpeta);
  const nombre = limpiarNombre(titulo);
  const vista = `${carpeta}/${nombre || sello() + "_" + rand()}.${ext}`;   // "Parte frontal.jpg"
  if (!Cifra.key) throw new Error("Falta la clave de cifrado");
  // Se cifra AQUÍ, en el móvil: a internet solo llega contenido ilegible
  const path = `${API.uid()}/${await Cifra.cifrarNombre(vista)}`;
  const cifrado = await Cifra.cifrarBlob(blob);
  await DB.put("cola", { id: path, path, blob: cifrado, type: "application/octet-stream", fecha: Date.now() });
  addHist(path, vista);
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

const abrirCamara = () => { $("inFoto").value = ""; $("inFoto").click(); };
$("btnFoto").onclick = abrirCamara;
$("inFoto").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const jpg = await fotoAJpeg(f);
    const r = await pedirTitulo(jpg, abrirCamara);
    if (r.repetir) return;
    await encolar(jpg, "jpg", "image/jpeg", r.titulo);
    recordarTitulo(limpiarNombre(r.titulo));
    toast(`📤 ${limpiarNombre(r.titulo) || "Foto"} → ${carpetaActual()}`);
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
    const pdf = crearPdf(paginas);
    const portada = new Blob([paginas[0].jpeg], { type: "image/jpeg" });
    cerrarScan();
    const r = await pedirTitulo(portada, null);
    await encolar(pdf, "pdf", "application/pdf", r.titulo);
    recordarTitulo(limpiarNombre(r.titulo));
    toast(`📤 PDF de ${n} página(s): ${limpiarNombre(r.titulo) || "documento"}`);
  } catch (err) { toast(err.message); }
  finally { $("scanFin").disabled = false; }
};
window.addEventListener("resize", () => { if (editor.img && !$("vScan").classList.contains("hidden")) editor.ajustar(); });

// ---------- Arranque ----------
$("carpeta").value = localStorage.getItem("fotopc_actual") || "";
$("carpeta").addEventListener("change", () => { $("carpeta").value = limpiarRuta($("carpeta").value); pintarCarpetas(); });
$("carpeta").addEventListener("input", () => { $("btnFoto").textContent = "📷 Foto → " + (limpiarRuta($("carpeta").value) || "Sin_carpeta"); });
pintarCarpetas();
pintarHist();

let ultimaPurga = 0;
async function purgar() {
  if (Date.now() - ultimaPurga < 3600e3 || !navigator.onLine) return;
  ultimaPurga = Date.now();
  try { await API.purgarAntiguas(24); } catch (e) {}
}
const volverLogin = iniciarLogin(() => { procesarCola(); purgar(); });
setInterval(purgar, 600000);
window.addEventListener("online", procesarCola);
setInterval(() => { if (navigator.onLine) procesarCola(); }, 30000);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
