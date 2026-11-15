// ============================================================
//  Código compartido (móvil y PC): login, almacenamiento, utilidades
// ============================================================
const $ = (id) => document.getElementById(id);

// ---------- Utilidades ----------
function limpiarRuta(s) {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")       // quita tildes (ñ -> n)
    .split("/")
    .map((seg) => seg.replace(/[^\w \-.()]/g, "_").trim().replace(/[. ]+$/, ""))
    .filter(Boolean)
    .join("/");
}

function sello(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

const rand = () => Math.random().toString(36).slice(2, 6);

function tamano(b) {
  if (b > 1048576) return (b / 1048576).toFixed(1) + " MB";
  return Math.max(1, Math.round(b / 1024)) + " KB";
}

let toastTimer;
function toast(msg, ms = 2500) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}

// ---------- Almacén local (IndexedDB) ----------
const DB = {
  db: null,
  async open() {
    if (this.db) return this.db;
    this.db = await new Promise((res, rej) => {
      const r = indexedDB.open("fotopc", 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore("cola", { keyPath: "id" });
        r.result.createObjectStore("kv");
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this.db;
  },
  async tx(store, mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req ? req.result : undefined);
      t.onerror = () => rej(t.error);
    });
  },
  put(store, val, key) { return this.tx(store, "readwrite", (s) => (key === undefined ? s.put(val) : s.put(val, key))); },
  get(store, key) { return this.tx(store, "readonly", (s) => s.get(key)); },
  del(store, key) { return this.tx(store, "readwrite", (s) => s.delete(key)); },
  all(store) { return this.tx(store, "readonly", (s) => s.getAll()); },
};

// ---------- Supabase (login + almacenamiento) ----------
const API = {
  session: null,
  base: CONFIG.SUPABASE_URL.replace(/\/$/, ""),

  load() {
    try { this.session = JSON.parse(localStorage.getItem("fotopc_session")); } catch (e) { this.session = null; }
    return !!this.session;
  },
  save(s) {
    this.session = s;
    try {
      if (s) localStorage.setItem("fotopc_session", JSON.stringify(s));
      else localStorage.removeItem("fotopc_session");
    } catch (e) {}
  },
  logout() { this.save(null); },

  async _auth(grant, body) {
    const r = await fetch(`${this.base}/auth/v1/token?grant_type=${grant}`, {
      method: "POST",
      headers: { apikey: CONFIG.SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error_description || j.msg || j.message || "Error de acceso");
    this.save({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + j.expires_in * 1000 });
  },
  login(email, password) { return this._auth("password", { email, password }); },

  async token() {
    if (!this.session) throw new Error("NO_SESSION");
    if (Date.now() > this.session.expires_at - 60000) {
      try { await this._auth("refresh_token", { refresh_token: this.session.refresh_token }); }
      catch (e) {
        if (!navigator.onLine || e instanceof TypeError) throw e; // sin internet: no cerrar sesión
        this.logout(); throw new Error("NO_SESSION");
      }
    }
    return this.session.access_token;
  },
  async headers(extra = {}) {
    return { apikey: CONFIG.SUPABASE_KEY, Authorization: "Bearer " + (await this.token()), ...extra };
  },
  url(path) { return path.split("/").map(encodeURIComponent).join("/"); },

  async upload(path, blob, type) {
    const r = await fetch(`${this.base}/storage/v1/object/${CONFIG.BUCKET}/${this.url(path)}`, {
      method: "POST",
      headers: await this.headers({ "Content-Type": type || blob.type || "application/octet-stream", "x-upsert": "false" }),
      body: blob,
    });
    if (r.ok) return;
    const t = await r.text();
    if (/duplicate|already exists/i.test(t)) return; // ya estaba subida
    if (r.status === 401 || r.status === 403) { this.logout(); throw new Error("NO_SESSION"); }
    throw new Error("Error al subir: " + t);
  },

  async list(prefix = "") {
    const r = await fetch(`${this.base}/storage/v1/object/list/${CONFIG.BUCKET}`, {
      method: "POST",
      headers: await this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
    });
    if (r.status === 401 || r.status === 403) { this.logout(); throw new Error("NO_SESSION"); }
    if (!r.ok) throw new Error("Error al listar: " + (await r.text()));
    return r.json();
  },

  async download(path) {
    const r = await fetch(`${this.base}/storage/v1/object/authenticated/${CONFIG.BUCKET}/${this.url(path)}`, {
      headers: await this.headers(),
    });
    if (!r.ok) throw new Error("Error al descargar " + path);
    return r.blob();
  },

  async remove(paths) {
    const r = await fetch(`${this.base}/storage/v1/object/${CONFIG.BUCKET}`, {
      method: "DELETE",
      headers: await this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: paths }),
    });
    if (!r.ok) throw new Error("Error al borrar: " + (await r.text()));
  },

  // Enlace temporal para compartir un archivo (por defecto 7 días)
  async signedUrl(path, segundos = 7 * 24 * 3600) {
    const r = await fetch(`${this.base}/storage/v1/object/sign/${CONFIG.BUCKET}/${this.url(path)}`, {
      method: "POST",
      headers: await this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: segundos }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message || "No se pudo crear el enlace");
    return `${this.base}/storage/v1${j.signedURL || j.signedUrl}`;
  },
};

// ---------- Pantalla de login (común) ----------
function iniciarLogin(onOk) {
  const mostrar = (logueado) => {
    $("vLogin").classList.toggle("hidden", logueado);
    $("vMain").classList.toggle("hidden", !logueado);
    $("btnSalir").classList.toggle("hidden", !logueado);
    if (logueado) onOk();
  };
  $("btnLogin").onclick = async () => {
    $("loginErr").textContent = "";
    $("btnLogin").disabled = true;
    try {
      await API.login($("email").value.trim(), $("pass").value);
      mostrar(true);
    } catch (e) {
      $("loginErr").textContent = e.message;
    } finally {
      $("btnLogin").disabled = false;
    }
  };
  $("btnSalir").onclick = () => { API.logout(); mostrar(false); };
  if (CONFIG.SUPABASE_URL.includes("TU-PROYECTO")) {
    $("loginErr").textContent = "Falta configurar config.js con los datos de Supabase.";
  }
  mostrar(API.load());
  return () => mostrar(false); // función para volver al login
}
