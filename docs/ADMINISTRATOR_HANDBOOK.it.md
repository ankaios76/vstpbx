# Manuale di amministrazione VstPBX

## Gestione, manutenzione e sicurezza

[TOC]

## 1. Accesso e account amministratore

Accedi con l'account `admin` e la password impostata durante l'installazione. Dopo il primo accesso, cambia la password dal menu utente.

Ogni volta che si avvia, il backend legge `ADMIN_PASSWORD` dal file `.env` e imposta quel valore per l'account amministratore. Se cambi la password dall'interfaccia web, aggiorna anche `.env`; altrimenti, al successivo riavvio del backend verrà ripristinato il valore precedente. Proteggi `.env`: contiene i segreti dell'installazione.

## 2. Interni e telefoni

Apri **Impostazioni → Interni** e crea un interno con numero interno e identificativo chiamante. Genera una password SIP robusta; non riutilizzare la password di un utente.

Configura il telefono o softphone con questi dati:

| Impostazione del telefono | Valore |
|---|---|
| Server SIP / registrar | Indirizzo del server VstPBX |
| Porta | 5060 o la porta scelta durante l'installazione |
| Nome utente / ID autenticazione | Numero dell'interno |
| Password | Password SIP dell'interno |
| Trasporto | UDP |
| Codec | G.722, PCMA o PCMU se supportati |

Verifica che l'interno risulti online nella panoramica. Nel dettaglio dell'interno trovi le schede per i numeri in entrata e l'identificativo in uscita, il trasferimento di chiamata, la segreteria, i codec audio e le funzioni del telefono.

## 3. Trunk e instradamento delle chiamate

Apri **Impostazioni → Trunk** per aggiungere un provider SIP. Scegli un profilo del provider oppure il profilo generico, inserisci server e credenziali e seleziona la registrazione o l'autenticazione tramite IP, secondo le indicazioni del provider. Per un blocco di numeri, inserisci il primo e l'ultimo numero; i blocchi sono limitati a 1.000 numeri.

Assegna i numeri in entrata nella scheda **Numeri** dell'interno. Nella stessa scheda scegli l'identificativo chiamante in uscita. Alcuni provider richiedono il numero principale del blocco nell'intestazione `P-Asserted-Identity`.

Prova le chiamate in entrata e in uscita e controllane lo stato nella **Cronologia chiamate**. La panoramica mostra lo stato di registrazione dei trunk.

## 4. Segreteria e funzioni aggiuntive

Ogni interno dispone di una casella vocale. Configura PIN e tempo di squillo nella scheda **Segreteria** dell'interno. Digita `*98` per ascoltare la tua casella oppure `*97` seguito dal numero di un interno per ascoltare un'altra casella. Per inviare notifiche vocali via e-mail, configura SMTP in **Impostazioni → E-mail**.

Altre funzioni disponibili: gruppi di chiamata, menu IVR, rubriche globali e per interno con importazione/esportazione CSV e integrazione con Home Assistant tramite chiave API e MQTT.

## 5. Sicurezza

- Proteggi l'interfaccia web con HTTPS oppure limita l'accesso a una VPN. In modalità reverse proxy, interfaccia e API si collegano solo a localhost.
- Non esporre la porta 8000 del backend a reti non fidate.
- Limita le registrazioni SIP con la lista degli indirizzi consentiti, usa password robuste generate per gli interni e valuta una VPN per i telefoni remoti.
- Usa Fail2Ban sul server e controlla il suo stato e le impostazioni di sicurezza SIP in VstPBX.
- Le porte pubblicate da Docker possono aggirare le normali regole UFW. Limita l'accesso dal router o con regole firewall compatibili con Docker.
- Il backend usa il socket Docker per ricaricare Asterisk e installare gli aggiornamenti dall'interfaccia web. L'accesso al backend è quindi altamente privilegiato: proteggilo.

## 6. Operazioni e backup

Dalla cartella del progetto, controlla lo stato dei container e i log:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f asterisk
docker exec -it pbx_asterisk asterisk -rvvv
```

Nella console di Asterisk, `pjsip show endpoints` elenca gli endpoint e `pjsip show registrations` mostra lo stato di registrazione del provider. Per un riavvio controllato usa `docker compose restart`.

Esegui il backup di tutti e tre gli elementi: database PostgreSQL, volumi Docker `asterisk_voicemail` e `user_uploads`, e file `.env`. Conservane una copia fuori dal server e proteggi `.env`:

```bash
cd /opt/vstpbx
DEST=/var/backups/vstpbx/$(date +%F)
mkdir -p "$DEST"
docker exec pbx_postgres pg_dump -U asterisk asterisk_gui | gzip > "$DEST/db.sql.gz"
for v in asterisk_voicemail user_uploads; do
  docker run --rm -v "$(basename "$PWD")_$v":/data -v "$DEST":/out alpine \
    tar czf "/out/$v.tgz" -C /data .
done
cp .env "$DEST/env"
chmod 600 "$DEST/env"
```

Crea e verifica un backup prima di ogni aggiornamento. Aggiorna da **Impostazioni → Server → Aggiornamento** oppure esegui `sudo ./install.sh` nella cartella del progetto e scegli l'opzione di aggiornamento. Le migrazioni del database vengono eseguite automaticamente all'avvio del backend.

## 7. Risoluzione dei problemi

- **Interfaccia web non raggiungibile:** esegui `docker compose ps`; verifica che `pbx_frontend` e `pbx_backend` siano attivi e che la porta 3000 sia raggiungibile tramite proxy o LAN.
- **Accesso amministratore non riuscito:** controlla `ADMIN_PASSWORD` in `.env`; al riavvio del backend viene applicato nuovamente quel valore.
- **Telefono non si registra:** verifica indirizzo server, interno, password SIP, porta e firewall. **Impostazioni → Debug SIP** e i log di Asterisk mostrano i tentativi di registrazione.
- **Audio assente o chiamate interrotte:** verifica le porte UDP 10000–10100, le impostazioni NAT/IP pubblico e che SIP ALG sia disattivato sul router.
- **Trunk non registrato:** verifica credenziali e modalità di autenticazione. Nella console di Asterisk esegui `pjsip show registrations`.
