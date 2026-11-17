# -*- coding: utf-8 -*-
"""Convertit une saison d'entraînement d'équipe (classeur Excel d'Antoine) en contenu de l'application.

À lancer depuis app/ :
    python3 tools/saison_equipe.py "/chemin/Saison 2025-2026.xlsx" cmfloirac "CM Floirac Rugby" rugby [noms.txt]

Écrit app/content_equipe.py. À relancer tel quel à chaque nouvelle saison : le fichier est GÉNÉRÉ,
on ne le modifie jamais à la main. Il ne contient qu'une saison à la fois — relancer l'outil remplace
celle qui s'y trouve (pour en garder deux de front, il faudra aussi un choix de saison côté coach).

Pourquoi un lecteur maison : un .xlsx est une archive ZIP de XML, et ni openpyxl ni pandas ne sont
installés sur le Mac d'Antoine. La bibliothèque standard suffit, et ça évite une dépendance de plus.

Structure attendue dans le classeur, une feuille par séance :
    ligne 0  : « Plan d'entrainement - <phase> »      (phase : Présaison - Semaine 2, Saison - Semaine 14 - Match J-4 …)
    ligne 1  : « THEME: VOLUME »                       (Modéré, Intense, Vitesse, Volume)
    ligne 2  : « Date | <date> | … | Début | 18h30 »
    puis des blocs « Activité N » :
        colonne 0 « Durée » → durée du bloc en colonne 1
        colonne 2 : le titre du bloc en MAJUSCULES, puis ses lignes de détail
        colonne 3 : répétitions (« x3 »), colonnes 4 et 6 : durées de la ligne, colonne 8 : notes
La première feuille (CALENDRIER) n'est pas une séance : elle est ignorée.
"""
import json, re, sys, unicodedata, xml.etree.ElementTree as ET, zipfile
from pathlib import Path

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
RNS = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
PKG = "{http://schemas.openxmlformats.org/package/2006/relationships}"
MOIS = {"janvier": 1, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
        "juillet": 7, "aout": 8, "septembre": 9, "octobre": 10, "novembre": 11, "decembre": 12}
THEMES = {"MODERE": "modere", "MODEREE": "modere", "MODERE++": "modere", "INTENSE": "intense",
          "INTENSITE": "intense", "VITESSE": "vitesse", "VOLUME": "volume", "VOLUME --": "volume"}


# Noms de personnes ecrits dans le classeur : ils ne sont JAMAIS importes. Le depot et le site publie sont
# publics, et ces joueurs n'ont rien signe : dans un club, un prenom suffit a identifier quelqu'un. La note
# garde son sens (« 80m pour certains joueurs »), le nom part ; l'information nominative reste dans le
# classeur d'Antoine, qui est sa reference.
#
# La liste des noms ne vit PAS dans ce depot (ce serait publier ce qu'on cherche a retirer) : un fichier
# texte, un nom par ligne, a cote du classeur -- « personnes.txt » dans le meme dossier, ou le chemin passe
# en 5e argument. S'il manque, l'outil le dit et importe tel quel. Pour le completer : l'outil affiche a
# chaque passage les mots rares du classeur, et un prenom oublie s'y voit.
PERSONNES = []


def charger_personnes(xlsx, arg=None):
    f = Path(arg) if arg else Path(xlsx).parent / "personnes.txt"
    if not f.exists():
        return [], f
    noms = [l.strip() for l in f.read_text(encoding="utf-8").splitlines() if l.strip() and not l.startswith("#")]
    return noms, f


def sans_noms(txt):
    """« 80m pour » + une suite de prenoms → « 80m pour certains joueurs ». Renvoie (texte, nb de noms retires).

    Aucun nom n'est ecrit ici : ce fichier est dans un depot public (c'est tout le point de la fonction)."""
    if not txt or not PERSONNES:
        return txt, 0
    p = r"\b(?:" + "|".join(re.escape(x) for x in PERSONNES) + r")\b"
    n = [0]

    def rep(m):
        k = len(re.findall(p, m.group(0), re.I))
        n[0] += k
        return "certains joueurs" if k > 1 else "un joueur"

    return re.sub(p + r"(?:\s*(?:,|et)\s*" + p + r")*", rep, txt, flags=re.I), n[0]


