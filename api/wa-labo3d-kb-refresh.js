// Fetch les pages du site labo3d.com.br et construit une base de connaissances
// pour le bot IA. Stocké dans wa_labo3d.knowledge_base dans amigo_data.
// Appelable en manuel (bouton UI) ou en cron (Vercel Cron 2×/jour).
//
// Auth : aucune (endpoint interne, mais safe car ne fait qu'un fetch public + save contrôlé).

import { loadWaLabo3d, saveWaLabo3d } from "./_lib/supabase.js";

const PAGES = [
  { url: "https://labo3d.com.br/", label: "Home" },
  { url: "https://labo3d.com.br/portfolio.html", label: "Portfolio" },
  { url: "https://labo3d.com.br/cake-topper.html", label: "Cake Topper" },
  { url: "https://labo3d.com.br/figurines.html", label: "Figurines articuladas" },
  { url: "https://labo3d.com.br/souvenirs.html", label: "Souvenirs" },
  { url: "https://labo3d.com.br/personagens.html", label: "Personagens originais" },
  { url: "https://labo3d.com.br/decoracao.html", label: "Decoração" },
];

// Extrait le texte lisible d'un HTML — sans deps, safe pour Vercel runtime.
// Retire scripts/styles complètement, remplace tags block par newlines,
// décode les entités HTML courantes du site (PT-BR = beaucoup d'accents encodés).
function stripHtml(html) {
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  html = html.replace(/<!--[\s\S]*?-->/g, "");
  html = html.replace(/<\/(h[1-6]|p|div|li|section|article|footer|header|tr|td|th)>/gi, "\n");
  html = html.replace(/<br\s*\/?>/gi, "\n");
  html = html.replace(/<[^>]+>/g, " ");
  html = html
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í").replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú")
    .replace(/&Aacute;/g, "Á").replace(/&Eacute;/g, "É").replace(/&Iacute;/g, "Í").replace(/&Oacute;/g, "Ó").replace(/&Uacute;/g, "Ú")
    .replace(/&atilde;/g, "ã").replace(/&otilde;/g, "õ")
    .replace(/&Atilde;/g, "Ã").replace(/&Otilde;/g, "Õ")
    .replace(/&ccedil;/g, "ç").replace(/&Ccedil;/g, "Ç")
    .replace(/&ecirc;/g, "ê").replace(/&acirc;/g, "â").replace(/&ocirc;/g, "ô")
    .replace(/&Ecirc;/g, "Ê").replace(/&Acirc;/g, "Â").replace(/&Ocirc;/g, "Ô")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  html = html.replace(/[ \t]+/g, " ");
  html = html.replace(/\n[ \t]+/g, "\n");
  html = html.replace(/\n{3,}/g, "\n\n");
  return html.trim();
}

async function fetchPage(page) {
  const res = await fetch(page.url, {
    headers: { "User-Agent": "AmigoBot/1.0 (Labo3D KB refresh)" },
    // Timeout implicite Vercel — pas de need de custom timeout
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${page.url}`);
  const html = await res.text();
  const text = stripHtml(html);
  return {
    url: page.url,
    label: page.label,
    // Cap à 4000 chars/page pour rester sous les limites de tokens du prompt Claude
    text: text.slice(0, 4000),
    char_count: text.length,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "method not allowed" });
  }
  try {
    const t0 = Date.now();
    const pages = await Promise.all(PAGES.map(fetchPage));
    const current = await loadWaLabo3d();
    const next = {
      ...current,
      knowledge_base: {
        // Company : source of truth des infos statiques (pas dans le site scrapable de manière fiable)
        company: {
          name: "Labo 3D",
          legal_entity: "3A Import LTDA",
          cnpj: "21.496.846/0001-34",
          address: "Rua Riachuelo 44, andar 3, Centro, Rio de Janeiro/RJ, CEP 20230-014",
          phone: "+55 21 96951-8117",
          whatsapp_url: "https://wa.me/5521969518117",
          instagram: "@labo3drio",
          website: "https://labo3d.com.br",
          hours: "Segunda a Sexta, 10h às 19h (horário Brasil)",
          languages: ["pt-BR", "en", "fr"],
        },
        pages,
      },
      knowledge_base_updated_at: new Date().toISOString(),
    };
    await saveWaLabo3d(next);
    return res.status(200).json({
      ok: true,
      pages_count: pages.length,
      total_chars: pages.reduce((s, p) => s + p.text.length, 0),
      total_chars_raw: pages.reduce((s, p) => s + p.char_count, 0),
      duration_ms: Date.now() - t0,
      updated_at: next.knowledge_base_updated_at,
      pages: pages.map(p => ({ label: p.label, chars: p.text.length })),
    });
  } catch (err) {
    console.error("[wa-labo3d-kb-refresh] error:", err);
    return res.status(500).json({ error: err.message });
  }
}
