FROM andrius/asterisk:20

USER root
ARG ASTERISK_LANG=en
ENV ASTERISK_LANG=$ASTERISK_LANG
RUN set -eu; \
    apt-get update; \
    apt-get install -y --no-install-recommends msmtp msmtp-mta ca-certificates tzdata; \
    prompt_lang="$(printf '%s' "$ASTERISK_LANG" | cut -d'_' -f1 | cut -d'-' -f1 | tr '[:upper:]' '[:lower:]')"; \
    case "$prompt_lang" in ''|*[!a-z]*) echo "Invalid ASTERISK_LANG: $ASTERISK_LANG" >&2; exit 1 ;; esac; \
    prompt_package="asterisk-prompt-${prompt_lang}"; \
    if [ "$prompt_lang" != "en" ] && apt-cache show "$prompt_package" >/dev/null 2>&1; then \
        apt-get install -y --no-install-recommends "$prompt_package"; \
        if [ -d "/usr/share/asterisk/sounds/${prompt_lang}" ]; then \
            mkdir -p /var/lib/asterisk/sounds; \
            ln -sfnT "/usr/share/asterisk/sounds/${prompt_lang}" "/var/lib/asterisk/sounds/${prompt_lang}"; \
        fi; \
    elif [ "$prompt_lang" != "en" ]; then \
        echo "No package found for ${prompt_package}; add custom prompts under /var/lib/asterisk/sounds/${prompt_lang}." >&2; \
    fi; \
    mkdir -p /var/lib/asterisk/sounds; \
    rm -rf /var/lib/apt/lists/*
ENV TZ=Europe/Berlin

# Copy pre-downloaded Asterisk core sounds (English)
COPY sounds/en/ /var/lib/asterisk/sounds/en/

# Copy Music on Hold files
COPY moh/ /var/lib/asterisk/moh/
COPY musiconhold.conf /etc/asterisk/musiconhold.conf

# Copy HTML voicemail email sender script
COPY voicemail-sender.sh /usr/local/bin/voicemail-sender.sh
RUN chmod +x /usr/local/bin/voicemail-sender.sh
