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
    b.onclick = () => {
      if (editando) return menuCarpeta(c);
      $("carpeta").value = c; pintarCarpetas();
    };
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
    const esVideo = (blobPrevia.type || "").startsWith("video/");
    $("tituloImg").classList.toggle("hidden", esVideo);
    $("tituloVid").classList.toggle("hidden", !esVideo);
    if (esVideo) $("tituloVid").src = url; else $("tituloImg").src = url;
    $("titulo").value = "";
    $("tituloRepetir").classList.toggle("hidden", !onRepetir);
    const fin = (v) => {
      $("vTitulo").classList.add("hidden");
      try { $("tituloVid").pause(); $("tituloVid").removeAttribute("src"); $("tituloVid").load(); } catch (e) {}
      URL.revokeObjectURL(url); res(v);
    };
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

// ---------- Menú inferior ----------
function menu(titulo, opciones) {
  $("menuTitulo").textContent = titulo;
  const cont = $("menuOpciones");
  cont.innerHTML = "";
  opciones.forEach((o) => {
    const b = document.createElement("button");
    b.className = (o.peligro ? "danger" : "secondary") + " big";
    b.textContent = o.txt;
    b.onclick = async () => {
      cerrarMenu();
      try { await o.fn(); } catch (e) { toast(e.message === "NO_SESSION" ? "Vuelve a entrar" : e.message); }
    };
    cont.appendChild(b);
  });
  $("vMenu").classList.remove("hidden");
}
function cerrarMenu() { $("vMenu").classList.add("hidden"); }
$("menuCancelar").onclick = cerrarMenu;
$("vMenu").onclick = (e) => { if (e.target === $("vMenu")) cerrarMenu(); };

// ---------- Editar carpetas ----------
let editando = false;
$("btnEditar").onclick = () => {
  editando = !editando;
  $("btnEditar").textContent = editando ? "✅ Hecho" : "✏️ Editar";
  $("chips").classList.toggle("editando", editando);
  if (editando) toast("Toca una carpeta para cambiarla o quitarla");
};
function quitarCarpetaDeLista(c) {
  const l = carpetasRecientes().filter((x) => x !== c);
  try { localStorage.setItem("fotopc_carpetas", JSON.stringify(l)); } catch (e) {}
  if ($("carpeta").value === c) $("carpeta").value = l[0] || "";
  pintarCarpetas();
}
function fotosDe(c) { return hist().filter((x) => editable(x) && x.vista.startsWith(c + "/")); }
function todoDe(c) { return hist().filter((x) => borrable(x) && x.vista.startsWith(c + "/")); }
function menuCarpeta(c) {
  const n = todoDe(c).length;
  menu(`📁 ${c}`, [
    { txt: "✏️ Cambiar nombre", fn: async () => {
      const nueva = limpiarRuta(prompt("Nuevo nombre de la carpeta", c) || "");
      if (!nueva || nueva === c) return;
      const r = await moverFotos(fotosDe(c), (v) => nueva + v.slice(c.length));
      const l = carpetasRecientes().map((x) => (x === c ? nueva : x));
      try { localStorage.setItem("fotopc_carpetas", JSON.stringify([...new Set(l)])); } catch (e) {}
      if ($("carpeta").value === c) $("carpeta").value = nueva;
      pintarCarpetas();
      toast(`📁 ${nueva}` + (r.enPC ? ` · ${r.enPC} ya estaban en el PC` : ""));
    } },
    { txt: "➖ Quitar de la lista", fn: () => quitarCarpetaDeLista(c) },
    ...(n ? [{ txt: `🗑️ Borrar sus ${n} foto(s) pendientes`, peligro: true, fn: async () => {
      if (!confirm(`¿Borrar ${n} foto(s) de "${c}" que aún no han llegado al PC?`)) return;
      for (const x of todoDe(c)) await borrarFoto(x);
      quitarCarpetaDeLista(c);
      toast("🗑️ Borradas");
    } }] : []),
  ]);
}

// ---------- Editar fotos (mientras no hayan llegado al PC) ----------
function editable(x) { return x.vista && !x.partes && x.estado !== "enpc" && Cifra.esCifrado(x.path.split("/").pop()); }
function borrable(x) { return x.vista && x.estado !== "enpc" && Cifra.esCifrado(x.path.split("/").pop()); }

