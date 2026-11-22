# -*- coding: utf-8 -*-
"""Traduction de l'aide de « Ce que je veux voir sur ma page du jour » (22 novembre 2026).
A lancer depuis app/ : python3 tools/i18n_terrain_essentiel.py

La seance terrain passe dans « L'essentiel » pour un client qui a choisi un sport (c'etait la seule
porte vers l'ecran terrain depuis la page du jour) : la phrase d'aide change donc, et une phrase
modifiee est un texte neuf pour le mecanisme de traduction.
"""
import hashlib, json, pathlib, re

T = [
 ("« L'essentiel » garde ta séance du jour, ta semaine, les messages de ton coach, la nutrition, et ta séance terrain si tu as choisi un sport. "
  "« Tout » ajoute ta régularité, ta carte, tes habitudes, les séances en plus et l'article.",
  "« The essentials » keeps your session of the day, your week, your coach's messages, nutrition, and your field session if you have chosen a sport. "
  "« Everything » adds your consistency, your card, your habits, the extra sessions and the article.",
  "« Lo esencial » mantiene tu sesión del día, tu semana, los mensajes de tu entrenador, la nutrición y tu sesión de campo si has elegido un deporte. "
  "« Todo » añade tu regularidad, tu carta, tus hábitos, las sesiones extra y el artículo.", False),
]


def norm(s): return re.sub(r"\s+", " ", re.sub(r"[  ]", " ", str(s))).strip()
def h(k): return hashlib.sha1(k.encode("utf-8")).hexdigest()[:10]


I18N = pathlib.Path("i18n")
textes = json.loads((I18N / "_textes.json").read_text(encoding="utf-8"))
en = json.loads((I18N / "en.json").read_text(encoding="utf-8"))
es = json.loads((I18N / "es.json").read_text(encoding="utf-8"))
known = {e["k"]: e for e in textes}
add, upd = 0, 0
for fr, t_en, t_es, motif in T:
    k = norm(fr); hh = h(k)
    if k not in known:
        textes.append({"h": hh, "k": k, "kind": "pattern" if motif else "string", "where": "src/i18n-terrain-essentiel", "n": 1}); add += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd += 1
    en[hh] = t_en; es[hh] = t_es
(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"{len(T)} texte traite | {add} ajoute | {upd} ecrit")
