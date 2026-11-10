/* ===== Article de la semaine (content_articles.py) : bloc personnalisable de la page du jour =====
   Un article par semaine ; le plus récent déjà commencé s'affiche, pour ne jamais rester sans article
   tant que le suivant n'a pas été ajouté. */
const ARTICLES = CONTENT.ARTICLES || [];
function articleOfWeek(today) {
  const t = today || todayISO();
  const list = ARTICLES.filter((a) => a.semaine <= t).sort((a, b) => String(b.semaine).localeCompare(String(a.semaine)));
  return list[0] || null;
}
function ArticleCard() {
  const a = useMemo(() => articleOfWeek(), []);
  if (!a) return null;
  /* data-notr : le titre et le texte de l'article sont du contenu rédigé (comme un billet de blog), pas de
     l'interface. Ils ne sont jamais traduits automatiquement, par nature — c'était déjà le cas en pratique,
     c'est maintenant écrit dans le balisage, pour que la vérification des langues ne le signale plus comme
     un oubli et reste utile (un test qui échoue toujours s'apprend à ignorer). */
  return html`<${Card} title="Article de la semaine" sub=${html`<span data-notr="1" lang="fr">${a.titre}</span>`}>
    <p className="small" data-notr="1" lang="fr" style=${{ whiteSpace: "pre-line" }}>${a.texte}</p>
    ${a.refs && a.refs.length ? html`<details><summary>Source</summary><ul className="refs">${a.refs.map((r, i) => html`<li key=${i}>${r}</li>`)}</ul></details>` : null}
  </${Card}>`;
}
