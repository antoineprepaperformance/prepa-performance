# -*- coding: utf-8 -*-
"""Traductions ajoutees a la main pour l'offre club (17 novembre 2026), quand Node n'est pas disponible.
Meme mecanisme que i18n_main.py : voir ce fichier pour le detail. A lancer depuis app/ :
python3 tools/i18n_club.py

Les textes francais ci-dessous ont ete releves sur les ecrans construits (section club de la page d'accueil,
formulaire de demande de devis, article 2 bis des conditions de vente, politique de confidentialite), pas
recopies a la main : une phrase coupee par une interpolation donne une clef differente de ce qu'on croit.
Les textes juridiques sont traduits en entier : une condition de vente a moitie traduite ne vaut rien.
"""
import hashlib, json, pathlib, re

T = [
 # ---- page d'accueil : la section « Pour les clubs » ----
 ("Pour les clubs", "For clubs", "Para los clubes"),
 ("La programmation physique de ton équipe dans l'application : chaque séance avec son thème, ses activités et ses durées, déroulable au minuteur sur le terrain, avec la bibliothèque d'exercices, les fiches terrain et les tests.",
  "Your team's physical programming in the app: every session with its theme, its activities and their durations, ready to run with the timer on the field, together with the exercise library, the field-session sheets and the tests.",
  "La programación física de tu equipo en la aplicación: cada sesión con su temática, sus actividades y sus duraciones, lista para dirigir con el cronómetro en el campo, con la biblioteca de ejercicios, las fichas de campo y los test."),
 ("Le plus pris", "Most chosen", "La más elegida"),
 ("La saison", "The season", "La temporada"),
 ("Toute la programmation de la saison, découpée en cycles de 6 semaines : l'entraîneur ouvre la séance du jour et la déroule au minuteur.",
  "The whole season's programming, cut into 6-week cycles: the coach opens the day's session and runs it with the timer.",
  "Toda la programación de la temporada, dividida en ciclos de 6 semanas: el entrenador abre la sesión del día y la dirige con el cronómetro."),
 ("la saison, par équipe", "the season, per team", "la temporada, por equipo"),
 ("Un cycle", "One cycle", "Un ciclo"),
 ("Un bloc de 6 semaines pour essayer sur une période précise : reprise, trêve, fin de saison.",
  "A 6-week block to try it over one precise period: pre-season, winter break, end of season.",
  "Un bloque de 6 semanas para probarlo en un periodo concreto: pretemporada, parón, final de temporada."),
 ("le cycle, par équipe", "the cycle, per team", "el ciclo, por equipo"),
 ("Accès joueurs", "Player access", "Acceso jugadores"),
 ("Chaque joueur voit la séance d'équipe du jour et suit son programme individuel, avec ses tests et sa carte athlète.",
  "Every player sees the day's team session and follows their own individual programme, with their tests and their athlete card.",
  "Cada jugador ve la sesión de equipo del día y sigue su programa individual, con sus test y su carta de atleta."),
 ("par joueur, la saison", "per player, the season", "por jugador, la temporada"),
 ("À partir de 15 joueurs, en plus de la saison ou d'un cycle.",
  "From 15 players, in addition to the season or a cycle.",
  "Desde 15 jugadores, además de la temporada o de un ciclo."),
 ("La saison découpée en cycles : chaque cycle a ses semaines et ses séances, prêtes à mener.",
  "The season cut into cycles: each cycle has its weeks and its sessions, ready to run.",
  "La temporada dividida en ciclos: cada ciclo tiene sus semanas y sus sesiones, listas para dirigir."),
 ("Chaque séance avec son thème (Modéré, Intense, Vitesse, Volume), ses activités et leurs durées.",
  "Every session with its theme (Moderate, Intense, Speed, Volume), its activities and their durations.",
  "Cada sesión con su temática (Moderado, Intenso, Velocidad, Volumen), sus actividades y sus duraciones."),
 ("Le minuteur qui enchaîne les activités de la séance, sur le terrain, au téléphone.",
  "The timer that runs through the session's activities, on the field, from a phone.",
  "El cronómetro que enlaza las actividades de la sesión, en el campo, desde el móvil."),
 ("La bibliothèque : exercices animés, fiches terrain par sport et par poste, tests de référence.",
  "The library: animated exercises, field-session sheets by sport and by position, benchmark tests.",
  "La biblioteca: ejercicios animados, fichas de campo por deporte y por puesto, test de referencia."),
 ("Avec l'accès joueurs : chaque joueur voit la séance d'équipe du jour et suit son programme individuel.",
  "With player access: every player sees the day's team session and follows their own individual programme.",
  "Con el acceso jugadores: cada jugador ve la sesión de equipo del día y sigue su programa individual."),
 ("Les accès sont ouverts par Antoine : un pour l'entraîneur, et un par joueur si tu prends l'accès joueurs.",
  "Accounts are opened by Antoine: one for the coach, and one per player if you take player access.",
  "Las cuentas las abre Antoine: una para el entrenador y una por jugador si contratas el acceso jugadores."),
 ("Le club reste responsable de l'encadrement de ses séances, de la santé de ses joueurs et du respect des consignes. L'offre club ne comprend pas de présence sur le terrain ni de suivi individuel des joueurs par Antoine : c'est l'accès joueurs et les formules individuelles qui ouvrent ce suivi.",
  "The club remains responsible for supervising its sessions, for its players' health and for compliance with instructions. The club offer includes neither on-field presence nor individual follow-up of players by Antoine: that follow-up comes with player access and the individual plans.",
  "El club sigue siendo responsable de la supervisión de sus sesiones, de la salud de sus jugadores y del cumplimiento de las consignas. La oferta club no incluye presencia en el campo ni seguimiento individual de los jugadores por parte de Antoine: ese seguimiento llega con el acceso jugadores y las fórmulas individuales."),
 ("Vente entre professionnels : devis, virement et facture, sans abonnement ni reconduction (article 2 bis des conditions de vente).",
  "Business-to-business sale: quotation, bank transfer and invoice, with no subscription and no automatic renewal (article 2 bis of the terms of sale).",
  "Venta entre profesionales: presupuesto, transferencia y factura, sin suscripción ni renovación automática (artículo 2 bis de las condiciones de venta)."),
 # ---- la demande de devis ----
 ("Demander un devis", "Request a quotation", "Pedir un presupuesto"),
 ("Offre club : demander un devis", "Club offer: request a quotation", "Oferta club: pedir un presupuesto"),
 ("Dis-moi l'essentiel : je réponds avec un devis et, si tu veux, un cycle d'exemple à regarder avant de décider.",
  "Tell me the essentials: I reply with a quotation and, if you like, a sample cycle to look at before you decide.",
  "Cuéntame lo esencial: respondo con un presupuesto y, si quieres, un ciclo de ejemplo para verlo antes de decidir."),
 ("Nom du club", "Club name", "Nombre del club"),
 ("Sport et niveau", "Sport and level", "Deporte y nivel"),
 ("Nombre de joueurs", "Number of players", "Número de jugadores"),
 ("Ce qui t'intéresse", "What you are interested in", "Lo que te interesa"),
 ("La saison complète", "The full season", "La temporada completa"),
 ("Un cycle pour essayer", "One cycle to try it", "Un ciclo para probar"),
 ("Saison + accès joueurs", "Season + player access", "Temporada + acceso jugadores"),
 ("Ton nom", "Your name", "Tu nombre"),
 ("Ton e-mail", "Your email", "Tu correo electrónico"),
 ("Téléphone (facultatif)", "Phone (optional)", "Teléfono (opcional)"),
 ("Ta situation, en deux lignes (facultatif)", "Your situation, in two lines (optional)", "Tu situación, en dos líneas (opcional)"),
 ("Effectif, jours d'entraînement, ce que tu cherches à améliorer.",
  "Squad size, training days, what you are looking to improve.",
  "Plantilla, días de entrenamiento, lo que buscas mejorar."),
 ("Ce que je reçois : ce que tu écris ici, rien de plus. Aucune donnée de joueur. Supprimé 3 ans après le dernier contact, ou tout de suite si tu le demandes.",
  "What I receive: what you write here, nothing more. No player data. Deleted 3 years after the last contact, or straight away if you ask.",
  "Lo que recibo: lo que escribes aquí, nada más. Ningún dato de jugador. Se borra 3 años después del último contacto, o de inmediato si lo pides."),
 # ---- conditions de vente, article 2 bis ----
 ("2 bis. Offre club", "2 bis. Club offer", "2 bis. Oferta club"),
 ("L'offre club est vendue à un club (association ou société) pour ses propres équipes, et non à un particulier. Elle donne accès dans l'application à la programmation physique d'une saison d'équipe — chaque séance avec son thème, ses activités et leurs durées, le minuteur de séance, la bibliothèque d'exercices, les fiches terrain et les tests — pour la saison complète ou pour un ou plusieurs cycles de 6 semaines. L'accès joueurs, s'il est pris, ouvre à chaque joueur désigné par le club un compte qui affiche la séance d'équipe du jour et son programme individuel.",
  "The club offer is sold to a club (association or company) for its own teams, and not to an individual. It gives access in the app to the physical programming of a team season — every session with its theme, its activities and their durations, the session timer, the exercise library, the field-session sheets and the tests — for the full season or for one or more cycles of 6 weeks. Player access, if taken, opens for each player named by the club an account showing the day's team session and that player's individual programme.",
  "La oferta club se vende a un club (asociación o sociedad) para sus propios equipos, y no a un particular. Da acceso en la aplicación a la programación física de una temporada de equipo —cada sesión con su temática, sus actividades y sus duraciones, el cronómetro de sesión, la biblioteca de ejercicios, las fichas de campo y los test— para la temporada completa o para uno o varios ciclos de 6 semanas. El acceso jugadores, si se contrata, abre a cada jugador designado por el club una cuenta que muestra la sesión de equipo del día y su programa individual."),
 ("Ce que le club garde à sa charge.", "What the club remains responsible for.", "Lo que queda a cargo del club."),
 ("Le club encadre lui-même ses séances : il reste responsable de l'encadrement, de la santé de ses joueurs, des certificats médicaux et du respect des consignes. L'offre club ne comprend ni présence sur le terrain ni suivi individuel des joueurs par le vendeur ; ce suivi passe par l'accès joueurs et les formules individuelles.",
  "The club runs its own sessions: it remains responsible for supervision, for its players' health, for medical certificates and for compliance with instructions. The club offer includes neither on-field presence nor individual follow-up of players by the seller; that follow-up goes through player access and the individual plans.",
  "El club dirige sus propias sesiones: sigue siendo responsable de la supervisión, de la salud de sus jugadores, de los certificados médicos y del cumplimiento de las consignas. La oferta club no incluye presencia en el campo ni seguimiento individual de los jugadores por parte del vendedor; ese seguimiento pasa por el acceso jugadores y las fórmulas individuales."),
 ("Droit d'usage.", "Right of use.", "Derecho de uso."),
 ("La programmation est fournie pour les équipes du club et pour la durée achetée. Elle ne peut être ni revendue, ni diffusée hors du club, ni réutilisée par un autre club ou dans une offre concurrente (article 12).",
  "The programming is supplied for the club's teams and for the period purchased. It may not be resold, distributed outside the club, or reused by another club or in a competing offer (article 12).",
  "La programación se suministra para los equipos del club y durante el periodo adquirido. No puede revenderse, difundirse fuera del club ni reutilizarse por otro club o en una oferta competidora (artículo 12)."),
 ("Vente entre professionnels.", "Business-to-business sale.", "Venta entre profesionales."),
 ("Le club contracte pour son activité : le droit de rétractation de 14 jours de l'article 8, réservé aux consommateurs, ne s'applique pas. Le devis accepté et la facture tiennent lieu de contrat. Sauf accord écrit différent, le paiement se fait par virement à 30 jours à compter de la facture. En cas de retard, sont dues de plein droit des pénalités au taux de refinancement de la Banque centrale européenne majoré de 10 points et l'indemnité forfaitaire de 40 € pour frais de recouvrement (articles L441-10 et D441-5 du code de commerce).",
  "The club contracts for its own activity: the 14-day right of withdrawal in article 8, which is reserved to consumers, does not apply. The accepted quotation and the invoice stand as the contract. Unless otherwise agreed in writing, payment is made by bank transfer within 30 days of the invoice. In the event of late payment, late-payment interest at the European Central Bank refinancing rate plus 10 percentage points and the fixed €40 recovery indemnity are due as of right (articles L441-10 and D441-5 of the French commercial code).",
  "El club contrata para su actividad: el derecho de desistimiento de 14 días del artículo 8, reservado a los consumidores, no se aplica. El presupuesto aceptado y la factura hacen de contrato. Salvo acuerdo escrito distinto, el pago se realiza por transferencia a 30 días desde la factura. En caso de retraso, se deben de pleno derecho intereses de demora al tipo de refinanciación del Banco Central Europeo incrementado en 10 puntos y la indemnización fija de 40 € por gastos de cobro (artículos L441-10 y D441-5 del código de comercio francés)."),
 ("Offre club (article 2 bis) : 590 € la saison complète, 149 € le cycle de 6 semaines, 25 € par joueur et par saison pour l'accès joueurs (à partir de 15 joueurs), sur devis et sans abonnement.",
  "Club offer (article 2 bis): €590 for the full season, €149 for the 6-week cycle, €25 per player per season for player access (from 15 players), by quotation and without subscription.",
  "Oferta club (artículo 2 bis): 590 € la temporada completa, 149 € el ciclo de 6 semanas, 25 € por jugador y temporada para el acceso jugadores (desde 15 jugadores), con presupuesto y sin suscripción."),
 # ---- politique de confidentialite ----
 ("Demande de devis d'un club", "Quotation request from a club", "Solicitud de presupuesto de un club"),
 ("Quand un club remplit le formulaire de l'offre club sur le site, le vendeur reçoit ce que le club a écrit : nom du club, sport, nombre de joueurs, nom et coordonnées de la personne à contacter, et son message. Ces données servent uniquement à répondre à la demande et à établir un devis (base : mesures précontractuelles et intérêt légitime à répondre à une sollicitation). Elles ne concernent pas les joueurs, ne sont pas croisées avec les dossiers des clients, et sont supprimées 3 ans après le dernier contact — tout de suite sur simple demande (voir « Tes droits »). Aucune prospection automatisée n'est faite à partir de ce formulaire.",
  "When a club fills in the club-offer form on the site, the seller receives what the club wrote: club name, sport, number of players, name and contact details of the person to contact, and their message. This data is used only to answer the request and draw up a quotation (basis: pre-contractual steps and the legitimate interest in replying to an approach). It does not concern the players, is not cross-referenced with clients' records, and is deleted 3 years after the last contact — straight away on request (see « Your rights »). No automated prospecting is carried out from this form.",
  "Cuando un club rellena el formulario de la oferta club en el sitio, el vendedor recibe lo que el club ha escrito: nombre del club, deporte, número de jugadores, nombre y datos de contacto de la persona a contactar, y su mensaje. Estos datos sirven únicamente para responder a la solicitud y elaborar un presupuesto (base: medidas precontractuales e interés legítimo en responder a una solicitud). No se refieren a los jugadores, no se cruzan con los expedientes de los clientes y se borran 3 años después del último contacto, o de inmediato si se solicita (véase « Tus derechos »). No se realiza ninguna prospección automatizada a partir de este formulario."),
]


