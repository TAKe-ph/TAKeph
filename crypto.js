// ============================================================
//  Cifrado de extremo a extremo (AES-256-GCM, Web Crypto del navegador)
//  - La foto y el nombre de la carpeta se cifran EN EL MÓVIL.
//  - Solo se descifran EN TU PC, con la misma clave.
//  - La clave nunca se envía a internet: se guarda en el dispositivo
//    como clave NO exportable (ni la propia app puede leerla en texto).
// ============================================================
const Cifra = {
  key: null,
  enc: new TextEncoder(),
  dec: new TextDecoder(),

  async derivar(frase, uid) {
    const base = await crypto.subtle.importKey("raw", this.enc.encode(frase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: this.enc.encode("fotopc-v1:" + uid), iterations: 600000, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
  },
  async cargar() {
    try { this.key = (await DB.get("kv", "clave:" + API.uid())) || null; } catch (e) { this.key = null; }
    return !!this.key;
  },
  async guardar(key) { this.key = key; await DB.put("kv", key, "clave:" + API.uid()); },
  async olvidar() { this.key = null; try { await DB.del("kv", "clave:" + API.uid()); } catch (e) {} },

  async cifrar(bytes, key = this.key) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
    const out = new Uint8Array(12 + ct.length);
    out.set(iv); out.set(ct, 12);
    return out;
  },
  async descifrar(bytes, key = this.key) {
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.slice(0, 12) }, key, bytes.slice(12)));
  },

  b64u(b) {
    let s = "";
    for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  deb64u(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(s + "===".slice((s.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  },

  // Nombres: "Muestra_1/2026-11-15_12-00-00_ab12.jpg" -> "e1Xk3…" (ilegible)
  async cifrarNombre(t) { return "e1" + this.b64u(await this.cifrar(this.enc.encode(t))); },
  async descifrarNombre(n) { return this.dec.decode(await this.descifrar(this.deb64u(n.slice(2)))); },
  esCifrado(n) { return n.startsWith("e1"); },

  async cifrarBlob(blob) {
    return new Blob([await this.cifrar(new Uint8Array(await blob.arrayBuffer()))], { type: "application/octet-stream" });
  },
  async descifrarBlob(blob) {
    return new Blob([await this.descifrar(new Uint8Array(await blob.arrayBuffer()))]);
  },
};
