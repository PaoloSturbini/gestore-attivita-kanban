# Revisione critica – robustezza e miglioramenti (giugno 2026)

Stato attuale della distribuzione: l'app non è più solo il wrapper macOS locale. Ora include
tre componenti che condividono lo stesso database:

- **App desktop** (Swift/WKWebView) con persistenza locale (file nativo + localStorage + PouchDB) e replica verso CouchDB.
- **CouchDB remoto** (`pstdb.pst.my` / `cdb.pst.my`) come hub di sincronizzazione.
- **Portale responsabili** (Node `deploy/portal/server.mjs`) che legge/scrive le stesse task via vista `tasks_by_owner`.

La complessità è cresciuta molto e la maggior parte dei rischi nasce proprio dai punti di
contatto fra questi tre livelli.

---

## 1. Sicurezza – da affrontare per primo

### 1.1 [CRITICO] Password dei responsabili in chiaro nello stesso DB che si replica sui desktop
I documenti `kanban-portal-user` contengono `password` in chiaro (scelta voluta, per mostrarle
all'admin). Ma vivono nello stesso database `gestore-attivita-kanban` che **ogni app desktop
replica integralmente** (`db.sync` senza filtri). Risultato: ogni Mac sincronizzato scarica in
locale (PouchDB + IndexedDB, non cifrato) le password in chiaro di tutti i responsabili.
- **Fix minimo:** rimuovere `password` in chiaro; tenere solo l'hash. Per il login usare un hash
  lento con salt (`scrypt`/`bcrypt`/`argon2`), non SHA-256 nudo.
- **Se l'admin deve davvero rivedere le password:** spostare gli utenti del portale in un DB
  separato che i desktop NON replicano, oppure generare password monouso che l'admin consegna e
  non rilegge.
- **Subito:** aggiungere un `filter`/`selector` alla replica desktop in modo che NON scarichi i
  documenti `kanban-portal-user`.

### 1.2 [ALTO] Credenziali CouchDB in chiaro nel localStorage del desktop
`saveRemoteSyncAuth()` salva username/password CouchDB in `localStorage` (`SYNC_AUTH_STORAGE_KEY`).
Sotto `file://` sono su disco in chiaro. Andrebbero nel **Keychain di macOS** tramite il bridge
Swift, non in localStorage.

### 1.3 [ALTO] Nessuna protezione brute-force sul login del portale
`/api/login` non ha rate limiting né ritardo progressivo. Con password in chiaro/SHA-256 e
nessun lockout, è attaccabile offline e online. Aggiungere rate limit per IP+username e backoff.

### 1.4 [MEDIO] Hashing password debole
`sha256(password)` è inadeguato (veloce, niente salt → rainbow table). Usare un KDF lento.

### 1.5 [MEDIO] Sessioni non revocabili
Il token è un HMAC con scadenza ma non c'è invalidazione: cambiare/disabilitare un utente non
chiude le sessioni attive (`verifySession` controlla solo firma+scadenza). Aggiungere almeno un
campo `tokenVersion`/`sessionEpoch` per utente da confrontare.

### 1.6 [MEDIO] Body non limitato e parse non difensivo
`readJson` accumula il body senza limite di dimensione (DoS in memoria). `verifySession` fa
`JSON.parse` del cookie controllato dall'attaccante senza try/catch (eccezione → 500 invece di
401). Mettere un tetto ai byte e avvolgere i parse.

### 1.7 [BASSO] Path traversal statico
`filePath.startsWith(publicDir)` passa anche per una cartella sorella tipo `public-altro`.
Confrontare con `publicDir + path.sep`.

---

## 2. Robustezza della sincronizzazione

### 2.1 [ALTO] Conflitti risolti in "last-write-wins" silenzioso
`resolveKanbanDocConflicts` sceglie il vincitore per `updatedAt` → `revision` → stringa `_rev` e
**cancella** le revisioni perdenti. Se un responsabile modifica dal portale e tu modifichi la
stessa task dal desktop, una delle due versioni sparisce senza alcuna traccia per l'utente.
- Conservare i campi non in conflitto con merge per-campo dove possibile (status, priorità,
  dueDate, note sono indipendenti).
- Quando il merge non è possibile, **segnalare il conflitto in UI** invece di scartare in
  silenzio (es. badge "modificata altrove", o salvare la versione perdente in una nota).

