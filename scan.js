// ============================================================
//  Escáner de documentos: recorte de 4 esquinas, enderezado,
//  filtros (color / documento / blanco y negro) y creación de PDF.
//  Sin librerías externas.
// ============================================================

// ---------- Cargar imagen a canvas (reducida) ----------
function cargarImagen(file, maxPx) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas");
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}

function canvasABlob(c, calidad = 0.85) {
  return new Promise((res) => c.toBlob(res, "image/jpeg", calidad));
}

// ---------- Homografía (perspectiva) ----------
// Devuelve h tal que (u,v) en destino -> (x,y) en origen
function resolverHomografia(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = dst[i], [x, y] = src[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]); b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]); b.push(y);
  }
  const n = 8;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return b.map((v, i) => v / A[i][i]);
}

// q = [arribaIzq, arribaDer, abajoDer, abajoIzq] en píxeles del canvas origen
function enderezar(src, q, maxPx = 2200) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  let W = Math.max(d(q[0], q[1]), d(q[3], q[2]));
  let H = Math.max(d(q[0], q[3]), d(q[1], q[2]));
  const s = Math.min(1, maxPx / Math.max(W, H));
  W = Math.max(1, Math.round(W * s)); H = Math.max(1, Math.round(H * s));
  const h = resolverHomografia(q, [[0, 0], [W, 0], [W, H], [0, H]]);

  const sw = src.width, sh = src.height;
  const sd = src.getContext("2d").getImageData(0, 0, sw, sh).data;
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  const octx = out.getContext("2d");
  const od = octx.createImageData(W, H), o = od.data;
  const mx = sw - 1.001, my = sh - 1.001;

  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      const uu = u + 0.5, vv = v + 0.5;
      const den = h[6] * uu + h[7] * vv + 1;
      let x = (h[0] * uu + h[1] * vv + h[2]) / den;
      let y = (h[3] * uu + h[4] * vv + h[5]) / den;
      x = x < 0 ? 0 : x > mx ? mx : x;
      y = y < 0 ? 0 : y > my ? my : y;
      const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      const oi = (v * W + u) * 4;
      for (let c = 0; c < 3; c++) {
        const top = sd[i00 + c] + (sd[i10 + c] - sd[i00 + c]) * fx;
        const bot = sd[i01 + c] + (sd[i11 + c] - sd[i01 + c]) * fx;
        o[oi + c] = top + (bot - top) * fy;
      }
      o[oi + 3] = 255;
    }
  }
  octx.putImageData(od, 0, 0);
  return out;
}

// ---------- Filtros ----------
function aplicarFiltro(src, f) {
  const c = document.createElement("canvas");
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext("2d");
  ctx.drawImage(src, 0, 0);
  if (f === "color") return c;

  const W = c.width, H = c.height;
  const id = ctx.getImageData(0, 0, W, H), d = id.data, n = W * H;
  const g = new Uint8ClampedArray(n);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) {
    const y = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000 | 0;
    g[i] = y; hist[y]++;
  }

  // Imagen integral: media local alrededor de cada píxel (sirve para quitar sombras)
  const W1 = W + 1;
  const I = new Uint32Array(W1 * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += g[y * W + x];
      I[(y + 1) * W1 + x + 1] = I[y * W1 + x + 1] + row;
    }
  }
  const media = (x, y, s) => {
    const x1 = Math.max(0, x - s), x2 = Math.min(W - 1, x + s), y1 = Math.max(0, y - s), y2 = Math.min(H - 1, y + s);
    const n = (x2 - x1 + 1) * (y2 - y1 + 1);
    return (I[(y2 + 1) * W1 + x2 + 1] - I[y1 * W1 + x2 + 1] - I[(y2 + 1) * W1 + x1] + I[y1 * W1 + x1]) / n;
  };

  if (f === "doc") {
    // Divide cada píxel por el brillo del papel a su alrededor: la sombra desaparece y la tinta queda negra
    const s = Math.max(10, (Math.max(W, H) / 12) | 0) >> 1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = y * W + x;
        const fondo = Math.max(1, media(x, y, s));
        let r = (g[k] / fondo - 0.55) / (0.92 - 0.55);
        r = r < 0 ? 0 : r > 1 ? 1 : r;
        const v = 255 * Math.pow(r, 1.4);
        d[k * 4] = d[k * 4 + 1] = d[k * 4 + 2] = v;
      }
    }
  } else if (f === "bn") {
    // Umbral adaptativo (Bradley): aguanta sombras y luz irregular
    const s = Math.max(8, (Math.max(W, H) / 16) | 0) >> 1;
    for (let y = 0; y < H; y++) {
      const y1 = Math.max(0, y - s), y2 = Math.min(H - 1, y + s);
      for (let x = 0; x < W; x++) {
        const x1 = Math.max(0, x - s), x2 = Math.min(W - 1, x + s);
        const count = (x2 - x1 + 1) * (y2 - y1 + 1);
        const sum = I[(y2 + 1) * W1 + x2 + 1] - I[y1 * W1 + x2 + 1] - I[(y2 + 1) * W1 + x1] + I[y1 * W1 + x1];
        const v = g[y * W + x] * count < sum * 0.85 ? 0 : 255;
        const k = (y * W + x) * 4;
        d[k] = d[k + 1] = d[k + 2] = v;
      }
    }
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

// ---------- PDF (sin librerías) ----------
function componentesJpeg(b) {
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xd8 || m === 0x01 || m === 0xff || (m >= 0xd0 && m <= 0xd7)) { i += (m === 0xff ? 1 : 2); continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return b[i + 9];
    i += 2 + len;
  }
  return 3;
}