async function cambiarVista(x, nuevaVista) {
  if (procesando) throw new Error("Espera un momento: se está subiendo");
  const nuevoPath = `${API.uid()}/${await Cifra.cifrarNombre(nuevaVista)}`;
  const enCola = await DB.get("cola", x.path);
  if (enCola) {
    await DB.del("cola", x.path);
    await DB.put("cola", { ...enCola, id: nuevoPath, path: nuevoPath });
  } else {
    await API.move(x.path, nuevoPath);
  }
  guardarHist(hist().map((h) => (h.path === x.path ? { ...h, path: nuevoPath, vista: nuevaVista } : h)));
}
async function moverFotos(lista, nuevaVista) {
  let enPC = 0;
  for (const x of lista) {
    try { await cambiarVista(x, nuevaVista(x.vista)); }
    catch (e) { if (e.message === "YA_DESCARGADA") { enPC++; setHist(x.path, "enpc"); } else throw e; }
  }
  return { enPC };
}
async function borrarFoto(x) {
  const enNube = [];
  for (const p of x.partes || [x.path]) {
    if (await DB.get("cola", p)) await DB.del("cola", p); else enNube.push(p);
  }
  if (enNube.length) await API.remove(enNube);
  guardarHist(hist().filter((h) => h.path !== x.path));
  actualizarPend();
}
function menuFoto(x) {
  if (x.partes && borrable(x)) {
    menu(`🎬 ${x.vista.split("/").pop()}`, [
      { txt: "🗑️ Borrar vídeo", peligro: true, fn: async () => {
        if (!confirm("¿Borrar este vídeo?")) return;
        await borrarFoto(x); toast("🗑️ Borrado");
      } },
    ]);
    return;
  }
  if (!editable(x)) { toast(x.estado === "enpc" ? "💻 Ya está en el PC: cámbiala desde el Explorador" : "Esta foto no se puede editar"); return; }
  const partes = x.vista.split("/"), archivo = partes.pop(), carpeta = partes.join("/");
  const punto = archivo.lastIndexOf("."), base = archivo.slice(0, punto), ext = archivo.slice(punto);
  menu(`${archivo}\n📁 ${carpeta}`, [
    { txt: "✏️ Cambiar nombre", fn: async () => {
      const n = limpiarNombre(prompt("Nuevo nombre de la foto", base) || "");
      if (!n || n === base) return;
      const r = await moverFotos([x], () => `${carpeta}/${n}${ext}`);
      toast(r.enPC ? "💻 Ya había llegado al PC: cámbiala allí" : `✏️ ${n}${ext}`);
    } },
    { txt: "📁 Mover a otra carpeta", fn: async () => {
      const c = limpiarRuta(prompt("¿A qué carpeta?", carpeta) || "");
      if (!c || c === carpeta) return;
      const r = await moverFotos([x], () => `${c}/${archivo}`);
      recordarCarpeta(c); $("carpeta").value = carpeta; pintarCarpetas();
      toast(r.enPC ? "💻 Ya había llegado al PC: muévela allí" : `📁 Movida a ${c}`);
    } },
    { txt: "🗑️ Borrar", peligro: true, fn: async () => {
      if (!confirm(`¿Borrar "${archivo}"?`)) return;
      await borrarFoto(x);
      toast("🗑️ Borrada");
    } },
  ]);
}

function carpetaActual() {
  const c = limpiarRuta($("carpeta").value) || "Sin_carpeta";
  $("carpeta").value = c;
  return c;
}

// ---------- Historial ----------
function hist() { try { return JSON.parse(localStorage.getItem("fotopc_hist")) || []; } catch (e) { return []; } }
function guardarHist(h) { try { localStorage.setItem("fotopc_hist", JSON.stringify(h.slice(0, 40))); } catch (e) {} pintarHist(); }
function addHist(path, vista, partes) { guardarHist([{ path, vista, partes, estado: "pendiente", fecha: Date.now() }, ...hist()]); }
function setHist(path, estado) { guardarHist(hist().map((x) => (x.path === path ? { ...x, estado } : x))); }

function pintarHist() {
  const ul = $("historial");
  const h = hist();
  ul.innerHTML = h.length ? "" : '<li class="muted">Todavía no hay nada.</li>';
  const icono = { pendiente: "⏳", subida: "✅", error: "⚠️", enpc: "💻" };
  h.forEach((x) => {
    const li = document.createElement("li");
    const partes = (x.vista || x.path).split("/");
    li.innerHTML = `<span>${icono[x.estado] || ""}</span>
      <span class="grow"><b>${partes.pop()}</b><br><small class="muted">${partes.join("/")}</small></span>`;
    if (borrable(x)) { li.classList.add("tocable"); li.onclick = () => menuFoto(x); }
    ul.appendChild(li);
  });
}


