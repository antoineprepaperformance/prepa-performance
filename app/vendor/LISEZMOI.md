# Bibliothèques (pour reconstruire et tester)

Le site publié contient déjà ses bibliothèques dans `docs/vendor/` et `docs/fonts/` : `build_site.py` les réutilise si ce dossier est vide.
Pour repartir de zéro (ou monter de version), depuis `app/vendor/` :

```bash
for p in react@18.3.1 react-dom@18.3.1 htm@3.1.1 firebase@12.19.0 @zxing/library@0.21.3 @fontsource/barlow@5.3.0 @fontsource/barlow-condensed@5.3.0; do npm pack "$p"; done
mkdir -p react-18.3.1 react-dom-18.3.1 htm-3.1.1 firebase-12.19.0 zxing-0.21.3 fs-barlow fs-barlow-condensed
tar xzf react-18.3.1.tgz -C react-18.3.1;          tar xzf react-dom-18.3.1.tgz -C react-dom-18.3.1
tar xzf htm-3.1.1.tgz -C htm-3.1.1;                tar xzf firebase-12.19.0.tgz -C firebase-12.19.0
tar xzf zxing-library-0.21.3.tgz -C zxing-0.21.3
tar xzf fontsource-barlow-5.3.0.tgz -C fs-barlow;  tar xzf fontsource-barlow-condensed-5.3.0.tgz -C fs-barlow-condensed
```
