# VstPBX Administrator Handbook

## Operations, maintenance and security

[TOC]

## 1. Access and administrator account

Sign in to the web interface with the `admin` account and the password created during installation. Change the password from the user menu after the first sign-in.

The backend reads `ADMIN_PASSWORD` from `.env` whenever it starts and applies that value to the administrator account. If you change the password in the web interface, update `.env` as well or the old value will be restored at the next backend restart. Keep `.env` private; it contains installation secrets.

## 2. Extensions and phones

Open **Settings → Extensions** and create an extension with an internal number and caller ID. Generate a strong SIP password rather than reusing a user password.

Configure the phone or softphone with:

| Phone setting | Value |
|---|---|
| SIP server / registrar | Address of the VstPBX server |
| Port | 5060, or the port selected during installation |
| User name / authentication ID | The extension number |
| Password | The extension's SIP password |
| Transport | UDP |
| Codecs | G.722, PCMA or PCMU as supported |

Confirm that the extension appears online on the dashboard. The extension details contain tabs for inbound numbers and outbound caller ID, call forwarding, voicemail, audio codecs and phone features.

## 3. Trunks and call routing

Open **Settings → Trunks** to add a SIP provider. Select a provider profile or use the generic profile, enter the provider's server and credentials, and choose registration or IP authentication as required by the provider. For a number block, enter the first and last number; blocks are limited to 1,000 numbers.

Assign inbound numbers in the extension's **Numbers** tab. Select the outbound caller ID there as well. Some providers require the block's main number in the `P-Asserted-Identity` header.

Test inbound and outbound calls and check their status in **Call history**. The dashboard shows trunk registration status.

## 4. Voicemail and additional features

Each extension has a voicemail box. Configure its PIN and ring time in the extension's **Voicemail** tab. Dial `*98` to check your own mailbox or `*97` followed by an extension number to check another mailbox. Configure SMTP under **Settings → Email** to send voicemail notifications.

Other available features include ring groups, IVR menus, global and per-extension contacts with CSV import/export, and Home Assistant integration through an API key and MQTT.

## 5. Security

- Put the web interface behind HTTPS or restrict access to a VPN. In reverse-proxy mode, the web interface and API bind to localhost.
- Never expose backend port 8000 to untrusted networks.
- Restrict SIP registrations with the allow-list, use generated strong extension passwords, and consider a VPN for remote phones.
- Use Fail2Ban on the host and review its status and the SIP security settings in VstPBX.
- Docker-published ports can bypass ordinary UFW rules. Restrict published ports at the router or with Docker-aware firewall rules.
- The backend uses the Docker socket to reload Asterisk and perform web updates. Access to the backend is therefore highly privileged; keep it private.

## 6. Operations and backups

From the project directory, check container status and logs with:

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f asterisk
docker exec -it pbx_asterisk asterisk -rvvv
```

In the Asterisk console, `pjsip show endpoints` lists endpoints and `pjsip show registrations` shows provider registration status. Use `docker compose restart` for a controlled restart.

Back up all three items: the PostgreSQL database, the `asterisk_voicemail` and `user_uploads` Docker volumes, and `.env`. Keep a copy off the server and protect `.env`:

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

Before an update, create and verify a backup. Update from **Settings → Server → Update** or run `sudo ./install.sh` from the project directory and choose the update option. Database migrations run automatically when the backend starts.

## 7. Troubleshooting

- **Web interface unavailable:** run `docker compose ps`; check that `pbx_frontend` and `pbx_backend` are running and that port 3000 is reachable through the configured proxy or LAN.
- **Administrator sign-in fails:** check `ADMIN_PASSWORD` in `.env`; restarting the backend reapplies that value.
- **Phone does not register:** verify the server address, extension, SIP password, port and firewall. Use **Settings → SIP Debug** and the Asterisk logs to inspect registration attempts.
- **Calls have no audio or drop:** verify UDP ports 10000–10100, NAT/public IP settings and that SIP ALG is disabled on the router.
- **Trunk is not registered:** verify provider credentials and authentication mode. In the Asterisk console, run `pjsip show registrations`.
