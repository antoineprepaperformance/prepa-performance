# -*- coding: utf-8 -*-
"""Article de la semaine : un texte court, une étude citée, affiché sur la page du jour (bloc personnalisable).
Un article par semaine (clé « semaine », lundi de la semaine visée) ; le plus récent dont la semaine est
déjà passée ou en cours s'affiche, pour ne jamais rester sans article tant qu'on n'a pas ajouté le suivant."""

ARTICLES = [
    {"id": "foot-muscu", "semaine": "2026-11-02",
     "titre": "Footballeur : la muscu ne va pas te rendre lourd",
     "texte": ("« La muscu, ça alourdit. » On l'entend encore dans beaucoup de vestiaires. En réalité, deux séances "
               "de force par semaine ne transforment pas un ailier en défenseur central : prendre du poids dépend "
               "surtout de l'alimentation.\n\n"
               "Ce que montre la science : dans une méta-analyse de 25 essais, le renforcement musculaire a divisé "
               "le risque de blessure par plus de trois.\n\n"
               "Un footballeur plus fort accélère, freine et change de direction mieux. Trois priorités en salle : "
               "les ischios, les adducteurs et la force des jambes. Le dosage dépend du poste et du moment de la "
               "saison."),
     "refs": ["Lauersen JB, Bertelsen DM, Andersen LB. The effectiveness of exercise intervention to prevent "
              "sports injuries: a systematic review and meta-analysis of randomised controlled trials. "
              "Br J Sports Med. 2014;48(11):871-877."]},
]
for _a in ARTICLES:
    assert _a.get("id") and _a.get("semaine") and _a.get("titre") and _a.get("texte") and _a.get("refs"), _a.get("id")
ARTICLES_CONTENT = {"ARTICLES": ARTICLES}
