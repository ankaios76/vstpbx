#!/bin/bash
set -e

INSTALLER_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/installer"
# shellcheck disable=SC1091
. "$INSTALLER_DIR/i18n.sh"

SAVED_UI_LANG="en"
if [ -f .env ]; then
    SAVED_UI_LANG=$(sed -n 's/^UI_LANG=//p' .env | head -n 1)
    if ! [[ "$SAVED_UI_LANG" =~ ^[a-zA-Z]{2,3}([-_][a-zA-Z0-9]{2,8})*$ ]]; then
        SAVED_UI_LANG="en"
    fi
fi
SAVED_UI_LANG=$(printf '%s' "$SAVED_UI_LANG" | cut -d'-' -f1 | cut -d'_' -f1 | tr '[:upper:]' '[:lower:]')
load_installer_language "$SAVED_UI_LANG" "$INSTALLER_DIR/locales"
msg() {
    installer_msg "$@"
}
if [ "$SAVED_UI_LANG" != "en" ] && [ ! -f "$INSTALLER_DIR/locales/$SAVED_UI_LANG.lang" ]; then
    msg installer_translation_missing "$SAVED_UI_LANG"
fi

echo "============================================"
echo "  VstPBX Installer"
echo "============================================"
echo ""

# Check if user can run Docker (root or docker group)
if ! docker info >/dev/null 2>&1; then
    msg docker_cannot_connect
    msg docker_group_hint
    exit 1
fi

# Check prerequisites
command -v docker >/dev/null 2>&1 || { msg docker_not_installed; exit 1; }
docker compose version >/dev/null 2>&1 || { msg compose_not_available; exit 1; }

msg docker_found
echo ""

# --- Check for existing installation ---
FRESH_INSTALL=true

if [ -f .env ]; then
    msg existing_installation
    echo ""
    msg update_option
    msg reinstall_option
    echo ""
    read -rp "$(installer_prompt install_mode_choice)" INSTALL_MODE

    if [ "$INSTALL_MODE" = "2" ]; then
        echo ""
        msg delete_warning
        if installer_read_yes_no confirm_delete no; then
            msg deleting_installation
            docker compose down -v 2>/dev/null || true
            rm -f .env asterisk/config/manager.conf
            msg previous_installation_removed
            FRESH_INSTALL=true
        else
            msg cancelled
            exit 0
        fi
    else
        # --- Update mode ---
        echo ""
        msg updating_vstpbx

        # Source existing env values
        # shellcheck disable=SC1091
        . ./.env

        # Regenerate manager.conf with existing AMI password
        sed "s/%%AMI_PASSWORD%%/${AMI_PASSWORD}/" asterisk/config/manager.conf.template > asterisk/config/manager.conf
        msg manager_updated

        # Ensure fail2ban paths exist
        if [ ! -f /var/lib/fail2ban/fail2ban.sqlite3 ]; then
            mkdir -p /var/lib/fail2ban
            touch /var/lib/fail2ban/fail2ban.sqlite3
        fi
        if [ ! -S /var/run/fail2ban/fail2ban.sock ] && [ ! -e /var/run/fail2ban/fail2ban.sock ]; then
            mkdir -p /var/run/fail2ban
            touch /var/run/fail2ban/fail2ban.sock
        fi

        echo ""
        msg restarting_containers
        docker pull docker:cli >/dev/null 2>&1 &
        docker compose up -d --build

        # Detect local LAN IP
        LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")

        echo ""
        echo "============================================"
        msg update_complete
        echo "============================================"
        echo ""
        if [ "$BIND_ADDRESS" = "0.0.0.0" ] && [ -n "$LOCAL_IP" ]; then
            msg web_gui "http://${LOCAL_IP}:3000"
        else
            msg web_gui "http://localhost:3000"
        fi
        echo ""
        msg credentials_unchanged
        echo "============================================"
        exit 0
    fi
fi

# --- Fresh installation ---

# --- Language selection ---
msg select_language
msg language_option_en
msg language_option_it
msg language_option_de
msg language_option_other
read -rp "$(installer_prompt language_choice)" UI_LANG_CHOICE
case "$UI_LANG_CHOICE" in
    2) UI_LANG="it" ;;
    3) UI_LANG="de" ;;
    4)
        read -rp "$(installer_prompt locale_code_prompt)" UI_LANG
        if ! echo "$UI_LANG" | grep -Eq '^([a-z]{2,3})(-[a-zA-Z0-9]{2,8})*$'; then
            msg invalid_locale_code
            UI_LANG="en"
        fi
        ;;
    *) UI_LANG="en" ;;
esac
ASTERISK_LANG="$UI_LANG"
UI_LANG=$(printf '%s' "$UI_LANG" | cut -d'-' -f1 | tr '[:upper:]' '[:lower:]')

if [ "$UI_LANG" != "en" ] && [ ! -f "$INSTALLER_DIR/locales/$UI_LANG.lang" ]; then
    load_installer_language en "$INSTALLER_DIR/locales"
    msg installer_translation_missing "$UI_LANG"
fi

load_installer_language "$UI_LANG" "$INSTALLER_DIR/locales"

msg default_language "$UI_LANG"

# Detect external IP
msg detect_external_ip
DETECTED_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 icanhazip.com 2>/dev/null || echo "")

if [ -n "$DETECTED_IP" ]; then
    msg detected_external_ip "$DETECTED_IP"
    if installer_read_yes_no use_external_ip yes; then
        EXTERNAL_IP="$DETECTED_IP"
    else
        read -rp "$(installer_prompt enter_external_ip)" EXTERNAL_IP
    fi
