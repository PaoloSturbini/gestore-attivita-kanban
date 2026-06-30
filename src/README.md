# Sorgenti app.js

`app.js` (nella radice del progetto) è **generato**: non va modificato a mano.
Modifica i moduli qui sotto e rigenera con `macos/bundle_app_js.sh`
(la build `macos/build_app.sh` lo fa già in automatico).

I file vengono concatenati in ordine numerico in un unico `app.js` classico,
perché la WebView carica via `file://` e non può usare `<script type="module">`
(bloccato dalla CORS). Lo scope globale resta condiviso, come nel file originale.

| File | Contenuto |
|------|-----------|
| `01_core.js` | Costanti, `initialData`, variabili di stato, `els`, avvio (`render()`/`bindEvents()`) |
| `02_state.js` | Modello dati: task, workspace, load/save/normalize stato |
| `03_shell.js` | `bindEvents`, render della shell, tab, sidebar, tema, partecipanti |
| `04_views.js` | `renderContent`, panoramiche, scadenze, board, stati, colonne |
| `05_dragdrop.js` | Drag & drop (puntatore e tastiera) delle card |
| `06_tables.js` | Viste tabella/griglia, ordinamento, `taskCard` |
| `07_dialogs.js` | Dialog attività, CRUD progetti, export Markdown |
| `08_xlsx.js` | Lettura/scrittura XLSX e ZIP, helper Excel |
| `09_backup.js` | Backup/restore, import e normalizzazione dati |
| `10_utils.js` | Ricerca, helper date/ordinamento, escaping |
