// TAKePH · Borra del almacén todo lo que lleve más de 24 h sin descargar.
// Desplegada en Supabase (Edge Function "takeph-purgar") y llamada cada hora por pg_cron.
// Solo puede borrar archivos antiguos, así que llamarla de más no causa ningún daño.
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "fotos";
const LIMITE_MS = 24 * 3600 * 1000;

function claveServicio(): string {
  const k = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (k) return k;
  try {
    const s = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
    const v = Object.values(s)[0];
    if (typeof v === "string") return v;
  } catch (_) { /* nada */ }
  throw new Error("Sin clave de servicio");
}

Deno.serve(async () => {
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, claveServicio(), { auth: { persistSession: false } });
    const viejos: string[] = [];
    const ahora = Date.now();
    const recorrer = async (prefix: string, nivel: number) => {
      if (nivel > 6) return;
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: 1000, offset });
        if (error) throw error;
        for (const it of data ?? []) {
          const full = prefix ? `${prefix}/${it.name}` : it.name;
          if (it.id === null) await recorrer(full, nivel + 1);
          else if (ahora - new Date(it.created_at).getTime() > LIMITE_MS) viejos.push(full);
        }
        if (!data || data.length < 1000) break;
      }
    };
    await recorrer("", 0);
    for (let i = 0; i < viejos.length; i += 500) {
      const { error } = await sb.storage.from(BUCKET).remove(viejos.slice(i, i + 500));
      if (error) throw error;
    }
    return Response.json({ ok: true, borrados: viejos.length });
  } catch (e) {
    return Response.json({ ok: false, error: String((e as Error).message ?? e) }, { status: 500 });
  }
});