// paginas: [{ jpeg: Uint8Array, w, h }]
function crearPdf(paginas) {
  const enc = new TextEncoder();
  const partes = []; let len = 0; const off = [];
  const push = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; partes.push(b); len += b.length; };
  const obj = (id, cuerpo) => { off[id] = len; push(`${id} 0 obj\n`); cuerpo(); push("\nendobj\n"); };

  push("%PDF-1.4\n"); push(new Uint8Array([37, 226, 227, 207, 211, 10]));
  const n = paginas.length;
  obj(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => push(`<< /Type /Pages /Kids [${paginas.map((_, i) => `${3 + 3 * i} 0 R`).join(" ")}] /Count ${n} >>`));
  paginas.forEach((p, i) => {
    const pw = 595.28, ph = +(pw * p.h / p.w).toFixed(2); // ancho A4
    const pid = 3 + 3 * i, cid = pid + 1, iid = pid + 2;
    const cs = componentesJpeg(p.jpeg) === 1 ? "/DeviceGray" : "/DeviceRGB";
    obj(pid, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`));
    const contenido = `q ${pw} 0 0 ${ph} 0 0 cm /Im${i} Do Q`;
    obj(cid, () => { push(`<< /Length ${contenido.length} >>\nstream\n`); push(contenido); push("\nendstream"); });
    obj(iid, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace ${cs} /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      push(p.jpeg); push("\nendstream");
    });
  });
  const xref = len, total = 3 + 3 * n;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let id = 1; id < total; id++) x += String(off[id]).padStart(10, "0") + " 00000 n \n";
  x += `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  push(x);
  return new Blob(partes, { type: "application/pdf" });
}

// ---------- Editor de esquinas ----------
class EditorEsquinas {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext("2d");
    this.img = null; this.q = null; this.drag = -1;
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => this.down(e));
    canvas.addEventListener("pointermove", (e) => this.move(e));
    canvas.addEventListener("pointerup", () => (this.drag = -1));
    canvas.addEventListener("pointercancel", () => (this.drag = -1));
  }
  cargar(imgCanvas) {
    this.img = imgCanvas;
    const W = imgCanvas.width, H = imgCanvas.height, m = 0.08;
    this.q = [[W * m, H * m], [W * (1 - m), H * m], [W * (1 - m), H * (1 - m)], [W * m, H * (1 - m)]];
    this.ajustar();
  }
  ajustar() {
    const caja = this.cv.parentElement.getBoundingClientRect();
    const s = Math.min(caja.width / this.img.width, caja.height / this.img.height);
    this.esc = s;
    const dpr = window.devicePixelRatio || 1;
    this.cv.style.width = this.img.width * s + "px";
    this.cv.style.height = this.img.height * s + "px";
    this.cv.width = Math.round(this.img.width * s * dpr);
    this.cv.height = Math.round(this.img.height * s * dpr);
    this.k = s * dpr; // imagen -> píxeles del canvas
    this.dibujar();
  }
  punto(e) {
    const r = this.cv.getBoundingClientRect();
    return [(e.clientX - r.left) / this.esc, (e.clientY - r.top) / this.esc];
  }
  down(e) {
    if (!this.img) return;
    const p = this.punto(e), radio = 40 / this.esc;
    let mejor = -1, dm = Infinity;
    this.q.forEach((c, i) => { const dd = Math.hypot(c[0] - p[0], c[1] - p[1]); if (dd < dm) { dm = dd; mejor = i; } });
    if (dm < radio * 1.5) { this.drag = mejor; this.cv.setPointerCapture(e.pointerId); }
  }
  move(e) {
    if (this.drag < 0) return;
    const [x, y] = this.punto(e);
    this.q[this.drag] = [Math.min(Math.max(x, 0), this.img.width), Math.min(Math.max(y, 0), this.img.height)];
    this.dibujar();
  }
  dibujar() {
    const c = this.ctx, k = this.k;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.cv.width, this.cv.height);
    c.drawImage(this.img, 0, 0, this.cv.width, this.cv.height);
    c.fillStyle = "rgba(0,0,0,0.45)";
    c.beginPath();
    c.rect(0, 0, this.cv.width, this.cv.height);
    this.q.slice().reverse().forEach((p, i) => (i ? c.lineTo(p[0] * k, p[1] * k) : c.moveTo(p[0] * k, p[1] * k)));
    c.closePath(); c.fill("evenodd");
    c.strokeStyle = "#22c55e"; c.lineWidth = 3 * (window.devicePixelRatio || 1);
    c.beginPath();
    this.q.forEach((p, i) => (i ? c.lineTo(p[0] * k, p[1] * k) : c.moveTo(p[0] * k, p[1] * k)));
    c.closePath(); c.stroke();
    this.q.forEach((p) => {
      c.beginPath(); c.arc(p[0] * k, p[1] * k, 14 * (window.devicePixelRatio || 1), 0, Math.PI * 2);
      c.fillStyle = "rgba(34,197,94,0.35)"; c.fill(); c.stroke();
    });
  }
  mostrarResultado(canvas) {
    this.img = null;
    const caja = this.cv.parentElement.getBoundingClientRect();
    const s = Math.min(caja.width / canvas.width, caja.height / canvas.height);
    this.cv.style.width = canvas.width * s + "px";
    this.cv.style.height = canvas.height * s + "px";
    this.cv.width = canvas.width; this.cv.height = canvas.height;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(canvas, 0, 0);
  }
}

if (typeof module !== "undefined") module.exports = { resolverHomografia, crearPdf, componentesJpeg };
