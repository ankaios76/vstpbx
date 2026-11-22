#!/bin/bash

declare -A INSTALLER_EN_MESSAGES=()
declare -A INSTALLER_MESSAGES=()

_load_installer_catalog() {
    local catalog="$1"
    local target="$2"
    local key
    local value

    while IFS='=' read -r key value || [ -n "$key" ]; do
        value=${value%$'\r'}
        if [ -z "$key" ] || [[ "$key" == \#* ]]; then
            continue
        fi

        if ! [[ "$key" =~ ^[a-z][a-z0-9_]*$ ]]; then
            printf 'Invalid translation key "%s" in %s\n' "$key" "$catalog" >&2
            return 1
        fi

        if [ "$target" = "english" ]; then
            INSTALLER_EN_MESSAGES["$key"]="$value"
        else
            INSTALLER_MESSAGES["$key"]="$value"
        fi
    done < "$catalog"
}

load_installer_language() {
    local language="$1"
    local directory="$2"
    local catalog="$directory/$language.lang"

    INSTALLER_EN_MESSAGES=()
    INSTALLER_MESSAGES=()
    _load_installer_catalog "$directory/en.lang" english

    if [ "$language" != "en" ] && [ -f "$catalog" ]; then
        _load_installer_catalog "$catalog" selected
    fi
}

installer_msg() {
    local key="$1"
    local message
    shift

    if [[ ${INSTALLER_MESSAGES[$key]+present} ]]; then
        message=${INSTALLER_MESSAGES[$key]}
    elif [[ ${INSTALLER_EN_MESSAGES[$key]+present} ]]; then
        message=${INSTALLER_EN_MESSAGES[$key]}
    else
        printf 'Missing installer translation key "%s"\n' "$key" >&2
        return 1
    fi

    if [ "$#" -gt 0 ]; then
        printf -- "$message\n" "$@"
    else
        printf '%s\n' "$message"
    fi
}

installer_prompt() {
    local message
    message=$(installer_msg "$@")
    printf '%s ' "$message"
}

installer_is_yes() {
    local answer
    local values
    answer=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
    values=${INSTALLER_MESSAGES[yes_values]-${INSTALLER_EN_MESSAGES[yes_values]-}}
    case ",$values," in
        *,"$answer",*) return 0 ;;
        *) return 1 ;;
    esac
}

installer_is_no() {
    local answer
    local values
    answer=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
    values=${INSTALLER_MESSAGES[no_values]-${INSTALLER_EN_MESSAGES[no_values]-}}
    case ",$values," in
        *,"$answer",*) return 0 ;;
        *) return 1 ;;
    esac
}

installer_read_yes_no() {
    local key="$1"
    local default="$2"
    local answer

    while true; do
        if ! IFS= read -r -p "$(installer_prompt "$key")" answer; then
            return 1
        fi

        if [ -z "$answer" ]; then
            [ "$default" = "yes" ]
            return
        elif installer_is_yes "$answer"; then
            return 0
        elif installer_is_no "$answer"; then
            return 1
        else
            installer_msg invalid_yes_no
        fi
    done
}
