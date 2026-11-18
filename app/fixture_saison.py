"""Classeur de saison FICTIF pour les tests de l'offre Club (e2e_equipe.py, e2e_club_site.py).

Le dépôt est public : on n'y met jamais le vrai classeur d'Antoine. Celui-ci a la même structure (une feuille
par séance nommée comme « Mardi 04 Novembre 2025 », phase, thème, horaire, blocs « Activité N »), avec des
séances inventées, un prénom inventé dans quelques notes de novembre (« Zébulon », pour tester le retrait des prénoms) et un
adversaire inventé (« Adversaire Imaginaire »).

Saison : du lundi 7 juillet 2025 au vendredi 26 juin 2026. Présaison (juillet-août) : lundi, mardi, jeudi.
Saison (à partir de septembre) : mardi (intense), jeudi (modéré), vendredi (vitesse, veille de veille du
match du dimanche)."""
import datetime, zipfile
from xml.sax.saxutils import escape

JOURS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"]
MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]
DEBUT = datetime.date(2025, 7, 7)
FIN = datetime.date(2026, 6, 26)


def nom_feuille(d):
    return f"{JOURS[d.weekday()]} {d.day:02d} {MOIS[d.month - 1]} {d.year}"


def seances():
    out, d = [], DEBUT
    while d <= FIN:
        sem = (d - DEBUT).days // 7 + 1
        pre = d < datetime.date(2025, 9, 1)
        jours = (0, 1, 3) if pre else (1, 3, 4)
        if d.weekday() in jours:
            if pre:
                theme = {0: "VOLUME", 1: "MODERE", 3: "VOLUME"}[d.weekday()]
                phase = f"Présaison - Semaine {sem}"
            else:
                theme = {1: "INTENSE", 3: "MODERE", 4: "VITESSE"}[d.weekday()]
                phase = f"Saison - Semaine {sem} - Match J-{sem - 8} Adversaire Imaginaire"
            out.append((d, phase, theme))
        d += datetime.timedelta(days=1)
    return out


def note(d):
    """Le prénom n'apparaît que les mardis de novembre 2025 (4 fois) : rare, comme un vrai prénom dans le classeur."""
    if d.year == 2025 and d.month == 11 and d.weekday() == 1:
        return "Distance de 80 m pour Zébulon, les autres 60 m"
    return "Distance de 60 m"


def grille(d, phase, theme):
    """Une séance, au format du classeur : (ligne, colonne) → texte."""
    g = {(0, 0): "Plan d'entrainement - " + phase, (1, 0): "THEME: " + theme,
         (2, 0): "Date", (2, 1): nom_feuille(d), (2, 5): "Début", (2, 6): "18h30",
         (3, 0): "Activité 1", (4, 0): "Durée", (4, 1): "15'", (4, 2): "ECHAUFFEMENT", (5, 2): "Jeu de passes", (5, 6): "15'",
         (6, 0): "Activité 2", (7, 0): "Durée", (7, 1): "30'", (7, 2): "Fitness Game",
         (8, 2): "Tempo", (8, 3): "x3", (8, 6): "3'", (8, 8): note(d),
         (9, 2): "Récup / Boisson", (9, 6): "2'",
         (10, 0): "Activité 3", (11, 0): "Durée", (11, 1): "15'", (11, 2): "Physique", (12, 2): "Gainage", (12, 3): "x4", (12, 6): "30''"}
    return g


def col(c):
    s = ""
    c += 1
    while c:
        c, r = divmod(c - 1, 26)
        s = chr(65 + r) + s
    return s


def feuille_xml(g):
    lignes = {}
    for (r, c), v in g.items():
        lignes.setdefault(r, []).append((c, v))
    rows = []
    for r in sorted(lignes):
        cells = "".join(f'<c r="{col(c)}{r + 1}" t="inlineStr"><is><t>{escape(v)}</t></is></c>' for c, v in sorted(lignes[r]))
        rows.append(f'<row r="{r + 1}">{cells}</row>')
    return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + "".join(rows) + "</sheetData></worksheet>")


def ecrire(path):
    ss = seances()
    feuilles = [("CALENDRIER", {(0, 0): "Calendrier de la saison"})] + [(nom_feuille(d), grille(d, p, t)) for d, p, t in ss]
    feuilles.append(("Vendredi 03 Juillet 2026", {(0, 0): "Plan d'entrainement - Présaison - Semaine 1"}))  # onglet daté laissé vide
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                   '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/></Types>')
        z.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                   '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        sheets = "".join(f'<sheet name="{escape(n)}" sheetId="{i + 1}" r:id="rId{i + 1}"/>' for i, (n, _) in enumerate(feuilles))
        z.writestr("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                   'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets + "</sheets></workbook>")
        rels = "".join(f'<Relationship Id="rId{i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i + 1}.xml"/>' for i in range(len(feuilles)))
        z.writestr("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + rels + "</Relationships>")
        for i, (_, g) in enumerate(feuilles):
            z.writestr(f"xl/worksheets/sheet{i + 1}.xml", feuille_xml(g))
    return len(ss)


if __name__ == "__main__":
    import sys
    print(ecrire(sys.argv[1] if len(sys.argv) > 1 else "saison_test.xlsx"), "séances")
