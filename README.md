# Gestore attività Kanban

App locale per macOS, iPhone e iPad per gestire attività Kanban, allegati, scadenze, archivio, promemoria Apple e sincronizzazione remota CouchDB. Il repository include anche il setup server per CouchDB e un portale web gateway per i responsabili.

## Contenuto della distribuzione

- `src/`: sorgenti modulari dell'app web caricata dalla WebView macOS.
- `assets/`: HTML, CSS, dati sample, PouchDB e bundle web generato.
- `macos/`: wrapper Swift/WebKit, icone, `Info.plist` e script di build.
- `ios/`: progetto Xcode SwiftUI/WebKit per iPhone e iPad.
- `deploy/couchdb/`: stack e script idempotente per preparare CouchDB.
- `deploy/portal/`: portale web per responsabili, eseguito server-side con Node.
- `tests/`: controlli strutturali e regressioni principali.

## Requisiti

Per compilare l'app macOS:

- macOS
- Xcode Command Line Tools o Xcode completo
- Node.js 24 o superiore
- Python 3

Per compilare l'app iOS serve Xcode completo. Il target minimo è iOS 17.

Per il server:

- Docker Compose per CouchDB, se si usa lo stack incluso
- Node.js 24 o superiore per il portale
- Un reverse proxy o Cosmos Cloud per esporre HTTPS

## Avvio rapido locale

```bash
git clone https://github.com/PaoloSturbini/gestore-attivita-kanban.git
cd gestore-attivita-kanban
npm run check
npm test
npm run bundle
KANBAN_INSTALL_APP=0 npm run build:mac
open "dist/Gestore attività Kanban.app"
```

Per installare o aggiornare anche `/Applications/Gestore attività Kanban.app`:

```bash
npm run build:mac
open "/Applications/Gestore attività Kanban.app"
```

`macos/build_app.sh` rigenera il bundle JavaScript, compila il wrapper Swift, firma ad hoc l'app e aggiorna `dist/`. Se `KANBAN_INSTALL_APP` non e impostato a `0`, aggiorna anche `/Applications`.

### iPhone e iPad

Per verificare la build del simulatore:

```bash
npm run build:ios
```

Per eseguirla su un dispositivo reale, apri `ios/GestoreKanbanIOS.xcodeproj` in Xcode, seleziona il tuo Team nella sezione Signing & Capabilities, collega iPhone o iPad e premi Run. La versione iOS conserva stato e credenziali localmente, supporta la replica CouchDB, Promemoria, import/export Excel e condivisione dei backup JSON. La gestione diretta degli allegati su cartelle macOS e i backup ZIP con allegati restano funzioni desktop.

## Sviluppo app

Modifica i file in `src/*.js`. Non modificare a mano `assets/app.bundle.js`.

```bash
npm run check
npm test
npm run bundle
```

La WebView macOS carica file locali via `file://`, quindi i moduli in `src/` vengono concatenati in `assets/app.bundle.js` invece di usare `<script type="module">`.

## Configurazione CouchDB

La produzione usa esclusivamente X1 Pro. Le credenziali restano nei file `.env` sul server e il rilascio avviene soltanto tramite GitHub Actions dopo il merge su `main`.

```bash
git switch -c nome-del-branch
# modifica, test, push e Pull Request verso main
# il merge attiva il runner x1pro-kanban
```

Lo script `init-kanban-db.sh` crea o aggiorna database, utente applicativo, permessi e viste necessarie al portale:

- `tasks_by_owner`
- `tasks_by_group`
- `tasks_by_visible_to`

Non committare mai `.env`: contiene credenziali amministrative e password applicative.

Se usi Docker Compose e una password contiene `$`, scrivila come `$$` nel file `.env`.

## Portale responsabili

Il portale e un web gateway server-side: i responsabili non ricevono credenziali CouchDB nel browser. Il server parla con CouchDB e applica i permessi in base a `owner`, `visibleTo`, `Team` e agli utenti creati dall'admin.

Configurazione persistente su X1 Pro:

```bash
cd /srv/repos/gestore-attivita-kanban/deploy/portal
cp .env.example .env
cp users.example.json users.json
nano .env
nano users.json
chmod +x start.sh
./start.sh
```

Con Docker:

```bash
docker compose up -d
```

Esempio route HTTPS in Cosmos Cloud:

```text
URL: staff360.pst.my
Target host: 127.0.0.1
Target port: 8787
SSL: true
SSL redirect: true
```

Il portale richiede `SESSION_SECRET` di almeno 24 caratteri e un utente admin bootstrap in `users.json`. Dopo il primo accesso, gli utenti responsabili si creano dal pannello admin e vengono salvati in CouchDB con password hash `scrypt`.

## Flusso di rilascio

1. Lavora su un branch e apri una Pull Request verso `main`.
2. Attendi i controlli per web, portale e applicazioni Apple.
3. Il merge attiva esclusivamente `x1pro-kanban`.
4. Il workflow preserva `.env` e `users.json`, aggiorna `/srv/repos/gestore-attivita-kanban`, avvia CouchDB e portale e verifica entrambe le sonde locali.

## Verifiche

```bash
npm run check
npm test
npm run bundle
KANBAN_INSTALL_APP=0 npm run build:mac
codesign --verify --deep --strict "dist/Gestore attività Kanban.app"
```

La CI GitHub esegue gli stessi controlli principali su `macos-latest`.
