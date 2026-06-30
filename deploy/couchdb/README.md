# CouchDB remoto per Gestore attivita Kanban

Questa cartella prepara un database CouchDB remoto per l'app Kanban su Netcup, dietro Cosmos Cloud.

## Opzione A: usa il CouchDB esistente

Da documentazione locale risulta gia presente CouchDB dietro Cosmos a `https://cdb.pst.my`, con stack in `~/paolost/couchdb-livesync`. Se il servizio torna sano, crea solo il database dedicato:

```bash
cd ~/paolost/couchdb-livesync
cp /percorso/deploy/couchdb/init-kanban-db.sh .

export COUCHDB_URL=http://127.0.0.1:5984
export KANBAN_DB_NAME=gestore-attivita-kanban
export KANBAN_DB_USER=kanban_app
export KANBAN_DB_PASSWORD='password-app-lunga'
source .env

bash ./init-kanban-db.sh
```

Endpoint app storico:

```text
https://cdb.pst.my/gestore-attivita-kanban
```

## Opzione B: CouchDB isolato per l'app

Se preferisci non mescolare LiveSync e Kanban, copia questa cartella sul server:

```bash
rsync -avz deploy/couchdb/ root@46.38.234.216:/root/paolost/kanban-couchdb/
ssh root@46.38.234.216
cd /root/paolost/kanban-couchdb
cp .env.example .env
nano .env
docker compose -f cosmos.yml up -d
bash ./init-kanban-db.sh
```

Se una password contiene `$`, nel file `.env` usala con escape doppio per Docker Compose:

```env
COUCHDB_PASSWORD=abc$$vWqEma
KANBAN_DB_PASSWORD=xyz$$j...
```

In alternativa genera password senza `$`.

Endpoint app:

```text
https://pstdb.pst.my/gestore-attivita-kanban
```

## Note operative

- `init-kanban-db.sh` e idempotente: puo essere rieseguito.
- Lo script crea `_users`, `_replicator`, `_global_changes`, il database applicativo, un utente dedicato e la `_security` del database.
- Per aggiornare un CouchDB gia esistente dopo modifiche allo schema o alle viste, copia questa cartella sul server e rilancia solo `bash ./init-kanban-db.sh`: aggiornera il design document senza cancellare i dati.
- Non committare `.env`: contiene password amministrative e password app.
- Al momento `https://cdb.pst.my/` risponde da Cosmos ma restituisce `502`; va riavviato o corretto il backend prima di usare l'opzione A.