// ---------- Cola de subida ----------
const PARTE = 40 * 1024 * 1024;          // límite gratuito de Supabase: 50 MB por archivo
const MAX_TOTAL = 900 * 1024 * 1024;     // el almacén gratuito es de 1 GB
async function encolar(blob, ext, tipo, titulo = "") {
  const carpeta = carpetaActual();
  recordarCarpeta(carpeta);
  const nombre = limpiarNombre(titulo);
  const vista = `${carpeta}/${nombre || sello() + "_" + rand()}.${ext}`;   // "Parte frontal.jpg"
  if (!Cifra.key) throw new Error("Falta la clave de cifrado");
  if (blob.size > MAX_TOTAL) throw new Error(`Demasiado grande (${tamano(blob.size)}). Máximo ${tamano(MAX_TOTAL)} con el plan gratuito.`);
  // Se cifra AQUÍ, en el móvil: a internet solo llega contenido ilegible
  const n = Math.max(1, Math.ceil(blob.size / PARTE));
  if (n === 1) {
    const path = `${API.uid()}/${await Cifra.cifrarNombre(vista)}`;
    const cifrado = await Cifra.cifrarBlob(blob);
    await DB.put("cola", { id: path, path, blob: cifrado, type: "application/octet-stream", fecha: Date.now() });
    addHist(path, vista);
  } else {
    // Archivos grandes (vídeos): trozos de 40 MB, cada uno cifrado por separado. El PC los vuelve a juntar.
    const grupo = rand() + rand(), partes = [], t0 = Date.now();
    for (let i = 0; i < n; i++) {
      const trozo = blob.slice(i * PARTE, Math.min(blob.size, (i + 1) * PARTE));
      const path = `${API.uid()}/${await Cifra.cifrarNombre(`${vista}\u0000${grupo}\u0000${i}\u0000${n}`)}`;
      await DB.put("cola", { id: path, path, blob: await Cifra.cifrarBlob(trozo), type: "application/octet-stream", fecha: t0 + i, hist: partes[0] || path });
      partes.push(path);
      toast(`🔐 Cifrando ${i + 1}/${n}…`, 3000);
    }
    addHist(partes[0], vista, partes);
  }
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
        if (it.hist) {
          const quedan = (await DB.all("cola")).filter((q) => q.hist === it.hist).length;
          if (!quedan) setHist(it.hist, "subida");
        } else setHist(it.path, "subida");
      } catch (e) {
        if (e.message === "NO_SESSION") { toast("Sesión caducada: vuelve a entrar"); volverLogin(); break; }
        setHist(it.hist || it.path, navigator.onLine ? "error" : "pendiente");
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
$("btnFoto").onclick = () => abrirCamaraApp();

// ---------- Cámara integrada: dispara seguido sin salir de la app ----------
let camStream = null, camCuenta = 0, linterna = false;
async function abrirCamaraApp() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return abrirCamara();
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } },
    });
  } catch (e) {
    toast("Sin permiso de cámara: abro la cámara del móvil");
    return abrirCamara();
  }
  const v = $("camVideo");
  v.srcObject = camStream;
  try { await v.play(); } catch (e) {}
  camCuenta = 0; linterna = false;
  $("camCuenta").textContent = "0";
  $("camCarpeta").textContent = "📁 " + carpetaActual() + " ▾";
  const track = camStream.getVideoTracks()[0];
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  $("camLinterna").classList.toggle("hidden", !caps.torch);
  $("vCamara").classList.remove("hidden");
}
function cerrarCamaraApp() {
  if (camStream) camStream.getTracks().forEach((t) => t.stop());
  camStream = null;
  $("camVideo").srcObject = null;
  $("vCamara").classList.add("hidden");
}
$("camCerrar").onclick = cerrarCamaraApp;
$("camNativa").onclick = () => { cerrarCamaraApp(); abrirCamara(); };
$("camLinterna").onclick = async () => {
  linterna = !linterna;
  try { await camStream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: linterna }] }); } catch (e) {}
};
// Tocar la carpeta: pasar a la siguiente muestra sin salir de la cámara
$("camCarpeta").onclick = () => {
  const n = prompt("Carpeta para las próximas fotos", siguienteNombre(carpetaActual()));
  if (n === null) return;
  const c = limpiarRuta(n);
  if (!c) return;
  $("carpeta").value = c; recordarCarpeta(c);
  camCuenta = 0; $("camCuenta").textContent = "0";
  $("camCarpeta").textContent = "📁 " + c + " ▾";
};
$("camDisparo").onclick = async () => {
  const v = $("camVideo");
  if (!v.videoWidth) return;
  const s = Math.min(1, CONFIG.FOTO_MAX_PX / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement("canvas");
  c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  const f = $("camFlash"); f.classList.remove("on"); void f.offsetWidth; f.classList.add("on");
  try {
    const jpg = await canvasABlob(c, CONFIG.FOTO_CALIDAD);
    const r = await pedirTitulo(jpg, () => {});        // "Repetir" = volver a la cámara
    if (r.repetir) return;
    await encolar(jpg, "jpg", "image/jpeg", r.titulo);
    recordarTitulo(limpiarNombre(r.titulo));
    camCuenta++; $("camCuenta").textContent = camCuenta;
    toast(`📤 ${limpiarNombre(r.titulo) || "Foto"} → ${carpetaActual()}`);
  } catch (err) { toast(err.message); }
};

// ---------- Ajustes ----------
$("btnAjustes").onclick = () => {
  const dentro = !!API.session;
  menu("⚙️ Ajustes", [
    ...(dentro ? [
      { txt: "🔐 Volver a poner la clave de cifrado", fn: async () => {
        if (!confirm("Se borrará la clave de este móvil y te la pedirá otra vez. Si pones una clave NUEVA, las fotos pendientes cifradas con la antigua no se podrán abrir. ¿Seguir?")) return;
        await Cifra.olvidar(); location.reload();
      } },
      { txt: "🚪 Cerrar sesión", peligro: true, fn: () => $("btnSalir").click() },
    ] : []),
    { txt: "ℹ️ TAKePH · fotos cifradas · borrado a las 24 h", fn: () => {} },
  ]);
};
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

function extDe(f, def) { const m = (f.name || "").match(/\.([a-z0-9]{1,5})$/i); return m ? m[1].toLowerCase() : def; }
const abrirVideo = () => { $("inVideo").value = ""; $("inVideo").click(); };
$("btnVideo").onclick = abrirVideo;
$("inVideo").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const r = await pedirTitulo(f, abrirVideo);
    if (r.repetir) return;
    await encolar(f, extDe(f, "mp4"), f.type || "video/mp4", r.titulo);
    recordarTitulo(limpiarNombre(r.titulo));
    toast(`📤 Vídeo (${tamano(f.size)}) → ${carpetaActual()}`);
  } catch (err) { toast(err.message, 5000); }
};

