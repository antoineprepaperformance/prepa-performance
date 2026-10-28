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
EMU_PID=""; SRV_PID=""
up() { curl -s -o /dev/null -m 3 "$1"; }
if ! up http://127.0.0.1:9099/; then
  mkdir -p "$LOG/emu"
  printf '{ "emulators": { "auth": { "port": 9099 }, "ui": { "enabled": false }, "singleProjectMode": true } }\n' > "$LOG/emu/firebase.json"
  if command -v firebase > /dev/null; then FB="firebase"; else FB="npx --yes firebase-tools@15"; fi
  (cd "$LOG/emu" && $FB emulators:start --only auth --project demo-prepa > "$LOG/emu.log" 2>&1) &
  EMU_PID=$!
  for i in $(seq 1 120); do up http://127.0.0.1:9099/ && break; sleep 2; done
  up http://127.0.0.1:9099/ || { tail -20 "$LOG/emu.log"; echo "ÉCHEC : émulateur d'authentification injoignable"; exit 1; }
fi
if ! up http://127.0.0.1:8123/index.html; then
  python3 -m http.server 8123 --bind 127.0.0.1 --directory site_test > /dev/null 2>&1 &
  SRV_PID=$!
  sleep 1
fi
FAIL=0
# traductions : chaque texte visible doit exister en anglais et en espagnol (voir CLAUDE.md, « Langues »)
[ -d tools/node_modules/acorn ] || npm install --prefix tools --silent > "$LOG/npm.txt" 2>&1
if node tools/i18n_extract.mjs --manque > "$LOG/i18n.txt" 2>&1; then echo "ok    traductions (anglais, espagnol) complètes"; else FAIL=1; echo "ÉCHEC traductions manquantes :"; head -20 "$LOG/i18n.txt"; fi
for t in unit_niveau.py smoke.py e2e.py e2e_claude_acces.py e2e_nutri.py e2e_features.py e2e_lite_claude.py e2e_terrain.py e2e_messages.py e2e_profil.py e2e_formules.py e2e_langues.py e2e_hydra.py e2e_plats.py e2e_perso.py \
         e2e_site.py e2e_site2.py e2e_pay.py e2e_pwa.py e2e_features_site.py e2e_lite.py e2e_terrain_site.py e2e_rules_site.py e2e_messages_site.py e2e_sante_site.py e2e_tarifs.py e2e_factures.py; do
  timeout 900 python3 "$t" > "$LOG/$t.txt" 2>&1; c=$?
  r=$(grep -E "[0-9]+ OK, [0-9]+ échecs|^[0-9]+ / [0-9]+$" "$LOG/$t.txt" | tail -1)
  if [ $c -ne 0 ]; then FAIL=1; echo "ÉCHEC $t (code $c) ${r}"; grep -E "FAIL|Traceback|Error|ERREUR" "$LOG/$t.txt" | head -8; else echo "ok    $t ${r}"; fi
done
for t in test_worker.mjs test_ia.mjs test_sante.mjs; do
  (cd relay && node "$t" > "$LOG/$t.txt" 2>&1); c=$?
  if [ $c -ne 0 ]; then FAIL=1; echo "ÉCHEC relay/$t"; grep FAIL "$LOG/$t.txt" | head -8; else echo "ok    relay/$t $(tail -1 "$LOG/$t.txt")"; fi
done
[ -n "$SRV_PID" ] && kill "$SRV_PID" 2> /dev/null
[ -n "$EMU_PID" ] && kill "$EMU_PID" 2> /dev/null
if [ $FAIL -eq 0 ]; then echo "TOUT EST VERT"; else echo "AU MOINS UN ÉCHEC : voir $LOG"; fi
exit $FAIL
