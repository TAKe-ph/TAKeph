// ============================================================
//  Código compartido (móvil y PC): login, almacenamiento, utilidades
// ============================================================
const $ = (id) => document.getElementById(id);

// ---------- Utilidades ----------
function limpiarRuta(s) {
  // Va cifrado, así que se permiten tildes y espacios; solo se quitan símbolos que Windows no acepta
  return (s || "").split("/").map(limpiarNombre).filter(Boolean).join("/");
}

// Título libre -> nombre de archivo válido en Windows (mantiene tildes y espacios)
function limpiarNombre(s) {
  let n = (s || "").replace(/[<>:"\/\\|?*\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().replace(/[. ]+$/, "").slice(0, 80);
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(n)) n += "_";
  return n;
}

function sello(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function jwtSub(t) {
  try {
    const p = t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(p + "===".slice((p.length + 3) % 4))).sub;
  } catch (e) { return null; }
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
    this.guardarSesion(j);
  },
  guardarSesion(j) {
    this.save({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + j.expires_in * 1000,
      user_id: (j.user && j.user.id) || jwtSub(j.access_token) });
  },
  login(email, password) { return this._auth("password", { email, password }); },
  uid() { return this.session && (this.session.user_id || jwtSub(this.session.access_token)); },

  // Crear cuenta nueva con código de invitación. Devuelve true si ya ha entrado.
  async signup(email, password, invite) {
    const r = await fetch(`${this.base}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: CONFIG.SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, data: { invite } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = j.msg || j.error_description || j.message || "";
      if (/invit|database error/i.test(m)) throw new Error("Código de invitación incorrecto");
      if (/password/i.test(m)) throw new Error("La contraseña debe tener al menos 6 caracteres");
      if (/signups? not allowed|disabled/i.test(m)) throw new Error("El registro está desactivado");
      throw new Error(m || "No se pudo crear la cuenta");
    }
    if (j.access_token) { this.guardarSesion(j); return true; }
    return false; // hay que confirmar el correo
  },

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
    if (r.status === 401) { this.logout(); throw new Error("NO_SESSION"); }
    throw new Error("Error al subir: " + t);
  },

  async list(prefix = "") {
    const r = await fetch(`${this.base}/storage/v1/object/list/${CONFIG.BUCKET}`, {
      method: "POST",
      headers: await this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefix, limit: 1000, offset: 0, sortBy: { column: "name", order: "asc" } }),
    });
    if (r.status === 401) { this.logout(); throw new Error("NO_SESSION"); }
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

  // Renombrar / mover un archivo que aún está en internet
  async move(from, to) {
    const r = await fetch(`${this.base}/storage/v1/object/move`, {
      method: "POST",
      headers: await this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ bucketId: CONFIG.BUCKET, sourceKey: from, destinationKey: to }),
    });
    if (r.ok) return;
    const t = await r.text();
    if (r.status === 401) { this.logout(); throw new Error("NO_SESSION"); }
    if (r.status === 404 || /not.?found/i.test(t)) throw new Error("YA_DESCARGADA");
    throw new Error("No se pudo cambiar: " + t);
  },

  // Datos del usuario (para comprobar que la clave de cifrado es la misma en todos tus aparatos)
  async getMeta() {
    const r = await fetch(`${this.base}/auth/v1/user`, { headers: await this.headers() });
    if (r.status === 401 || r.status === 403) { this.logout(); throw new Error("NO_SESSION"); }
    const j = await r.json();
    return j.user_metadata || {};
  },
  async setMeta(data) {
    const r = await fetch(`${this.base}/auth/v1/user`, {
      method: "PUT",
      headers: await this.headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ data }),
    });
    if (!r.ok) throw new Error("No se pudo guardar la comprobación de la clave");
  },

  // Borra TUS archivos con más de X horas (borrado automático)
  async purgarAntiguas(horas = 24) {
    const uid = this.uid();
    if (!uid) return 0;
    const limite = Date.now() - horas * 3600e3, viejos = [];
    const recorrer = async (prefix) => {
      for (const it of await this.list(prefix)) {
        const full = `${prefix}/${it.name}`;
        if (it.id === null) await recorrer(full);
        else if (new Date(it.created_at).getTime() < limite) viejos.push(full);
      }
    };
    await recorrer(uid);
    for (let i = 0; i < viejos.length; i += 500) await this.remove(viejos.slice(i, i + 500));
    return viejos.length;
  },
};

// ---------- Pantalla de login (común) ----------
function iniciarLogin(onOk) {
  const mostrar = async (logueado) => {
    $("vLogin").classList.toggle("hidden", logueado);
    $("btnSalir").classList.toggle("hidden", !logueado);
    if (!logueado) { $("vMain").classList.add("hidden"); $("vClave").classList.add("hidden"); return; }
    const tiene = await Cifra.cargar();
    $("vClave").classList.toggle("hidden", tiene);
    $("vMain").classList.toggle("hidden", !tiene);
    if (tiene) onOk();
  };

  // ---- Clave de cifrado ----
  let reset = false;
  $("btnClave").onclick = async () => {
    const f = $("frase").value, f2 = $("frase2").value;
    $("claveErr").textContent = "";
    if (f.length < 10) { $("claveErr").textContent = "La clave debe tener al menos 10 caracteres."; return; }
    if (f !== f2) { $("claveErr").textContent = "Las dos claves no coinciden."; return; }
    $("btnClave").disabled = true; $("btnClave").textContent = "Comprobando…";
    try {
      const key = await Cifra.derivar(f, API.uid());
      const meta = await API.getMeta();
      if (meta.fpc_check && !reset) {
        try {
          const t = Cifra.dec.decode(await Cifra.descifrar(Cifra.deb64u(meta.fpc_check), key));
          if (t !== "fotopc-ok") throw new Error();
        } catch (e) {
          $("claveErr").textContent = "Esta clave no coincide con la que pusiste en tu otro aparato.";
          $("btnClaveReset").classList.remove("hidden");
          return;
        }
      } else {
        await API.setMeta({ fpc_check: Cifra.b64u(await Cifra.cifrar(Cifra.enc.encode("fotopc-ok"), key)) });
      }
      await Cifra.guardar(key);
      $("frase").value = $("frase2").value = "";
      $("btnClaveReset").classList.add("hidden");
      mostrar(true);
    } catch (e) {
      $("claveErr").textContent = e.message === "NO_SESSION" ? "La sesión caducó: vuelve a entrar." : e.message;
      if (e.message === "NO_SESSION") mostrar(false);
    } finally {
      reset = false;
      $("btnClave").disabled = false; $("btnClave").textContent = "Guardar clave en este aparato";
    }
  };
  $("btnClaveReset").onclick = () => {
    if (confirm("Vas a empezar con una clave NUEVA. Las fotos pendientes cifradas con la antigua no se podrán abrir. Tendrás que poner la nueva en todos tus aparatos. ¿Seguir?")) {
      reset = true; $("btnClave").click();
    }
  };
  let registro = false;
  $("btnModo").onclick = () => {
    registro = !registro;
    $("invite").classList.toggle("hidden", !registro);
    $("vLogin").querySelector("h2").textContent = registro ? "Crear cuenta" : "Entrar";
    $("btnLogin").textContent = registro ? "Crear cuenta" : "Entrar";
    $("btnModo").textContent = registro ? "Ya tengo cuenta" : "¿No tienes cuenta? Crear una";
    $("loginErr").textContent = "";
  };
  $("btnLogin").onclick = async () => {
    $("loginErr").textContent = "";
    $("btnLogin").disabled = true;
    try {
      const email = $("email").value.trim(), pass = $("pass").value;
      if (registro) {
        const dentro = await API.signup(email, pass, $("invite").value.trim());
        if (!dentro) { $("loginErr").textContent = "Revisa tu correo para confirmar la cuenta y luego entra aquí."; return; }
      } else {
        await API.login(email, pass);
      }
      mostrar(true);
    } catch (e) {
      $("loginErr").textContent = e.message;
    } finally {
      $("btnLogin").disabled = false;
    }
  };
  $("btnSalir").onclick = async () => { await Cifra.olvidar(); API.logout(); mostrar(false); };
  if (CONFIG.SUPABASE_URL.includes("TU-PROYECTO")) {
    $("loginErr").textContent = "Falta configurar config.js con los datos de Supabase.";
  }
  mostrar(API.load());
  return () => mostrar(false); // función para volver al login
}
