// ============================================================
//  Página del PC: lista lo subido y lo guarda en la carpeta elegida,
//  creando las subcarpetas automáticamente.
// ============================================================
const hayFS = "showDirectoryPicker" in window;
let dir = null;          // carpeta elegida (FileSystemDirectoryHandle)
let archivos = [];       // [{path, size, fecha}]
let ocupado = false;

function log(msg, tipo = "") {
  const li = document.createElement("li");
  li.className = tipo;
  li.textContent = `${new Date().toLocaleTimeString()}  ${msg}`;
  $("log").prepend(li);
  while ($("log").children.length > 200) $("log").lastChild.remove();
}

// ---------- Carpeta de destino ----------
async function permiso(pedir = false) {
  if (!dir) return false;
  const opts = { mode: "readwrite" };
  if ((await dir.queryPermission(opts)) === "granted") return true;
  if (!pedir) return false;
  return (await dir.requestPermission(opts)) === "granted";
}

async function pintarDestino() {
  if (!hayFS) { $("noFS").classList.remove("hidden"); $("btnElegir").classList.add("hidden"); $("destino").textContent = "Destino: carpeta Descargas"; return; }
  if (!dir) { $("destino").textContent = "Ninguna elegida todavía."; $("btnReconectar").classList.add("hidden"); return; }
  const ok = await permiso();
  $("destino").innerHTML = `📁 <b>${dir.name}</b> ${ok ? "✅" : "— falta dar permiso (el navegador lo pide cada vez que lo abres)"}`;
  $("btnReconectar").classList.toggle("hidden", ok);
}

$("btnElegir").onclick = async () => {
  try {
    dir = await window.showDirectoryPicker({ id: "fotopc", mode: "readwrite" });
    await DB.put("kv", dir, "dir");
    log(`Carpeta de destino: ${dir.name}`);
  } catch (e) { if (e.name !== "AbortError") toast(e.message); }
  pintarDestino();
};
$("btnReconectar").onclick = async () => { await permiso(true); pintarDestino(); };

// ---------- Guardar archivo en la carpeta ----------
async function guardar(path, blob) {
  if (!hayFS) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = path.replace(/\//g, "_");
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return path.replace(/\//g, "_");
  }
  const segs = path.split("/");
  let nombre = segs.pop();
  let d = dir;
  for (const s of segs) d = await d.getDirectoryHandle(s, { create: true });
  // si ya existe, no machacar: añade (2), (3)...
  const punto = nombre.lastIndexOf(".");
  const base = punto > 0 ? nombre.slice(0, punto) : nombre, ext = punto > 0 ? nombre.slice(punto) : "";
  for (let i = 2; ; i++) {
    try { await d.getFileHandle(nombre); nombre = `${base} (${i})${ext}`; }
    catch (e) { break; }
  }
  const fh = await d.getFileHandle(nombre, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
  return [...segs, nombre].join("/");
}

// ---------- Listado ----------
async function listarTodo(prefix = "") {
  const items = await API.list(prefix);
  let out = [];
  for (const it of items) {
    const full = prefix ? `${prefix}/${it.name}` : it.name;
    if (it.id === null) out = out.concat(await listarTodo(full));
    else if (it.name !== ".emptyFolderPlaceholder") out.push({ path: full, size: (it.metadata && it.metadata.size) || 0, fecha: it.created_at });
  }
  return out;
}

async function refrescar() {
  try {
    archivos = await listarTodo();
  } catch (e) {
    if (e.message === "NO_SESSION") { volverLogin(); return; }
    $("lista").innerHTML = `<p class="err">${e.message}</p>`;
    return;
  }
  pintarLista();
}

function pintarLista() {
  const cont = $("lista");
  if (!archivos.length) { cont.innerHTML = '<p class="muted">No hay nada pendiente. 👌</p>'; $("btnDescargar").disabled = true; return; }
  $("btnDescargar").disabled = false;
  const grupos = {};
  archivos.forEach((a) => {
    const c = a.path.includes("/") ? a.path.slice(0, a.path.lastIndexOf("/")) : "(raíz)";
    (grupos[c] = grupos[c] || []).push(a);
  });
  cont.innerHTML = "";
  Object.keys(grupos).sort().forEach((c) => {
    const g = grupos[c];
    const det = document.createElement("details");
    det.className = "grupo";
    const total = g.reduce((s, a) => s + a.size, 0);
    det.innerHTML = `<summary><span class="grow">📁 <b>${c}</b> <small class="muted">· ${g.length} archivo(s) · ${tamano(total)}</small></span></summary>
      <ul class="list small">${g.map((a) => `<li><span class="grow">${a.path.split("/").pop()}</span><small class="muted">${tamano(a.size)}</small></li>`).join("")}</ul>`;
    const b = document.createElement("button");
    b.className = "secondary"; b.textContent = "⬇️ Esta carpeta";
    b.onclick = (e) => { e.preventDefault(); descargar(g); };
    det.querySelector("summary").appendChild(b);
    cont.appendChild(det);
  });
}

// ---------- Descargar ----------
async function descargar(lista, auto = false) {
  if (ocupado || !lista.length) return;
  if (hayFS) {
    if (!dir) { if (!auto) toast("Primero elige la carpeta de destino"); return; }
    if (!(await permiso(!auto))) { if (!auto) toast("Sin permiso para escribir en la carpeta"); pintarDestino(); return; }
  }
  ocupado = true;
  $("btnDescargar").disabled = true;
  let ok = 0;
  for (const a of lista) {
    try {
      const blob = await API.download(a.path);
      const donde = await guardar(a.path, blob);
      if ($("chkBorrar").checked) await API.remove([a.path]);
      log(`✅ ${donde}`, "ok");
      ok++;
    } catch (e) {
      if (e.message === "NO_SESSION") { volverLogin(); break; }
      log(`⚠️ ${a.path}: ${e.message}`, "err");
    }
  }
  ocupado = false;
  if (ok) toast(`${ok} archivo(s) guardado(s)`);
  await refrescar();
}

$("btnDescargar").onclick = () => descargar(archivos);
$("btnRefrescar").onclick = refrescar;

// ---------- Modo automático ----------
$("chkAuto").checked = localStorage.getItem("fotopc_auto") === "1";
$("chkAuto").onchange = async () => {
  localStorage.setItem("fotopc_auto", $("chkAuto").checked ? "1" : "0");
  if ($("chkAuto").checked && hayFS) { await permiso(true); pintarDestino(); }
};
$("chkBorrar").checked = localStorage.getItem("fotopc_borrar") !== "0";
$("chkBorrar").onchange = () => localStorage.setItem("fotopc_borrar", $("chkBorrar").checked ? "1" : "0");

setInterval(async () => {
  if (!$("chkAuto").checked || ocupado || $("vMain").classList.contains("hidden")) return;
  await refrescar();
  if (archivos.length) descargar(archivos, true);
}, 20000);

// ---------- Arranque ----------
const volverLogin = iniciarLogin(async () => {
  if (hayFS) { try { dir = (await DB.get("kv", "dir")) || null; } catch (e) {} }
  pintarDestino();
  refrescar();
});
