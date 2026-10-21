# Deploy Radar

Push to `main` runs type checks, PostgreSQL 16 integration tests, deploy-script tests, shell lint, dependency audit, production build, a deterministic browser test and Flutter checks. Only a passing commit is built and pushed to Docker Hub as `radar:sha-<commit>`. The VPS deploys its immutable digest.

The workflow uses repository secrets `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `SSH_HOST`, `SSH_PORT`, `SSH_USER`, `SSH_PRIVATE_KEY`, `SSH_KEY_PASSPHRASE` and `SSH_KNOWN_HOSTS`. The token needs push access to the Radar Docker Hub repository. The SSH account needs access to `/root/selfhost/radar` and Docker. Host verification is mandatory. A passphrase-protected key is decrypted only in the temporary runner directory and removed on exit.

## Server prerequisites

- Docker Compose with `up --wait`, Bash, `flock`, and the existing `selfhost_net` network.
- A dedicated `radar` database and non-superuser `radar` role on PostgreSQL 16, reachable at `core_postgres`.
- `/root/selfhost/radar/.env`, owned by the deploy account with mode `600`, based on [.env.example](.env.example). Production database credentials remain on the server.

Compose creates only `radar-web` and `radar-worker`. Both use the shared network, resource limits, rotating logs and health checks. Web has no host port; it is reachable only within the Docker network. Worker crawls at **07:15 Asia/Ho_Chi_Minh**. Its heartbeat detects a stopped or blocked event loop; source fetch results are available through `/api/status` and the sources page. Docker health status by itself does not restart an unhealthy process.

Before public access, configure a precise trusted hostname in `astro.config.mjs`, HTTPS and access control at the proxy. Web and mobile currently share one personal library without account authentication. Translation and AI remain disabled.

## Release layout and rollback

The workflow uploads `compose.yaml` and `cd.sh` under `releases/<commit>/`. Deploys hold a file lock, pull the image first, stop the old worker, apply backward-compatible migrations, start both containers and wait for health checks. Only after success does `current` point to the new release. `current/image.env` records its digest; `.env` is never rewritten by CD.

Failed migrations, startup or the final API check restore the previous application containers. On the first deployment, a failed release is stopped. SQL migrations are **not reversed**, so future destructive migrations need a separate migration and backup plan. Old images and release directories are retained for rollback. Re-running the same commit reuses its release directory.

To view status on the server:

```sh
cd /root/selfhost/radar
docker compose -p radar --project-directory "$PWD" --env-file .env --env-file current/image.env -f current/compose.yaml ps
docker logs --tail 100 radar-worker
docker exec radar-web node -e "fetch('http://127.0.0.1:4321/api/status').then(r=>r.json()).then(console.log)"
```

To roll back, choose an existing release, inspect its `image.env`, and pass that exact image digest to its script:

```sh
bash releases/<previous-commit>/cd.sh docker.io/<username>/radar@sha256:<digest>
```

Previously pulled images are kept locally. If a private image must be downloaded again, pipe a registry token to the script's stdin and supply the registry username as its second argument. The script uses a temporary Docker credential directory and removes it on exit.

After the first deployment, populate an empty library with `docker exec radar-worker npm run crawl`, or import an existing Radar library privately. Database backups belong to the VPS backup procedure; this pipeline does not back up or prune shared infrastructure.

## Local deployment-script checks

```sh
python3 -m unittest discover -s deployment/tests
bash -n deployment/cd.sh deployment/ssh-deploy.sh
shellcheck deployment/cd.sh deployment/ssh-deploy.sh
```

These tests simulate Docker failures without modifying running containers. CI's browser fixture runs against an isolated PostgreSQL instance and makes no publisher or AI requests.