def sans_accent(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn")


def col_row(ref):
    m = re.match(r"([A-Z]+)(\d+)", ref or "")
    if not m:
        return 0, 0
    c = 0
    for ch in m.group(1):
        c = c * 26 + (ord(ch) - 64)
    return c - 1, int(m.group(2)) - 1


class Classeur:
    def __init__(self, path):
        self.z = zipfile.ZipFile(path)
        self.shared = []
        if "xl/sharedStrings.xml" in self.z.namelist():
            for si in ET.fromstring(self.z.read("xl/sharedStrings.xml")).findall(f"{NS}si"):
                self.shared.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
        rels = {r.get("Id"): r.get("Target") for r in
                ET.fromstring(self.z.read("xl/_rels/workbook.xml.rels")).findall(f"{PKG}Relationship")}
        self.feuilles = [(sh.get("name"), "xl/" + rels.get(sh.get(f"{RNS}id"), "").lstrip("/"))
                         for sh in ET.fromstring(self.z.read("xl/workbook.xml")).findall(f".//{NS}sheet")]

    def grille(self, part):
        cells = {}
        for c in ET.fromstring(self.z.read(part)).iter(f"{NS}c"):
            x, y = col_row(c.get("r"))
            t, v, isx = c.get("t"), c.find(f"{NS}v"), c.find(f"{NS}is")
            if t == "s" and v is not None and v.text is not None:
                s = self.shared[int(v.text)]
            elif t == "inlineStr" and isx is not None:
                s = "".join(tt.text or "" for tt in isx.iter(f"{NS}t"))
            else:
                s = (v.text or "") if v is not None else ""
            s = re.sub(r"\s+", " ", (s or "")).strip()
            if s:
                cells[(y, x)] = s
        if not cells:
            return []
        h, w = max(k[0] for k in cells) + 1, max(k[1] for k in cells) + 1
        return [[cells.get((r, c), "") for c in range(w)] for r in range(h)]


def date_iso(titre):
    """« Jeudi 03 Juillet 2025 » → « 2025-07-03 ». None si la feuille n'est pas une séance datée."""
    m = re.search(r"(\d{1,2})\s+([A-Za-zÀ-ÿ]+)\s+(\d{4})", titre or "")
    if not m:
        return None
    mois = MOIS.get(sans_accent(m.group(2)).lower())
    return f"{int(m.group(3)):04d}-{mois:02d}-{int(m.group(1)):02d}" if mois else None


STATS = {"noms": 0}


def _anon(txt):
    t, n = sans_noms(txt)
    STATS["noms"] += n
    return t


def minutes(txt):
    m = re.search(r"(\d+)", txt or "")
    return int(m.group(1)) if m else 0


def lire_seance(nom, g):
    cell = lambda r, c: (g[r][c] if r < len(g) and c < len(g[r]) else "")
    phase = _anon(re.sub(r"^Plan d'entra[îi]nement\s*-\s*", "", cell(0, 0)).strip())
    theme, debut = "", ""
    for r in range(min(6, len(g))):
        for c, v in enumerate(g[r]):
            mt = re.search(r"TH[EÈ]ME\s*:?\s*(.+)", v, re.I)
            if mt:
                theme = mt.group(1).strip()
            if v.strip().lower().startswith("début"):
                debut = next((x for x in g[r][c + 1:c + 4] if re.search(r"\d", x)), "")
    acts, cur = [], None
    for r in g:
        a = (r[0] if r else "").strip()
        if re.match(r"^Activit[ée]\s*\d+", a, re.I):
            cur = {"n": "", "min": 0, "l": []}
            acts.append(cur)
        if cur is None:
            continue
        if re.match(r"^dur[ée]e?\s*:?$", a, re.I) and len(r) > 1:
            cur["min"] = minutes(r[1])
        d = (r[2] if len(r) > 2 else "").strip()
        if not d or d.upper() == "DESCRIPTION":
            continue
        # le titre du bloc est sa PREMIÈRE ligne, quelle que soit sa casse : « ECHAUFFEMENT » est en
        # majuscules mais « Fitness Game » ne l'est pas, et les deux sont des titres de bloc
        if not cur["n"]:
            cur["n"] = _anon(d)
            continue
        # détail : description, répétitions, durée, note — les noms de personnes ne passent pas (voir PERSONNES)
        rep = _anon((r[3] if len(r) > 3 else "").strip())
        dur = _anon(next((x for x in ((r[i] if len(r) > i else "") for i in (6, 4, 5)) if re.search(r"\d", x)), ""))
        note = _anon((r[8] if len(r) > 8 else "").strip())
        ligne = {"d": _anon(d)}
        if rep and rep.upper() != "DESCRIPTION":
            ligne["x"] = rep
        if dur:
            ligne["t"] = dur
        if note and note.upper() != "NOTES":
            ligne["note"] = note[:300]
        cur["l"].append(ligne)
    acts = [a for a in acts if a["n"] or a["l"]]
    for a in acts:
        if not a["n"]:
            a["n"] = "Activité"
    return {"n": nom.strip(), "phase": phase, "theme": THEMES.get(sans_accent(theme).upper().strip(), ""),
            "themeTxt": theme, "debut": debut, "min": sum(a["min"] for a in acts), "acts": acts}


def main(xlsx, eid, nom_club, sport, noms=None):
    global PERSONNES
    PERSONNES, f_noms = charger_personnes(xlsx, noms)
    cl = Classeur(xlsx)
    seances, vides = [], []
    for nom, part in cl.feuilles:
        d = date_iso(nom)
        if not d:
            continue  # CALENDRIER et autres feuilles non datées
        s = lire_seance(nom, cl.grille(part))
        s["d"] = d
        if not s["acts"]:
            # onglet créé puis laissé vide dans le classeur : on ne l'importe pas, une séance sans
            # contenu n'est que du bruit dans l'application. Signalé pour qu'Antoine le sache.
            vides.append(nom)
            continue
        seances.append(s)
    if not seances:
        # mauvais fichier, ou feuilles nommées autrement : le dire clairement plutôt que planter
        sys.exit(f"Aucune séance datée trouvée dans {xlsx}.\nUne feuille par séance, nommée comme « Jeudi 03 Juillet 2025 ». "
                 f"Feuilles vues : {', '.join(n for n, _ in cl.feuilles) or 'aucune'}")
    seances.sort(key=lambda s: s["d"])
    saison = {"id": eid, "n": nom_club, "sport": sport,
              "du": seances[0]["d"], "au": seances[-1]["d"], "seances": seances}
    out = Path("content_equipe.py")
    corps = json.dumps([saison], ensure_ascii=False, indent=1)
    out.write_text(
        "# -*- coding: utf-8 -*-\n"
        '"""Saisons d\'équipe — FICHIER GÉNÉRÉ, ne pas modifier à la main.\n\n'
        "Produit par tools/saison_equipe.py à partir du classeur Excel de la saison.\n"
        "Relancer l'outil réécrit tout ce fichier avec la saison fournie : il n'en garde qu'une à la fois.\n"
        'Une séance : d (date), n (nom de la feuille), phase, theme, debut, min, acts[{n, min, l[{d, x, t, note}]}].\n"""\n'
        "EQUIPES = " + corps + "\n\nEQUIPE_CONTENT = {\"EQUIPES\": EQUIPES}\n",
        encoding="utf-8")
    print(f"{len(seances)} séances écrites dans {out} ({out.stat().st_size // 1024} Ko)")
    if vides:
        print(f"{len(vides)} onglet(s) vide(s) ignoré(s) :", ", ".join(vides))
    print("thèmes :", {t: sum(1 for s in seances if s['theme'] == t) for t in ("modere", "intense", "vitesse", "volume", "")})
    if PERSONNES:
        print(f"noms de personnes retirés : {STATS['noms']} occurrence(s), d'après {f_noms}")
    else:
        print(f"ATTENTION : aucun fichier de noms ({f_noms}). Le dépôt et le site sont PUBLICS : relis les mots rares\n"
              f"            ci-dessous et crée ce fichier (un nom par ligne) si l'un d'eux est un prénom de joueur.")
    # vigilance : le dépôt et le site sont publics. Les mots rares sont les candidats « prénom oublié » ;
    # les mots fréquents sont du vocabulaire d'entraînement. À relire à chaque nouvelle saison.
    compte = {}
    for s in seances:
        for t in [s["phase"]] + [a["n"] for a in s["acts"]] + [str(l.get(k, "")) for a in s["acts"] for l in a["l"] for k in ("d", "note")]:
            for mot in re.findall(r"\b[A-ZÉÈÀÂÎÔÛ][a-zéèàâîôûïçö'’-]{1,}\b", t):
                compte[mot] = compte.get(mot, 0) + 1
    rares = sorted(m for m, n in compte.items() if n <= 4)
    print(f"mots rares à relire (un prénom oublié ?) : {', '.join(rares) if rares else 'aucun'}")


if __name__ == "__main__":
    if len(sys.argv) < 5:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5] if len(sys.argv) > 5 else None)