### 2.2 [ALTO] Possibile loop di retry sugli errori persistenti
Nel `catch` di `runRemoteSyncNow` vengono chiamate sia `scheduleRemoteAutoSync()` sia
`startRemoteReplication()`, e quest'ultima può ri-accodare `queueRemoteSyncNow()`. Con un errore
stabile (credenziali errate, 502 di Cosmos già documentato) si rischia un ciclo stretto di
tentativi. Introdurre **backoff esponenziale** con tetto e fermare i tentativi automatici dopo N
fallimenti finché l'utente non interviene.

### 2.3 [MEDIO] `state` riassegnato da callback asincroni → race condition
`applyRemoteKanbanDocs` / `applyRemoteStateDoc` fanno `state = normalizeState(...)` sovrascrivendo
l'intero stato. Se arrivano mentre l'utente sta editando (prima del `saveState`), la modifica in
corso può essere persa. Serve un confronto a grana più fine o un lock/coda fra edit locale e
applicazione del remoto.

### 2.4 [MEDIO] Doppia rappresentazione della verità
Lo stato esiste sia come blob unico (`localStorage`/file nativo/`stateText` legacy) sia come
documenti scomposti (`kanban-task`, `project`, `workspace`). I due possono divergere. Conviene
eleggere **una sola** sorgente canonica (i documenti scomposti, che sono anche ciò che il portale
usa) e derivare il resto, deprecando il doc `stateText` legacy una volta migrati tutti i client.

### 2.5 [BASSO] `retry: false` senza ripristino fine
La replica non riprende da sola sui guasti transitori; dipende dall'auto-sync schedulato. Va bene
se combinato con il backoff del punto 2.2, ma valutare `retry: true` con `back_off_function`.

---

## 3. Qualità del codice e manutenibilità

- **`02_state.js` (1353 righe)** mescola modello dati, persistenza, motore di sync e risoluzione
  conflitti. Estrarre il motore di sync (PouchDB/CouchDB) in un modulo dedicato (es. `11_sync.js`)
  per isolarlo e renderlo testabile.
- **I test (`tests/run-tests.mjs`) sono solo `assert.match` su stringhe del sorgente**: verificano
  che certe funzioni *esistano*, non che *funzionino*. Tutta la logica più rischiosa (freshness,
  merge conflitti, `stateToKanbanDocs`/`kanbanDocsToState` andata-ritorno) non è coperta da test
  comportamentali. Aggiungere unit test reali eseguendo le funzioni in un contesto `vm` con un
  PouchDB in-memory (`pouchdb-adapter-memory`).
- **Server portale senza test e senza logging strutturato**; aggiungere almeno test su
  `canSeeTask`, `mergeSubtasks`, `allowedPriority`, `cleanDate`.
- **Performance portale:** `listAssignableVisibleAs` e il ramo admin di `listTasks` fanno
  `_all_docs?include_docs=true` sull'intero DB ad ogni chiamata e filtrano in memoria. Cresce
  linearmente con i dati: usare viste/Mango index dedicati (`type`, `owner`).
- **XSS:** lato desktop le note sono correttamente passate da `escapeHtml`, e il portale usa
  `textContent`/`escapeHtml`/`escapeAttr`. Buono — mantenere questa disciplina e aggiungere una
  Content-Security-Policy restrittiva al portale.

---

## 4. Nuove funzionalità suggerite (in ordine di valore)

1. **Audit log delle modifiche** (chi/quando/cosa) sui task, utile col portale multi-utente e per
   diagnosticare le perdite-dati che ti hanno già colpito.
2. **Indicatore di stato sync sempre visibile** in UI (online/offline, ultimo sync, conflitti
   aperti) con pulsante "risolvi conflitti".
3. **Backup automatico versionato lato server** (non solo i backup locali), con retention.
4. **Notifiche/promemoria per scadenze** già parzialmente presenti (`reminders*`): estenderle a
   notifiche push verso i responsabili dal portale.
5. **Filtri replica per workspace**: ogni desktop replica solo i workspace di interesse, riducendo
   dati scaricati e superficie del leak (collegato a 1.1).
6. **Health-check del portale** (`/healthz`) e metriche minime per il systemd/Cosmos.

---

## Priorità consigliata
1. Tappare il leak password (1.1) + spostare credenziali nel Keychain (1.2).
2. Rate limit + KDF sul login (1.3, 1.4).
3. Backoff sync + gestione conflitti non distruttiva (2.2, 2.1).
4. Test comportamentali reali sul round-trip dei documenti (sezione 3).
