# VstPBX-Administrationshandbuch

## Betrieb, Wartung und Sicherheit

[TOC]

## 1. Anmeldung und Administratorkonto

Melden Sie sich mit dem Konto `admin` und dem bei der Installation festgelegten Passwort an. Ändern Sie das Passwort nach der ersten Anmeldung über das Benutzermenü.

Das Backend liest `ADMIN_PASSWORD` bei jedem Start aus der Datei `.env` und setzt diesen Wert für das Administratorkonto. Wenn Sie das Passwort in der Weboberfläche ändern, müssen Sie auch `.env` aktualisieren. Andernfalls wird beim nächsten Neustart des Backends wieder der alte Wert gesetzt. Schützen Sie `.env`; die Datei enthält Installationsgeheimnisse.

## 2. Nebenstellen und Telefone

Öffnen Sie **Einstellungen → Nebenstellen** und legen Sie eine Nebenstelle mit interner Rufnummer und Caller-ID an. Erzeugen Sie ein starkes SIP-Passwort und verwenden Sie kein wiederverwendetes Benutzerpasswort.

Konfigurieren Sie das Telefon oder Softphone mit folgenden Daten:

| Telefoneinstellung | Wert |
|---|---|
| SIP-Server / Registrar | Adresse des VstPBX-Servers |
| Port | 5060 oder der bei der Installation festgelegte Port |
| Benutzername / Auth-ID | Nebenstellennummer |
| Passwort | SIP-Passwort der Nebenstelle |
| Transport | UDP |
| Codecs | G.722, PCMA oder PCMU, sofern unterstützt |

Prüfen Sie, ob die Nebenstelle im Dashboard als online angezeigt wird. In der Detailansicht finden Sie Reiter für eingehende Rufnummern und ausgehende Caller-ID, Rufumleitung, Voicemail, Audio-Codecs und Telefonfunktionen.

## 3. Trunks und Anrufweiterleitung

Unter **Einstellungen → Leitungen** können Sie einen SIP-Provider einrichten. Wählen Sie ein Providerprofil oder das generische Profil, tragen Sie Server und Zugangsdaten ein und wählen Sie je nach Vorgabe des Providers Registrierung oder IP-Authentifizierung. Bei einem Rufnummernblock geben Sie die erste und letzte Rufnummer an; Blöcke sind auf 1.000 Nummern begrenzt.

Weisen Sie eingehende Rufnummern im Reiter **Rufnummern** der Nebenstelle zu. Dort wählen Sie auch die ausgehende Caller-ID. Manche Provider verlangen die Kopfnummer des Blocks im Header `P-Asserted-Identity`.

Testen Sie ein- und ausgehende Anrufe und prüfen Sie Status und Verlauf unter **Anrufverlauf**. Das Dashboard zeigt den Registrierungsstatus der Trunks.

## 4. Voicemail und weitere Funktionen

Jede Nebenstelle besitzt eine Voicemailbox. PIN und Klingeldauer konfigurieren Sie im Reiter **Voicemail** der Nebenstelle. Mit `*98` rufen Sie die eigene Mailbox ab; mit `*97` gefolgt von einer Nebenstellennummer eine andere Mailbox. Für Voicemail-Benachrichtigungen konfigurieren Sie SMTP unter **Einstellungen → E-Mail**.

Weitere Funktionen sind Sammelrufgruppen, IVR-Menüs, globale und nebenstellenbezogene Kontakte mit CSV-Import und -Export sowie die Home-Assistant-Integration über API-Schlüssel und MQTT.

## 5. Sicherheit

- Betreiben Sie die Weboberfläche hinter HTTPS oder beschränken Sie den Zugriff auf ein VPN. Im Reverse-Proxy-Modus binden Weboberfläche und API nur an localhost.
- Geben Sie Backend-Port 8000 niemals für nicht vertrauenswürdige Netze frei.
- Beschränken Sie SIP-Registrierungen mit der Allowlist, verwenden Sie generierte starke Nebenstellenpasswörter und erwägen Sie ein VPN für externe Telefone.
- Verwenden Sie Fail2Ban auf dem Host und prüfen Sie dessen Status sowie die SIP-Sicherheitseinstellungen in VstPBX.
- Von Docker veröffentlichte Ports können gewöhnliche UFW-Regeln umgehen. Beschränken Sie sie am Router oder mit Docker-fähigen Firewall-Regeln.
- Das Backend verwendet den Docker-Socket, um Asterisk neu zu laden und Web-Updates auszuführen. Ein Zugriff auf das Backend ist daher besonders privilegiert; halten Sie es geschützt.

## 6. Betrieb und Sicherungen

Prüfen Sie im Projektverzeichnis Containerstatus und Protokolle:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f asterisk
docker exec -it pbx_asterisk asterisk -rvvv
```

In der Asterisk-Konsole zeigt `pjsip show endpoints` die Endgeräte und `pjsip show registrations` den Registrierungsstatus der Provider. Für einen kontrollierten Neustart verwenden Sie `docker compose restart`.

Sichern Sie alle drei Bestandteile: die PostgreSQL-Datenbank, die Docker-Volumes `asterisk_voicemail` und `user_uploads` sowie `.env`. Bewahren Sie eine Kopie außerhalb des Servers auf und schützen Sie `.env`:

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

Erstellen und prüfen Sie vor einem Update eine Sicherung. Aktualisieren Sie über **Einstellungen → Server → Update** oder führen Sie im Projektverzeichnis `sudo ./install.sh` aus und wählen Sie die Update-Option. Datenbankmigrationen laufen beim Start des Backends automatisch.

## 7. Fehlerbehebung

- **Weboberfläche nicht erreichbar:** Prüfen Sie mit `docker compose ps`, ob `pbx_frontend` und `pbx_backend` laufen und Port 3000 über Proxy oder LAN erreichbar ist.
- **Administratoranmeldung schlägt fehl:** Prüfen Sie `ADMIN_PASSWORD` in `.env`; beim Neustart des Backends wird dieser Wert erneut übernommen.
- **Telefon registriert sich nicht:** Prüfen Sie Serveradresse, Nebenstelle, SIP-Passwort, Port und Firewall. **Einstellungen → SIP-Debug** und die Asterisk-Protokolle zeigen Registrierungsversuche.
- **Kein Ton oder abgebrochene Gespräche:** Prüfen Sie UDP-Ports 10000–10100, NAT-/öffentliche-IP-Einstellungen und deaktivieren Sie SIP ALG am Router.
- **Trunk ist nicht registriert:** Prüfen Sie Zugangsdaten und Authentifizierungsart. Führen Sie in der Asterisk-Konsole `pjsip show registrations` aus.
