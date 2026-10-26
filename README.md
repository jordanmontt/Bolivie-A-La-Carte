# Bolivia à la carte

Guide touristique de la Bolivie : une carte interactive de 103 lieux avec photos, cuisine,
météo et trajets, des conseils pratiques (argent, bus, blocages) et un planificateur de
voyage facultatif. En français, anglais et espagnol.

Site : https://jordanmontt.github.io/Bolivie-A-La-Carte/

Créé par [jordanmontt](https://github.com/jordanmontt) · sebastian.jordan.m@proton.me

## Modifier le site (sans programmer)

Tout le contenu est dans le dossier `content/`, en fichiers texte simples (format YAML).
Chaque information n'est écrite qu'une seule fois ; le site l'affiche partout où elle sert.
Par exemple, une fête est écrite une fois dans `content/festivals.yml` : elle apparaît sur la
page Fêtes et sur la fiche de son lieu ; un plat est décrit une fois dans `content/dishes.yml` et
la page Saveurs se construit à partir des plats cités par chaque lieu.

| Je veux… | Fichier à modifier |
| --- | --- |
| changer la description, les choses à faire ou les conseils d'un lieu | `content/places/<lieu>.yml` (parties `fr:`, `en:`, `es:`) |
| ajouter ou retirer une photo d'un lieu | déposer l'image dans `photos/`, puis l'ajouter sous `photos:` dans `content/places/<lieu>.yml` |
| changer un trajet (durée, comment y aller) | `content/routes.yml` |
| changer un plat | `content/dishes.yml` (les lieux citent leurs plats sous `dishes:`) |
| changer le nom ou la description d'une région, l'ordre des lieux | `content/regions.yml` |
| changer la page Conseils | `content/guide/fr.yml`, `en.yml`, `es.yml` |
| changer un texte de l'interface (boutons, titres) | `content/ui/fr.yml`, `en.yml`, `es.yml` |
| changer une idée d'itinéraire | `content/itineraries.yml` |
| changer une fête (date, texte) | `content/festivals.yml` |
| changer le patrimoine UNESCO, l'artisanat, les légendes | `content/unesco.yml`, `content/crafts.yml`, `content/legends.yml` |
| changer un passage de frontière | `content/borders.yml` |

**Ajouter un lieu** : copier `content/places/_modele.yml` en `content/places/<id>.yml`
(un identifiant court, sans espace ni accent, par exemple `sorata`), le remplir, puis
ajouter `<id>` dans la liste `places:` de sa région dans `content/regions.yml`.

**Quelques règles du format** :
- l'indentation se fait avec des espaces (pas de tabulation) ;
- un texte long peut s'écrire après `>-` sur plusieurs lignes, elles seront jointes ;
- si un texte commence par un signe spécial (`«`, `"`, `[`, `-`) ou contient `: `, mettez-le
  entre guillemets `"…"` ; à l'intérieur, écrivez `\"` pour un guillemet ;
- une ligne qui commence par `#` est un commentaire.

**Publier** : modifiez le fichier directement sur github.com (bouton crayon) et validez.
L'action « Build site » reconstruit le site en une minute ou deux. S'il manque quelque
chose (une traduction, une photo introuvable, un lieu inconnu), l'action échoue et dit
précisément quoi et où, et le site en ligne n'est pas modifié.

Sur un ordinateur, la même vérification se lance avec :

```
node tools/build.mjs
```

## Organisation technique

Pas de framework : ouvrir `index.html` suffit (cela marche aussi depuis le disque).

| Chemin | Contenu |
| --- | --- |
| `content/` | **La source** : lieux, trajets, plats, climats, régions, textes (à modifier) |
| `data/*.js`, `locales/*.js` | Générés par `tools/build.mjs` depuis `content/` (ne pas modifier) |
| `data/geo.js`, `assets/relief.jpg` | Fond de carte, tracé des routes et relief |
| `data/rates.js` | Taux du dollar et de l'euro, copiés chaque matin depuis la Banque centrale |
| `photos/`, `photos/sm/` | Photos (Wikimedia Commons) et leurs copies de 640 px |
| `js/core.js` | Constantes, utilitaires, état (le voyage, les filtres) |
| `js/views/*.js` | Une page par fichier : accueil, conseils, culture, liste, fiche, trajets, voyage |
| `js/map.js` | La carte (Leaflet, chargée à la demande) |
| `js/app.js` | Routeur, cadre de page, événements, démarrage |
| `js/i18n.js`, `js/model.js` | Langues ; réseau de trajets, plus courts chemins, calculs du voyage |
| `tools/` | Construction, lecteur YAML, petites photos, taux de change |

Les fichiers `js/` sont des scripts classiques qui partagent leurs noms, chargés dans
l'ordre de `index.html`. Ajouter une rubrique : un fichier dans `content/`, sa lecture dans
`tools/build.mjs`, et une vue dans `js/views/`.

## Chargement et cache

La page d'accueil ne charge que la langue active, les données des lieux et ses photos.
Leaflet et la géométrie de la carte se chargent à la première ouverture de la carte. Les
listes utilisent les copies de 640 px de `photos/sm/` (`python3 tools/make-small-photos.py`
les crée ; l'action « Build site » le fait toute seule).

`sw.js` garde en cache photos, relief, tuiles, polices et bibliothèques ; le code, les
données et les textes sont toujours rechargés. Si une photo est remplacée sous le même nom,
augmenter `VERSION` dans `sw.js`. À chaque nouvelle version du code, augmenter le `?v=` de
`index.html` et `RELEASE` dans `js/i18n.js`.

## Taux de change

La page de la Banque centrale ne peut pas être lue depuis le navigateur des visiteurs :
`.github/workflows/rates.yml` lance `node tools/update-rates.mjs` chaque matin et publie
`data/rates.js` quand les taux changent (lancement manuel : onglet Actions, « Exchange
rates », « Run workflow »).

## Langues

La langue vient de `?lang=` dans l'adresse, puis du choix enregistré du visiteur, puis des
langues du navigateur, et sinon l'anglais. Seule la langue active est téléchargée.

## Droits d'auteur

© jordanmontt. Tous droits réservés : le code, les textes, le design et le logo de ce site
ne peuvent pas être réutilisés sans autorisation. Contact : sebastian.jordan.m@proton.me

Les photos gardent leur propre licence Creative Commons, indiquée sous chaque photo
(Wikimedia Commons). Données cartographiques : Natural Earth, SRTM, OpenStreetMap (OSRM),
Esri.
