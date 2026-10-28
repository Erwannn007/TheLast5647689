# The Last

Un jeu de survie personnel, pour téléphone, dans le navigateur, dans l'esprit de Project Zomboid
(sans zombies pour l'instant). Une région entière que tout le monde a quittée : un centre-ville
moderne à tours, une banlieue, une zone industrielle, des fermes, des forêts, des lacs.
Juste le silence, la faim, la soif, la fatigue, le moral… et ce que les gens ont laissé derrière eux.

## Le monde

- Carte de 256 × 256 cases générée d'une graine : bureaux, immeubles, commissariat, hôpital,
  armurerie, pharmacie, supermarché, quincaillerie, restaurant, station-service, entrepôts,
  maisons, fermes et granges, cabanes de chasse, champs, lacs, files de voitures abandonnées.
- Bâtiments à étages : escaliers (MONTER / DESCENDRE), toits-terrasses, murs coupés autour de soi.
- Électricité : pendant les premiers jours, lampadaires, fenêtres et plafonniers s'allument la nuit,
  puis le courant saute pour de bon.
- Animaux sauvages (cerfs, lapins) qui fuient le joueur et les coups de feu ; on les chasse,
  on les dépèce (couteau ou hache) et on cuit la viande au feu.
- Bouton carte (sous le menu) : la carte entière, à faire glisser.

## Jouer

- Moitié gauche de l'écran : joystick de marche (il apparaît sous le pouce).
- Moitié droite : joystick de visée, le buste se tourne (jusqu'à 90° des jambes, comme dans
  Project Zomboid). Viser derrière soi en marchant fait reculer, plus lentement.
- Près d'une maison, côté arrière ou côté : le toit s'efface et les murs devant vous sont coupés.
- Bouton vert : interagir avec ce qui est marqué d'une petite flèche (ouvrir, boire, dormir, couper…).
- Bouton jaune : utiliser l'objet tenu (manger, boire, lire, poser un feu…).
- **SAC** : l'inventaire (3×9 + barre rapide, grille de fabrication 2×2).
  - glisser un objet sur une case : le déplacer (les mêmes objets s'empilent, sinon on échange) ;
  - toucher un objet : infobulle avec ses effets et les actions (utiliser, diviser, ranger, jeter) ;
  - toucher le résultat de fabrication : fabriquer.
- **Armes à feu** (pistolet, fusil à pompe, carabine) : tenir l'arme, viser au joystick droit et
  le relâcher pour tirer, ou bouton TIRER ; le bouton jaune RECHARGE avec les munitions du sac.
- **COURIR** (bouton violet, à garder enfoncé) : sprint, plus rapide mais fatigant ; impossible
  en visant ou à bout de forces.
- **Voitures** : CONDUIRE à côté d'une voiture. GAZ et FREIN à droite (à garder enfoncés ; FREIN à
  l'arrêt = marche arrière). Pour braquer, au choix dans le menu : le joystick (le nez de la
  voiture suit le pouce, par défaut) ou un volant à tourner. Les roues avant braquent avec. Beaucoup sont à
  sec : un jerrican tenu en main permet de faire le PLEIN. Phares la nuit, SORTIR à l'arrêt.
- Sur ordinateur : flèches / ZQSD marcher, `Maj` courir, `IJKL` viser, `Espace` gaz, `X` frein, `E` interagir, `F` utiliser, `Tab` inventaire, `1`–`9` barre rapide.

Quelques recettes (2×2, sans forme) : drap + couteau → 3 chiffons ; 2 chiffons → bandage ;
2 bûches + 2 branches → feu de camp ; branche + ficelle → canne à pêche ; lampe ou radio + piles → rechargée.
Le feu de camp cuit (poisson, eau croupie → eau) et brûle bûches, branches, journaux, livres.

## Installer sur l'iPhone

Le jeu est une PWA statique (aucune compilation). Il faut le servir en HTTPS, par exemple avec
GitHub Pages : *Settings → Pages → Deploy from branch → main / (root)*. Ensuite, dans Safari :
*Partager → Sur l'écran d'accueil*. Il fonctionne ensuite hors ligne, en plein écran.

En local : `python3 -m http.server 8765` puis `http://localhost:8765`.

## Style et code

Tout le graphisme est généré par code au lancement (aucune image), selon
[docs/spritedesign-rules.md](docs/spritedesign-rules.md) : isométrique 2:1, 4 tons par matière,
tramage Bayer, contour sel-out, échelle entière. Le son est entièrement synthétisé (Web Audio).

- `src/raster.js`, `src/solids.js` : les moteurs du guide (volumes ronds / volumes droits).
- `src/sprites/` : sols, végétation, murs et toits, meubles, voitures (5 carrosseries), personnage, icônes.
- `src/world.js` : génération de la ville ; `src/game.js` : règles ; `src/render.js` : dessin ;
  `src/ui.js` : interface ; `src/audio.js` : ambiance et bruitages.
- `tools/preview.mjs <groupe>` : planches de contrôle des sprites (PNG agrandis) ;
  `tools/map.mjs` : carte du monde ; `tools/logic-test.mjs` : tests de logique ;
  `tools/appicons.mjs` : icônes de l'écran d'accueil.
