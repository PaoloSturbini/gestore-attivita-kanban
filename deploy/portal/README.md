# Portale responsabili Kanban

Portale web leggero per permettere ai responsabili di vedere e aggiornare solo le proprie attivita, senza accedere all'app completa e senza esporre credenziali CouchDB nel browser.

## Cosa fa

- Login admin con l'unico utente definito in `users.json`.
- Creazione utenti responsabili dal portale admin, salvati in CouchDB con password visibile all'admin.
- Lettura da CouchDB tramite la vista `tasks_by_owner`.
- Aggiornamento limitato di `statusId`, `priority`, `dueDate`, `notes` e completamento sotto-attivita.
- Validazione server-side: un responsabile vede e modifica solo task assegnate direttamente al proprio `visibleAs` o a `Team`.

## Configurazione

```bash
cd /root/paolost/kanban-portal
cp .env.example .env
cp users.example.json users.json
nano .env
nano users.json
chmod +x start.sh
```

Esempio `users.json`:

```json
[
  {
    "username": "admin",
    "password": "password-admin-lunga",
    "displayName": "Admin",
    "visibleAs": ["Admin"]
  }
]
```

`users.json` deve contenere solo l'admin bootstrap. Gli utenti responsabili si creano entrando nel portale come admin: per ogni utente il portale permette di scegliere una sola `visibleAs`, presa dai nomi gia presenti nei campi `owner`, `visibleTo` o responsabile sotto-attivita dei documenti `kanban-task`.

Ogni responsabile vede sempre sia le attivita assegnate direttamente alla propria `visibleAs`, sia quelle assegnate direttamente a `Team`. Se una task contiene sottoattivita, il portale mostra tutte le sottoattivita della task: quelle assegnate allo stesso responsabile o a `Team` sono modificabili, le altre sono visibili come contesto in stile attenuato e non modificabili. Il pulsante `Utenti` e disponibile solo all'admin.

Le password sono salvate solo come hash `scrypt` con salt (campo `passwordHash`) nei documenti `kanban-portal-user`: **non sono più recuperabili né visibili all'admin**. Il pannello mostra solo se una password è impostata; per cambiarla l'admin ne digita una nuova (campo vuoto = invariata). Le credenziali bootstrap in `users.json` possono usare `passwordHash` (consigliato) oppure `password`/`passwordSha256` in chiaro solo per compatibilità.

> Migrazione: gli utenti creati con versioni precedenti hanno ancora `password`/`passwordSha256` in chiaro nel documento. Reimposta la password di ciascuno una volta dal pannello admin per sostituirle con l'hash `scrypt` e ripulire i campi storici.

## Avvio manuale

```bash
./start.sh
```

Poi apri:

```text
http://127.0.0.1:8787
```

## Route Cosmos

Crea una nuova route dedicata al portale:

```text
URL: staff360.pst.my
Target host: 127.0.0.1
Target port: 8787
SSL: true
SSL redirect: true
```

Mantieni `pstdb.pst.my` solo per CouchDB. Il portale parlera con CouchDB dal server tramite `COUCHDB_URL=http://127.0.0.1:5985`, quindi i responsabili useranno solo:

```text
https://staff360.pst.my
```

## Servizio systemd

```ini
[Unit]
Description=Kanban responsabili portal
After=network-online.target

[Service]
WorkingDirectory=/root/paolost/kanban-portal
ExecStart=/root/paolost/kanban-portal/start.sh
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
```

## Note CouchDB

Prima di usare il portale, aggiorna CouchDB con `deploy/couchdb/init-kanban-db.sh`, cosi sono presenti le viste:

- `tasks_by_owner`

La nuova app desktop deve sincronizzare almeno una volta per creare i documenti separati `kanban-task`.