$("btnGaleria").onclick = () => { $("inGaleria").value = ""; $("inGaleria").click(); };
$("inGaleria").onchange = async (e) => {
  const files = [...e.target.files];
  for (const f of files) {
    try {
      if (f.type === "application/pdf") await encolar(f, "pdf", "application/pdf");
      else if ((f.type || "").startsWith("video/")) await encolar(f, extDe(f, "mp4"), f.type, "");
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
let guardada = false;   // la página actual ya está añadida al PDF
let guardando = null;   // promesa de la página que se está añadiendo

function abrirScan() { $("vScan").classList.remove("hidden"); }
function cerrarScan() { $("vScan").classList.add("hidden"); paginas = []; recorte = resultado = null; guardada = false; }
function modoEsquinas() {
  $("scanInfo").textContent = "Arrastra las 4 esquinas al borde del papel";
  $("filtros").classList.add("hidden");
  $("scanBar1").classList.remove("hidden");
  $("scanBar2").classList.add("hidden");
}
function totalPaginas() { return paginas.length + (guardada ? 0 : 1); }
function modoResultado() {
  $("scanInfo").textContent = `Página ${totalPaginas()}`;
  $("filtros").classList.remove("hidden");
  $("scanBar1").classList.add("hidden");
  $("scanBar2").classList.remove("hidden");
  $("nPag").textContent = totalPaginas();
}
function pedirFotoScan() { $("inScan").value = ""; $("inScan").click(); }

$("btnScan").onclick = () => { paginas = []; pedirFotoScan(); };
$("inScan").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) {
    if (!paginas.length && !guardada) cerrarScan();
    else if (guardando) { await guardando; $("scanInfo").textContent = `${paginas.length} página(s) listas · pulsa «Subir PDF» o «+ Página»`; $("nPag").textContent = paginas.length; }
    return;
  }
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
    guardada = false;
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
  if (guardada) return guardando;
  guardada = true;
  const c = resultado;
  guardando = (async () => {
    const blob = await canvasABlob(c, 0.8);
    paginas.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), w: c.width, h: c.height });
  })();
  return guardando;
}
$("scanRetry").onclick = pedirFotoScan;
// En iPhone la cámara solo se abre si se pide en el mismo toque: primero la cámara, luego se guarda la página
$("scanAdd").onclick = () => {
  pedirFotoScan();
  guardarPagina();
  toast(`📄 Página ${paginas.length + 1} añadida · haz la siguiente`);
};
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