def norm(s):
    s = re.sub(r"[  ]", " ", str(s))
    return re.sub(r"\s+", " ", s).strip()


def h(k): return hashlib.sha1(k.encode("utf-8")).hexdigest()[:10]


I18N = pathlib.Path("i18n")
textes = json.loads((I18N / "_textes.json").read_text(encoding="utf-8"))
en = json.loads((I18N / "en.json").read_text(encoding="utf-8"))
es = json.loads((I18N / "es.json").read_text(encoding="utf-8"))
known = {e["k"]: e for e in textes}
add_t, upd, nb = 0, 0, 0
for k_raw, t_en, t_es in T:
    k = norm(k_raw)
    hh = h(k)
    # autant de nombres dans la traduction que dans le français, sinon le dictionnaire ne saura pas
    # rejouer la phrase avec d'autres nombres (un prix qui change, un cycle de 5 semaines au lieu de 6)
    nf, ne, ns = (len(re.findall(r"\d+", x)) for x in (k, t_en, t_es))
    if nf != ne or nf != ns:
        print(f"ATTENTION nombres ({nf} fr, {ne} en, {ns} es) : {k[:70]}")
        nb += 1
    if k not in known:
        textes.append({"h": hh, "k": k, "kind": "literal", "where": "src/i18n-club", "n": 1}); add_t += 1
    else:
        hh = known[k]["h"]
    if en.get(hh) != t_en or es.get(hh) != t_es: upd += 1
    en[hh] = t_en; es[hh] = t_es

(I18N / "_textes.json").write_text(json.dumps(textes, ensure_ascii=False, indent=1), encoding="utf-8")
for f, d in (("en.json", en), ("es.json", es)):
    (I18N / f).write_text(json.dumps(d, ensure_ascii=False, sort_keys=True, indent=0), encoding="utf-8")
print(f"{len(T)} textes traites | {add_t} ajoutes a _textes.json | {upd} traductions ecrites" + (f" | {nb} a revoir" if nb else ""))
