# -*- coding: utf-8 -*-
"""Traductions ajoutees a la main pour ce que le JOUEUR voit de la saison d'equipe (17 novembre 2026),
quand Node n'est pas disponible. Meme mecanisme que i18n_main.py : voir ce fichier pour le detail.
A lancer depuis app/ : python3 tools/i18n_equipe.py

Perimetre volontairement limite : les libelles de la carte du joueur et de la seance qu'il ouvre. L'ecran
coach reste en francais (c'est l'ecran d'Antoine), et le CONTENU des seances du club (titres d'activites,
lignes de detail, notes) reste en francais aussi : c'est la programmation d'un club francais, ecrite par
Antoine, pas de l'interface. Le reste est a faire par le robot du dimanche, qui a Node.
"""
import hashlib, json, pathlib, re

# motifs (un nombre + un mot) : voir i18n/_extra.json, tenue a la main
P = [
 ("{#} minutes", "{#} minutes", "{#} minutos"),
 ("{#} minute", "{#} minute", "{#} minuto"),
]

T = [
 ("Ta séance d'équipe", "Your team session", "Tu sesión de equipo"),
 ("Ta séance d'équipe, ce soir", "Your team session, tonight", "Tu sesión de equipo, esta noche"),
 ("Ta prochaine séance d'équipe", "Your next team session", "Tu próxima sesión de equipo"),
 ("Voir le détail", "See the details", "Ver el detalle"),
 ("Cette séance est celle de ton club : elle n'est pas comptée dans ta charge de la semaine tant que tu ne l'enregistres pas toi-même, en séance en plus.",
  "This session is your club's: it is not counted in your weekly load unless you log it yourself, as an extra session.",
  "Esta sesión es la de tu club: no cuenta en tu carga de la semana mientras no la registres tú mismo, como sesión adicional."),
 ("‹ Retour", "‹ Back", "‹ Volver"),
 ("Pas de détail noté pour ce bloc.", "No details written down for this block.", "Sin detalle anotado para este bloque."),
 ("Intense", "Intense", "Intenso"),
 ("Charge contenue : technique, collectif réduit, peu de déplacement.",
  "Contained load: technique, small-sided games, little running.",
  "Carga contenida: técnica, juego reducido, poco desplazamiento."),
 ("Grosse soirée : jeu de fitness, collectif total, forte sollicitation.",
  "Big evening: fitness game, full-team play, heavy demand.",
  "Noche exigente: juego de fitness, juego completo, mucha solicitación."),
 ("Qualité : vitesse, réactivité, appuis. Volume court, récupération longue.",
  "Quality: speed, reactivity, footwork. Short volume, long recovery.",
  "Calidad: velocidad, reactividad, apoyos. Volumen corto, recuperación larga."),
 ("Volume de travail élevé, intensité contenue. Typique de la présaison.",
  "High work volume, contained intensity. Typical of pre-season.",
  "Volumen de trabajo alto, intensidad contenida. Típico de la pretemporada."),
]


def norm(s):
    s = re.sub(r"[  ]", " ", str(s))
    return re.sub(r"\s+", " ", s).strip()


def h(k): return hashlib.sha1(k.encode("utf-8")).hexdigest()[:10]


I18N = pathlib.Path("i18n")
textes = json.loads((I18N / "_textes.json").read_text(encoding="utf-8"))
extra = json.loads((I18N / "_extra.json").read_text(encoding="utf-8"))
en = json.loads((I18N / "en.json").read_text(encoding="utf-8"))
es = json.loads((I18N / "es.json").read_text(encoding="utf-8"))
known = {e["k"]: e for e in textes}
add_t, add_x, upd = 0, 0, 0
for k_raw, t_en, t_es, where in [(a, b, c, "extra i18n/_extra.json") for a, b, c in P] + [(a, b, c, "src/i18n-equipe") for a, b, c in T]:
    k = norm(k_raw)
    hh = h(k)
    if k not in known:
        textes.append({"h": hh, "k": k, "kind": "extra" if where.startswith("extra") else "literal", "where": where, "n": 1}); add_t += 1
    else:
        hh = known[k]["h"]
    if where.startswith("extra") and k not in extra:
        extra.append(k); add_x += 1
    if en.get(hh) != t_en or es.get(hh) != t_es: upd += 1
    en[hh] = t_en; es[hh] = t_es

(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
(I18N / "_extra.json").write_text(json.dumps(extra, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"{len(P) + len(T)} textes traites | {add_t} ajoutes a _textes.json | {add_x} motifs ajoutes | {upd} traductions ecrites")
