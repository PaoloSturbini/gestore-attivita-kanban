# CouchDB remoto per Gestore attivita Kanban

Questa cartella prepara il database CouchDB dell'app Kanban esclusivamente su X1 Pro, dietro Cosmos Cloud.

## Stack X1 Pro

Il rilascio avviene soltanto con GitHub Actions sul runner `x1pro-kanban`. Il workflow preserva `.env`, avvia lo stack isolato e applica automaticamente lo schema:

```bash
cd /srv/repos/gestore-attivita-kanban/deploy/couchdb
docker compose --env-file .env -f cosmos.yml ps
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
- Il workflow riesegue lo script dopo ogni rilascio per aggiornare schema e viste senza cancellare i dati.
- Non committare `.env`: contiene password amministrative e password app.
