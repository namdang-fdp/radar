#!/usr/bin/env bash
set -euo pipefail
[[ "$SSH_HOST" =~ ^[a-zA-Z0-9.-]+$ ]] || exit 1
[[ "$SSH_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]] || exit 1
[[ "$SSH_PORT" =~ ^[0-9]+$ ]] && (( SSH_PORT >= 1 && SSH_PORT <= 65535 )) || exit 1
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ && "$IMAGE_DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]] || exit 1
[[ "$DOCKERHUB_USERNAME" =~ ^[a-z0-9][a-z0-9_-]*$ ]] || exit 1
[[ -n "$SSH_PRIVATE_KEY" && -n "$SSH_KNOWN_HOSTS" && -n "$DOCKERHUB_TOKEN" ]] || exit 1
umask 077
key="$RUNNER_TEMP/radar-deploy-key"
hosts="$RUNNER_TEMP/radar-known-hosts"
askpass="$RUNNER_TEMP/radar-askpass"
trap 'rm -f -- "$key" "$hosts" "$askpass"' EXIT
printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' > "$key"
printf '%s\n' "$SSH_KNOWN_HOSTS" | tr -d '\r' > "$hosts"
if ! ssh-keygen -y -P '' -f "$key" >/dev/null 2>&1; then
  [[ -n "${SSH_KEY_PASSPHRASE:-}" ]] || { echo 'Encrypted key requires SSH_KEY_PASSPHRASE' >&2; exit 1; }
  cat > "$askpass" <<'ASKPASS'
#!/usr/bin/env bash
printf '%s\n' "$SSH_KEY_PASSPHRASE"
ASKPASS
  chmod 700 "$askpass"
  export SSH_ASKPASS="$askpass" SSH_ASKPASS_REQUIRE=force DISPLAY=none
  ssh-keygen -p -N '' -f "$key" </dev/null >/dev/null
fi
ssh-keygen -y -P '' -f "$key" >/dev/null
lookup="$SSH_HOST"
if [[ "$SSH_PORT" != 22 ]]; then lookup="[$SSH_HOST]:$SSH_PORT"; fi
ssh-keygen -F "$lookup" -f "$hosts" >/dev/null || { echo 'SSH_KNOWN_HOSTS does not match host/port' >&2; exit 1; }
ssh_options=(-i "$key" -p "$SSH_PORT" -o BatchMode=yes -o IdentitiesOnly=yes -o ConnectTimeout=15 -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$hosts")
remote="$SSH_USER@$SSH_HOST"
release="/root/selfhost/radar/releases/$GITHUB_SHA"
# Only versioned deployment files travel through this channel; .env stays on the server.
# Values interpolated into remote commands are restricted to safe characters above.
printf -v prepare_command "test -r /root/selfhost/radar/.env && install -d -m 700 '%s'" "$release"
printf -v unpack_command "tar -xzf - -C '%s' && chmod 700 '%s/cd.sh'" "$release" "$release"
printf -v deploy_command "bash '%s/cd.sh' 'docker.io/%s/radar@%s' '%s'" "$release" "$DOCKERHUB_USERNAME" "$IMAGE_DIGEST" "$DOCKERHUB_USERNAME"
# These complete commands intentionally expand on the runner after input validation.
# shellcheck disable=SC2029
ssh "${ssh_options[@]}" "$remote" "$prepare_command"
# shellcheck disable=SC2029
tar -C deployment -czf - compose.yaml cd.sh | ssh "${ssh_options[@]}" "$remote" "$unpack_command"
# shellcheck disable=SC2029
printf '%s\n' "$DOCKERHUB_TOKEN" | ssh "${ssh_options[@]}" "$remote" \
  "$deploy_command"
