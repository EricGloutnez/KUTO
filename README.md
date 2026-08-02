# KÜTO — Plateforme de feuilles de caisse

Application web : **NIP à 4 chiffres** pour l'iPad du comptoir, **mot de passe admin fort** pour les rapports. Les feuilles sont enregistrées dans le cloud (base de données), donc consultables depuis n'importe quel appareil.

---

## Déploiement gratuit sur Render (avec une base de données permanente)

Compte le tout à environ 10 minutes. Rien à payer.

### Étape 1 — Créer une base de données gratuite et permanente (Neon)

> La base de données *gratuite* de Render est supprimée après ~30 jours. On utilise donc **Neon** (Postgres gratuit et permanent). C'est le seul « détour ».

1. Va sur **https://neon.tech** et crée un compte gratuit.
2. Crée un projet (n'importe quel nom, ex. « kuto »).
3. Dans le tableau de bord du projet, copie la **Connection string** (elle ressemble à `postgresql://user:pass@ep-xxxx.neon.tech/neondb?sslmode=require`). Garde-la de côté.

### Étape 2 — Mettre le code sur GitHub

1. Crée un compte **https://github.com** si tu n'en as pas.
2. Crée un nouveau dépôt (ex. « kuto-caisse »), puis **téléverse tous les fichiers de ce dossier** (bouton *Add file → Upload files*, glisse tout, *Commit*).

### Étape 3 — Déployer sur Render

1. Va sur **https://render.com**, crée un compte gratuit (tu peux te connecter avec GitHub).
2. **New + → Web Service** → connecte ton dépôt GitHub « kuto-caisse ».
3. Render détecte Node automatiquement. Vérifie :
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : **Free**
4. Ouvre la section **Environment** et ajoute ces variables :
   - `DATABASE_URL` → colle la *Connection string* de Neon (Étape 1).
   - `INITIAL_ADMIN_PASSWORD` → choisis un **mot de passe admin fort**.
   - `INITIAL_PIN` → `1234` (ou un autre code à 4 chiffres).
   - `SESSION_SECRET` → une longue suite de caractères au hasard.
5. Clique **Create Web Service**. Après ~2 minutes, tu obtiens une adresse du type `https://kuto-caisse.onrender.com`.

> Astuce : *New + → Blueprint* utilise directement le fichier `render.yaml` fourni (il ne reste qu'à coller `DATABASE_URL` et `INITIAL_ADMIN_PASSWORD`).

### Étape 4 — Installer sur l'iPad

1. Ouvre l'adresse Render dans **Safari** sur l'iPad.
2. Bouton **Partager** → **Sur l'écran d'accueil**. L'app s'installe avec son icône et s'ouvre en plein écran.
3. Entre le **NIP** (celui de `INITIAL_PIN`).
4. Touche l'engrenage ⚙ → entre le **mot de passe admin** → **Sécurité** : change le NIP et le mot de passe admin pour les tiens, et ajoute tes serveurs.

---

## Notes

- **Réveil du serveur** : sur le forfait gratuit de Render, le serveur s'endort après ~15 min d'inactivité. La première ouverture de la journée peut prendre ~30-60 sec à se réveiller, ensuite c'est instantané.
- **Sécurité** : le mot de passe admin est stocké **haché** (scrypt), jamais en clair. Le NIP protège l'accès au comptoir.
- **Données** : tout est dans ta base Neon. Pense à changer le NIP et le mot de passe admin par défaut dès la première connexion.

## Développement local (optionnel)

Sans `DATABASE_URL`, l'app démarre avec un stockage fichier local (`data.json`) — pratique pour tester sur ton ordinateur :

```
npm start   # puis ouvre http://localhost:3000  (NIP par défaut : 1234, admin : kuto-admin)
```
