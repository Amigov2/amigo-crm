# API Amigo CRM — Émission NFS-e Nota Carioca

## Endpoints

| Route | Méthode | Rôle |
|---|---|---|
| `/api/health` | GET | Healthcheck — confirme que les Vercel Functions tournent |
| `/api/cert-info` | GET | Lit le certif A1 depuis env vars, retourne sujet/validité (pour tester la config) |
| `/api/emit-nfse` | POST | Émet une NFS-e Nota Carioca pour une commande Amigo CRM |

## Variables d'environnement à configurer (Vercel → Settings → Environment Variables)

| Variable | Valeur | Notes |
|---|---|---|
| `CERT_A1_PFX_BASE64` | base64 du fichier .pfx | `base64 -i cert.pfx \| pbcopy` puis coller. Marquer "Sensitive" |
| `CERT_A1_PASSWORD` | mot de passe du certificat | Marquer "Sensitive" |
| `CCM_3AIMPORT` | numéro CCM de 3A Import à Rio | À récupérer auprès d'Eduardo |
| `SUPABASE_URL` | https://sujdarqrksqwcmtapcjw.supabase.co | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key Supabase | Marquer "Sensitive" — permet write |

## Tester localement

```bash
# 1. Mettre les env vars dans .env (NE JAMAIS COMMIT)
echo "CERT_A1_PFX_BASE64=$(base64 -i ~/Downloads/3aimport-A1.pfx)" > .env
echo "CERT_A1_PASSWORD=monmotdepasse" >> .env
echo "CCM_3AIMPORT=12345678" >> .env

# 2. Démarrer Vercel dev (Vite + functions ensemble)
vercel dev

# 3. Tester les endpoints
curl http://localhost:3000/api/health
curl http://localhost:3000/api/cert-info
curl -X POST http://localhost:3000/api/emit-nfse \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ordh5bhk9","env":"HOMOL","dryRun":true}'
```

## Status d'implémentation

- [x] Infra Vercel Function + libs (`xml-crypto`, `node-forge`)
- [x] Endpoint healthcheck
- [x] Endpoint cert-info
- [x] Construction XML RPS (schéma ABRASF simplifié)
- [x] Signature numérique XML avec cert A1
- [x] Enveloppe SOAP `RecepcionarLoteRps`
- [ ] **À VALIDER** : schéma RPS exact attendu par Nota Carioca (vs schéma ABRASF générique) — peut nécessiter ajustements de namespaces et champs
- [ ] **À VALIDER** : SOAPAction exacte du WSDL Nota Carioca
- [ ] Parsing de la réponse SOAP (extraction NumeroNfse + CodigoVerificacao)
- [ ] Polling `ConsultarSituacaoLoteRps` (le traitement est async côté mairie)
- [ ] Mise à jour de l'order en Supabase avec `nfNumber`, `nfChave`, `nfXml`, `nfPdfUrl`
- [ ] Génération du PDF DANFSe (depuis le XML retourné)
- [ ] UI Amigo CRM : bouton "Émettre NFS-e" dans ProspectModal/order detail
- [ ] Test en homologation Nota Carioca avant prod

## Sécurité

- `.env`, `*.pfx`, `*.p12`, `*.key`, `*.pem` sont dans `.gitignore`
- En prod, le cert est stocké en env var Vercel (base64), jamais sur disque
- Si la machine de dev est compromise, **changer le mot de passe du cert** auprès de l'AC
