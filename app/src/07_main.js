/* ===== Démarrage ===== */
function App() {
  const [boot, setBoot] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const c = window.claude;
      const use = async (n) => { try { return c && typeof c.use === "function" ? await c.use(n) : null; } catch (e) { return null; } };
      const [db, user, dl] = await Promise.all([use("db"), use("user"), use("downloads")]);
      let isOwner = false, uid = null;
      try { isOwner = user ? await user.isOwner() : false; } catch (e) {}
      try { uid = user ? await user.id() : null; } catch (e) {}
      if (alive) setBoot({ db, user, dl, isOwner, uid });
    })();
    return () => { alive = false; };
  }, []);
  if (!boot) return html`<${Splash} text="Ouverture de ton espace…" />`;
  return html`<${Shared} boot=${boot} />`;
}
function Shared({ boot }) {
  const lib = useCol(boot.db, "library");
  const ex = useCol(boot.db, "exercises");
  const settings = useDocData(boot.db, "settings/app");
  const libItems = useMemo(() => Object.fromEntries(Object.entries(lib.items).map(([id, d]) => [id, { ...d, id }])), [lib.items]);
  if (boot.isOwner) return html`<${CoachApp} db=${boot.db} settings=${settings.data} lib=${libItems} exo=${ex.items} dl=${boot.dl} />`;
  return html`<${ClientRoot} db=${boot.db} uid=${boot.uid} settings=${settings.data} lib=${libItems} exo=${ex.items} />`;
}
class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error(err); }
  render() {
    if (this.state.err) return html`<div className="splash"><${Logo} size=${56} /><p>Un problème d'affichage est survenu.</p><${Btn} onClick=${() => this.setState({ err: null })}>Réessayer</${Btn}></div>`;
    return this.props.children;
  }
}
const Root = window.IS_SITE && typeof SiteRoot === "function" ? SiteRoot : App;
/* langue autre que le français : on attend le dictionnaire (quelques centaines de millisecondes au plus) avant d'afficher */
I18N_READY.finally(() => {
  i18nStart();
  ReactDOM.createRoot(document.getElementById("root")).render(html`<${Boundary}><${ToastHost}><${DbWatch} /><${Root} /></${ToastHost}></${Boundary}>`);
});
