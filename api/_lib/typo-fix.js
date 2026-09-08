// Guardrail serveur : corrige les typos courantes du bot IA avant envoi client.
// Ne modifie que les patterns précisément identifiés — n'invente rien.

const CORRECTIONS = [
  // Salutations avec le "b" ou "d" décalé (bug de tokens LLM connu)
  [/\bBoan\s+oite\b/gi, "Boa noite"],
  [/\bBoa\s+noit\b/gi, "Boa noite"],
  [/\bBo\s+noite\b/gi, "Boa noite"],
  [/\bBoan\s+tarde\b/gi, "Boa tarde"],
  [/\bBoa\s+tard\b/gi, "Boa tarde"],
  [/\bBo\s+tarde\b/gi, "Boa tarde"],
  [/\bBom\s+di\b/gi, "Bom dia"],
  [/\bBomd\s+ia\b/gi, "Bom dia"],
  [/\bB\s+om\s+dia\b/gi, "Bom dia"],
  // Bem-vindo
  [/\bBemvindo\b/gi, "Bem-vindo"],
  [/\bBenvindo\b/gi, "Bem-vindo"],
  // Nom marque
  [/\bLAbo\s?3d\b/g, "LABO 3D"],
  [/\blabo\s?3d\b/g, "LABO 3D"],
  [/\bLabo3d\b/g, "LABO 3D"],
  // "posso" tronqué en "psso"
  [/\bpsso\b/gi, "posso"],
  [/\bpsss?o\b/gi, "posso"],
  // Espaces multiples
  [/[ \t]{2,}/g, " "],
];

export function fixTypos(text) {
  if (!text || typeof text !== "string") return text;
  let out = text;
  for (const [pattern, replacement] of CORRECTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}
