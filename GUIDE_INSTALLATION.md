# Guide d'Installation - Gebat EasyPaie

## ⚠️ Problème PowerShell

Si vous rencontrez l'erreur :
```
Impossible de charger le fichier npm.ps1, car l'exécution de scripts est désactivée sur ce système
```

C'est dû à la politique d'exécution PowerShell. Voici les solutions :

## 🔧 Solution 1 : Autoriser les scripts temporairement (Recommandé)

Ouvrez PowerShell en tant qu'**Administrateur** et exécutez :

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Ensuite, fermez et rouvrez PowerShell, puis :

```bash
cd c:\Users\yacouba.mohamed\AppData\Roaming\npm
```

Ou utilisez directement :

```bash
node c:\Users\yacouba.mohamed\AppData\Roaming\npm\node_modules\npm\bin\npm-cli.js install
```

## 🔧 Solution 2 : Utiliser Node.js directement

Au lieu de `npm`, utilisez `node` avec le chemin complet :

```bash
cd c:\Users\yacouba.mohamed\AppData\Roaming\npm
node npm-cli.js install
```

## 🔧 Solution 3 : Utiliser CMD au lieu de PowerShell

1. Ouvrez **Invite de commandes** (CMD) au lieu de PowerShell
2. Naviguez vers le dossier du projet :
```cmd
cd c:\Users\yacouba.mohamed\Documents\Projet_Digitalisation\Gebat\gebat-easypaie
```
3. Exécutez :
```cmd
npm install
```

## 📋 Étapes d'installation complètes

Une fois le problème npm résolu :

### 1. Installer les dépendances

```bash
cd c:\Users\yacouba.mohamed\Documents\Projet_Digitalisation\Gebat\gebat-easypaie
npm install
```

### 2. Démarrer le serveur backend (Terminal 1)

```bash
npm run server
```

Le serveur démarrera sur `http://localhost:5000`

### 3. Démarrer l'application frontend (Terminal 2)

Ouvrez un nouveau terminal et exécutez :

```bash
cd c:\Users\yacouba.mohamed\Documents\Projet_Digitalisation\Gebat\gebat-easypaie
npm run dev
```

L'application sera accessible sur `http://localhost:3000`

## 🎯 Vérification de l'installation

Une fois les deux serveurs démarrés :

1. Ouvrez votre navigateur
2. Allez sur `http://localhost:3000`
3. Vous devriez voir l'interface de Gebat EasyPaie

## 🐛 Si vous avez toujours des problèmes

### Vérifier que Node.js est installé

```bash
node --version
```

Devrait afficher une version (ex: v18.x.x ou supérieur)

### Vérifier que npm est installé

```bash
npm --version
```

Devrait afficher une version

### Alternative : Installer les dépendances manuellement

Si npm ne fonctionne toujours pas, vous pouvez :

1. Télécharger les packages depuis npmjs.com manuellement
2. Les placer dans le dossier `node_modules`
3. Ou utiliser un autre gestionnaire de packages comme `yarn`

## 📞 Support

Si vous rencontrez toujours des problèmes, contactez l'équipe technique avec :
- La version de Node.js
- La version de npm
- Le message d'erreur exact
