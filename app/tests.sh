#!/usr/bin/env bash
# Toute la batterie de tests (version Claude, site, relais), en une commande : bash app/tests.sh
# Reconstruit d'abord les trois versions, démarre au besoin l'émulateur d'authentification Firebase (port 9099)
# et le site de test (port 8123), puis lance chaque suite. Code de sortie 0 seulement si tout passe.
set -u
cd "$(dirname "$0")"
LOG="${TMPDIR:-/tmp}/tests_prepa"; mkdir -p "$LOG"
echo "== construction"
python3 build.py > "$LOG/build.txt" 2>&1 && python3 build_site.py >> "$LOG/build.txt" 2>&1 && python3 build_site.py --test >> "$LOG/build.txt" 2>&1 \
  || { cat "$LOG/build.txt"; echo "ÉCHEC : construction impossible"; exit 1; }
tail -3 "$LOG/build.txt"
EMU_PID=""; SRV_PID=""; SITE=1; SAUTE=""
up() { curl -s -o /dev/null -m 3 "$1"; }
# « timeout » est un outil GNU, absent de macOS : sans ce garde-fou, chaque suite sortait en code 127 et
# tests.sh declarait tout en echec sans avoir rien lance. De meme, faute de node, l'emulateur ne demarre
# pas : on saute alors les suites du site en le disant, au lieu d'arreter toute la batterie.
TO=""; for c in timeout gtimeout; do command -v "$c" > /dev/null && { TO="$c 900"; break; }; done
if ! up http://127.0.0.1:9099/; then
  if command -v firebase > /dev/null; then FB="firebase"
  elif command -v npx > /dev/null; then FB="npx --yes firebase-tools@15"
  else FB=""; fi
  if [ -z "$FB" ]; then
    SITE=0; SAUTE="$SAUTE
      - les suites du site (émulateur d'authentification : ni firebase ni npx/node sur cette machine)"
    echo "saut  suites du site : ni firebase ni npx (node) sur cette machine"
  else
    mkdir -p "$LOG/emu"
    printf '{ "emulators": { "auth": { "port": 9099 }, "ui": { "enabled": false }, "singleProjectMode": true } }\n' > "$LOG/emu/firebase.json"
    (cd "$LOG/emu" && $FB emulators:start --only auth --project demo-prepa > "$LOG/emu.log" 2>&1) &
    EMU_PID=$!
    for i in $(seq 1 120); do up http://127.0.0.1:9099/ && break; sleep 2; done
    up http://127.0.0.1:9099/ || { tail -20 "$LOG/emu.log"; SITE=0
      SAUTE="$SAUTE
      - les suites du site (émulateur d'authentification injoignable : voir $LOG/emu.log)"
      echo "saut  suites du site : émulateur d'authentification injoignable"; }
  fi
fi
if [ "$SITE" = 1 ] && ! up http://127.0.0.1:8123/index.html; then
  python3 -m http.server 8123 --bind 127.0.0.1 --directory site_test > /dev/null 2>&1 &
  SRV_PID=$!
  sleep 1
fi
FAIL=0
# traductions : chaque texte visible doit exister en anglais et en espagnol (voir CLAUDE.md, « Langues »)
# les trois cibles doivent porter le code actuel : une correction non reconstruite est deja arrivee deux fois
if python3 tools/verif_cibles.py > "$LOG/cibles.txt" 2>&1; then echo "ok    cibles construites a jour"; else FAIL=1; echo "ÉCHEC cibles en retard :"; cat "$LOG/cibles.txt"; fi
if command -v node > /dev/null; then
  [ -d tools/node_modules/acorn ] || npm install --prefix tools --silent > "$LOG/npm.txt" 2>&1
  # un hook declare apres un retour anticipe fait tomber toute l'application (erreur React #300)
  if node tools/verif_hooks.mjs > "$LOG/hooks.txt" 2>&1; then echo "ok    $(cat "$LOG/hooks.txt")"; else FAIL=1; echo "ÉCHEC hooks apres un retour anticipe :"; head -12 "$LOG/hooks.txt"; fi
  if node tools/i18n_extract.mjs --manque > "$LOG/i18n.txt" 2>&1; then echo "ok    traductions (anglais, espagnol) complètes"; else FAIL=1; echo "ÉCHEC traductions manquantes :"; head -20 "$LOG/i18n.txt"; fi
else
  SAUTE="$SAUTE
      - le contrôle de complétude des traductions (node absent)"
  echo "saut  contrôle des traductions : node n'est pas installé"
fi
LOCALES="unit_niveau.py unit_instagram.py smoke.py e2e.py e2e_claude_acces.py e2e_nutri.py e2e_features.py
  e2e_lite_claude.py e2e_terrain.py e2e_messages.py e2e_profil.py e2e_formules.py e2e_grille.py e2e_langues.py
  e2e_hydra.py e2e_plats.py e2e_perso.py e2e_contenu.py e2e_materiel.py e2e_pdf_carte.py e2e_vivacite.py
  e2e_cycle.py e2e_objectifs.py e2e_autoreg.py e2e_demarrage.py e2e_nutriadapt.py e2e_energie.py e2e_equipe.py
  e2e_club.py e2e_gestion.py e2e_semaine.py e2e_echelle.py e2e_simple.py"
DUSITE="e2e_site.py e2e_site2.py e2e_pay.py e2e_pwa.py e2e_features_site.py e2e_lite.py e2e_terrain_site.py
  e2e_rules_site.py e2e_messages_site.py e2e_sante_site.py e2e_club_site.py e2e_tarifs.py e2e_factures.py"
suite() {
  for t in $1; do
    $TO python3 "$t" > "$LOG/$t.txt" 2>&1; c=$?
    r=$(grep -E "[0-9]+ OK, [0-9]+ échecs|^[0-9]+ / [0-9]+$" "$LOG/$t.txt" | tail -1)
    if [ $c -ne 0 ]; then FAIL=1; echo "ÉCHEC $t (code $c) ${r}"; grep -E "FAIL|Traceback|Error|ERREUR" "$LOG/$t.txt" | head -8; else echo "ok    $t ${r}"; fi
  done
}
suite "$LOCALES"
[ "$SITE" = 1 ] && suite "$DUSITE"
if command -v node > /dev/null; then
  for t in test_worker.mjs test_ia.mjs test_sante.mjs; do
    (cd relay && node "$t" > "$LOG/$t.txt" 2>&1); c=$?
    if [ $c -ne 0 ]; then FAIL=1; echo "ÉCHEC relay/$t"; grep FAIL "$LOG/$t.txt" | head -8; else echo "ok    relay/$t $(tail -1 "$LOG/$t.txt")"; fi
  done
else
  SAUTE="$SAUTE
      - les tests du relais (node absent)"
  echo "saut  tests du relais : node n'est pas installé"
fi
[ -n "$SRV_PID" ] && kill "$SRV_PID" 2> /dev/null
[ -n "$EMU_PID" ] && kill "$EMU_PID" 2> /dev/null
if [ -n "$SAUTE" ]; then echo "PAS TOUT VÉRIFIÉ — sauté sur cette machine :$SAUTE"
  echo "      (pour tout lancer : installer node, puis « npm install --prefix tools »)"; fi
if [ $FAIL -ne 0 ]; then echo "AU MOINS UN ÉCHEC : voir $LOG"
elif [ -n "$SAUTE" ]; then echo "VERT sur tout ce qui a pu tourner ici"
else echo "TOUT EST VERT"; fi
exit $FAIL
