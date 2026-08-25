# Amigo CRM — Printer Bridge

Script qui tourne sur le Mac Mini de l'atelier.
Écoute la Bambu Lab A1 via MQTT et envoie les données vers Amigo CRM.

## Installation sur le Mac Mini

```bash
# 1. Copier le dossier printer-bridge sur le Mac Mini

# 2. Installer les dépendances
cd printer-bridge
npm install

# 3. Lancer
node bridge.js

# 4. Pour que ça tourne en permanence (même après redémarrage)
# Option A : avec pm2
npm install -g pm2
pm2 start bridge.js --name amigo-bridge
pm2 save
pm2 startup  # suivre les instructions affichées

# Option B : avec un fichier plist (macOS natif)
# Voir install-service.sh
```

## Ce que ça fait

- Écoute la Bambu Lab A1 en temps réel (MQTT)
- Quand une impression se termine → envoie les données vers Supabase
- Déduit automatiquement le filament du stock dans Amigo
- Ajoute l'impression dans le fil d'activité

## Configuration

Modifier `config.json` pour changer les IPs ou credentials.
