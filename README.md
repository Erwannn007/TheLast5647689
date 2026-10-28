# The Last

Un jeu de survie personnel, pour téléphone, dans le navigateur.
Une petite ville de fin d'été que tout le monde a quittée. Pas de zombies : juste le silence,
la faim, la soif, la fatigue, le moral… et ce que les gens ont laissé derrière eux.

## Jouer

- Moitié gauche de l'écran : joystick de marche (il apparaît sous le pouce).
- Moitié droite : joystick de visée, le buste se tourne (jusqu'à 90° des jambes, comme dans
  Project Zomboid). Viser derrière soi en marchant fait reculer, plus lentement.
- Bouton vert : interagir avec ce qui est marqué d'une petite flèche (ouvrir, boire, dormir, couper…).
- Bouton jaune : utiliser l'objet tenu (manger, boire, lire, poser un feu…).
- **SAC** : l'inventaire (3×9 + barre rapide, grille de fabrication 2×2).
  - glisser un objet sur une case : le déplacer (les mêmes objets s'empilent, sinon on échange) ;
  - toucher un objet : infobulle avec ses effets et les actions (utiliser, diviser, ranger, jeter) ;
  - toucher le résultat de fabrication : fabriquer.
- **Voitures** : CONDUIRE à côté d'une voiture. Le joystick gauche indique où aller : la voiture
  accélère et braque vers lui, recule s'il pointe derrière. Beaucoup sont à sec : un jerrican
  tenu en main permet de faire le PLEIN. Phares la nuit, SORTIR à l'arrêt.
- Sur ordinateur : flèches / ZQSD marcher, `IJKL` viser, `E` interagir, `F` utiliser, `Tab` inventaire, `1`–`9` barre rapide.

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