else
    msg external_ip_not_detected
    read -rp "$(installer_prompt enter_external_ip)" EXTERNAL_IP
fi

# Detect local LAN IP
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")

echo ""

# Network mode
msg reverse_proxy_question
msg network_direct
msg network_proxy
read -rp "$(installer_prompt choice)" PROXY_CHOICE
if [ "$PROXY_CHOICE" = "2" ]; then
    BIND_ADDRESS="127.0.0.1"
    msg bind_local
else
    BIND_ADDRESS="0.0.0.0"
    msg bind_network
fi

# SIP port
echo ""
msg sip_title
msg sip_hint
read -rp "$(installer_prompt sip_prompt)" SIP_PORT
SIP_PORT="${SIP_PORT:-5060}"
msg sip_selected "$SIP_PORT"

echo ""

# Admin password
IFS= read -r -p "$(installer_prompt admin_prompt)" ADMIN_PASSWORD
if [ -z "$ADMIN_PASSWORD" ]; then
    ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
    msg admin_generated "$ADMIN_PASSWORD"
else
    msg admin_set
fi

# Generate secure random passwords
JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=')
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
AMI_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')

# Home Assistant integration (optional)
echo ""
msg ha_title
if installer_read_yes_no ha_prompt no; then
    HA_API_KEY=$(openssl rand -hex 32)
    msg ha_key_generated "$HA_API_KEY"
    echo ""
    read -rp "$(installer_prompt mqtt_address)" MQTT_BROKER
    if [ -n "$MQTT_BROKER" ]; then
        read -rp "$(installer_prompt mqtt_port)" MQTT_PORT
        MQTT_PORT="${MQTT_PORT:-1883}"
        read -rp "$(installer_prompt mqtt_user)" MQTT_USER
        if [ -n "$MQTT_USER" ]; then
            IFS= read -r -p "$(installer_prompt mqtt_password)" MQTT_PASSWORD
        fi
    fi
else
    HA_API_KEY=""
    MQTT_BROKER=""
fi

echo ""
msg generating_config

# Create .env file
cat > .env <<'ENVEOF'
# VstPBX Configuration - generated by install.sh
ENVEOF
# Write values without quotes (Docker Compose v2 treats quotes as literal)
{
    printf 'EXTERNAL_IP=%s\n' "$EXTERNAL_IP"
    printf 'ADMIN_PASSWORD=%s\n' "$ADMIN_PASSWORD"
    printf 'JWT_SECRET=%s\n' "$JWT_SECRET"
    printf 'DB_PASSWORD=%s\n' "$DB_PASSWORD"
    printf 'AMI_PASSWORD=%s\n' "$AMI_PASSWORD"
    printf 'BIND_ADDRESS=%s\n' "$BIND_ADDRESS"
    printf 'SIP_PORT=%s\n' "$SIP_PORT"
    printf 'PROJECT_DIR=%s\n' "$(pwd)"
    printf 'UI_LANG=%s\n' "${UI_LANG}"
    printf 'ASTERISK_LANG=%s\n' "${ASTERISK_LANG}"
    printf 'HA_API_KEY=%s\n' "${HA_API_KEY:-}"
    printf 'MQTT_BROKER=%s\n' "${MQTT_BROKER:-}"
    printf 'MQTT_PORT=%s\n' "${MQTT_PORT:-1883}"
    printf 'MQTT_USER=%s\n' "${MQTT_USER:-}"
    printf 'MQTT_PASSWORD=%s\n' "${MQTT_PASSWORD:-}"
} >> .env

msg env_created

# Write manager.conf from template with generated AMI password
sed "s/%%AMI_PASSWORD%%/${AMI_PASSWORD}/" asterisk/config/manager.conf.template > asterisk/config/manager.conf

msg manager_updated

# Ensure fail2ban paths exist (VstPBX reads them read-only if available)
if [ ! -f /var/lib/fail2ban/fail2ban.sqlite3 ]; then
    mkdir -p /var/lib/fail2ban
    touch /var/lib/fail2ban/fail2ban.sqlite3
    msg fail2ban_db_created
fi
if [ ! -S /var/run/fail2ban/fail2ban.sock ] && [ ! -e /var/run/fail2ban/fail2ban.sock ]; then
    mkdir -p /var/run/fail2ban
    touch /var/run/fail2ban/fail2ban.sock
    msg fail2ban_socket_created
fi

# Pre-pull helper image for web-based updates
echo ""
msg preparing_updates
docker pull docker:cli >/dev/null 2>&1 &

# Start containers
echo ""
msg starting_containers
docker compose up -d --build

echo ""
echo "============================================"
msg install_complete
echo "============================================"
echo ""
if [ "$BIND_ADDRESS" = "0.0.0.0" ]; then
    ACCESS_IP="${LOCAL_IP:-$EXTERNAL_IP}"
    msg web_gui "http://${ACCESS_IP}:3000"
    msg api "http://${ACCESS_IP}:8000"
    if [ -n "$LOCAL_IP" ] && [ "$LOCAL_IP" != "$EXTERNAL_IP" ]; then
        echo ""
        msg local_network "http://${LOCAL_IP}:3000"
        msg external_network "http://${EXTERNAL_IP}:3000"
        msg router_hint
    fi
else
    msg web_gui "http://localhost:3000"
    msg api "http://localhost:8000"
    msg reverse_proxy_required
fi
echo ""
msg login "$ADMIN_PASSWORD"
echo ""
msg credentials_saved
echo "============================================"
