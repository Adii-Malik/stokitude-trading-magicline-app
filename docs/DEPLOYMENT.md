# Deploying to Oracle Cloud Always Free

Why this target: the backend holds Socket.IO connections open and runs Agenda
cron jobs in-process. Both need a process that never sleeps, which rules out
serverless entirely and makes any tier that idles the service quietly stop your
scheduled price polling. An always-on VM has no such problem.

One VM runs everything. The backend serves the built frontend from
`frontend/dist`, so there is a single service on a single port.

---

## 0. Before you start

You need: an Oracle Cloud account (card required for identity verification,
Always Free resources are not charged), a domain name pointed at the VM, and
your MongoDB Atlas connection string for a **production** database.

---

## 1. Create the instance

Console → Compute → Instances → **Create instance**.

| Setting | Value |
|---|---|
| Image | Canonical Ubuntu 22.04 or 24.04 |
| Shape | **VM.Standard.A1.Flex** (Ampere, ARM) |
| OCPUs / memory | 2 OCPU / 12 GB — the whole Always Free A1 allowance |
| Boot volume | 50 GB is ample (200 GB free across all instances) |
| SSH keys | Upload your public key — you cannot add it later without a rescue |

> **"Out of host capacity"** is the usual first failure. ARM capacity in free
> tenancies is heavily contested. Try a different availability domain, try a
> smaller shape, or retry over a few hours. This is normal and not a mistake on
> your part.

Note the **public IP** when it finishes provisioning.

---

## 2. Open the ports — in both places

This is where most OCI deployments stall. Oracle filters traffic **twice**, and
opening only one side looks exactly like a broken app.

**a) The VCN security list** — Networking → Virtual Cloud Networks → your VCN →
Security Lists → default. Add ingress rules:

| Source | Protocol | Port |
|---|---|---|
| 0.0.0.0/0 | TCP | 80 |
| 0.0.0.0/0 | TCP | 443 |

**b) The instance firewall** — Ubuntu images on OCI ship with iptables rules
that drop everything except SSH, and those rules survive reboots:

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Do **not** open 5001. The app publishes no port at all — only Caddy reaches
it, over the compose network.

---

## 3. Point your domain

An `A` record for your domain to the instance's public IP. Confirm before
requesting a certificate, or Let's Encrypt will fail:

```bash
dig +short your-domain.com
```

---

## 4. Prepare the server

```bash
ssh ubuntu@YOUR_IP

sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER   # log out and back in for this to take effect
```

---

## 5. Whitelist the VM in Atlas

Atlas → Network Access → Add IP Address → the instance's public IP.

Skipping this produces a connection timeout at boot that reads like a bad
connection string. Do not use `0.0.0.0/0` here — the VM has a static public IP,
so there is no reason to open the database to the internet.

---

## 6. Deploy

```bash
git clone https://github.com/Adii-Malik/stokitude-trading-magicline-app.git
cd stokitude-trading-magicline-app

cp .env.production.example .env.production
openssl rand -base64 48        # paste into JWT_SECRET
openssl rand -base64 24        # paste into ADMIN_SIGNUP_CODE
nano .env.production           # fill MONGO_URI and FRONTEND_URL too

docker compose -f docker-compose.prod.yml up -d
```

The build takes several minutes on ARM the first time. Check it came up:

```bash
docker compose ps
curl -s localhost/health | head -20   # port 80: Caddy, not the app
docker compose logs -f app
```

The app **refuses to start** in production without `MONGO_URI`, `JWT_SECRET`
and `ADMIN_SIGNUP_CODE`. If the container exits immediately, read the logs —
it will name the missing variable. This is deliberate: the development
fallbacks for those values are published in this repository, and booting with
them would leave tokens forgeable and the admin signup code public.

---

## 7. TLS

Caddy obtains and renews certificates itself, so `docker-compose.prod.yml`
already includes it and there is nothing to install. Point DNS at the machine,
put your domain in `.env.production`:

```
SITE_ADDRESS=your-domain.com
```

then `docker compose -f docker-compose.prod.yml up -d`. HTTPS, the HTTP
redirect and renewal all come up on their own.

Leave `SITE_ADDRESS` unset and it serves plain HTTP on port 80, which is what
you want for the first smoke test against an IP.

<details>
<summary>nginx + certbot instead</summary>

`deploy/nginx.conf` (TLS) and `deploy/nginx-http.conf` (plain) remain for anyone
who prefers nginx. They need certbot and a renewal timer; Caddy does not, which
is why it is the default.

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/stokitude
sudo sed -i 's/example.com/your-domain.com/g' /etc/nginx/sites-available/stokitude
sudo ln -sf /etc/nginx/sites-available/stokitude /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo mkdir -p /var/www/certbot
sudo certbot --nginx -d your-domain.com
```
</details>

## 8. Create the first admin

```bash
docker compose exec app npm --prefix backend run create-admin
```

It reads `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` from
`.env.production`. Clear both from the file afterwards — the account exists
from then on, and the script only needs them once.

---

## Updating

Deploying is deliberately manual. CI builds and publishes on every push to
`main`, but nothing reaches the server until you ask for it — so a bad push
sits in the registry rather than in production.

```
git push  ->  Actions runs the tests and publishes  ->  you pull
```

Wait for the **Build image** run to go green, then on the server:

```bash
cd ~/site
docker compose pull
docker compose up -d
```

About twenty seconds, with a few seconds of downtime while the container
swaps. `up -d` only recreates a container whose image actually changed.

`restart: unless-stopped` plus the healthcheck means both containers come
back on reboot and after a crash. Nothing else to configure.

### Rolling back

`:latest` is a moving pointer, so "the previous version" is not something
`pull` can find. CI also tags every build with its commit, so pin one:

```bash
IMAGE=ghcr.io/adii-malik/stokitude-trading-magicline-app:sha-abc1234 \
  docker compose up -d
```

Take the short SHA from the Actions run, or from the package's version list.
Once the fix is out, drop the override and go back to `latest`.

### Automating it later

A Watchtower container polling the registry would make deploys hands-off.
It is left out on purpose: on a 1 GB box it costs ~50 MB, and it removes the
one moment when a person looks at production before it changes. Worth adding
when manual deploys start feeling like a chore, not before.

---

## Verifying it actually works

```bash
curl -s https://your-domain.com/health          # returns JSON
curl -sI https://your-domain.com | head -1      # 200
```

Then in a browser: log in, open the journal, and watch the dashboard for a
live price update. **The price update is the real test** — it proves the
WebSocket upgrade survived the proxy. If the page loads but prices never move,
check `docker compose logs caddy` — Caddy proxies upgrades without
configuration, so a failure there is usually the app being unreachable.

---

## When something is wrong

| Symptom | Cause |
|---|---|
| Connection times out from outside | Port open in only one of the two firewalls (§2) |
| Container exits at once | A required secret is missing — the log names it |
| MongoDB timeout at boot | VM's IP not whitelisted in Atlas (§5) |
| Page loads, prices frozen | Caddy not reaching the app — check `docker compose logs caddy` |
| `Could not connect` on port 80 | Caddy's PORTS column is empty; the `ports:` block is missing from compose |
| Certbot fails | DNS not yet pointing at the VM, or port 80 closed |
| `permission denied` on docker | You have not logged out since `usermod -aG docker` |

Logs:

```bash
docker compose logs --tail=100 app
docker compose logs --tail=50 caddy
```

---

## Alternative: Google Cloud Always Free

If the Oracle signup will not complete — a common outcome, and not something
you can debug from your side — Google's Always Free tier also gives a VM that
never sleeps.

| | Oracle | Google |
|---|---|---|
| Shape | ARM Ampere, to 4 vCPU / 24 GB | e2-micro, ~1 vCPU / **1 GB** |
| Regions | Your home region | us-west1 / us-central1 / us-east1 only |
| Disk | 200 GB | 30 GB |
| Free egress | 10 TB/mo | **1 GB/mo** from North America |

Everything above applies, with three changes:

**1. Never build on the server.** 1 GB is not enough for a Vite build; it will
be OOM-killed. The `Build image` workflow publishes a multi-arch image to
ghcr.io on every push to `main`, so the VM only pulls:

```bash
export IMAGE=ghcr.io/adii-malik/stokitude-trading-magicline-app:latest
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_USERNAME --password-stdin
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Make the package public in GitHub → Packages → settings, and the `docker
login` is not needed at all.

**2. Add swap.** Node plus Caddy on 1 GB is tight enough that a spike will kill
the container without it:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

**3. Firewall is one place, not two.** GCP uses VPC firewall rules; there is no
second iptables layer to open. Tick "Allow HTTP/HTTPS traffic" when creating
the instance, or add rules for tcp:80 and tcp:443.

Watch the **1 GB monthly egress**. A personal journal will not come close, but
serving images or a busy dashboard could.

> Free-tier terms change. Check the current limits before committing — the
> shape of the advice holds, the numbers may not.

## If free tiers keep rejecting you

Signup failures on both Oracle and GCP usually come down to card verification,
and no amount of retrying fixes it. At that point a small paid VPS is worth
more than the time already spent: roughly $4–7/month buys 2 vCPU and 4 GB from
Hetzner, DigitalOcean or similar — more machine than either free tier, with a
signup that works. Nothing above changes except the provider; the compose file,
Caddyfile and runbook are identical.

## Backups

Atlas M0 has no automated backup, so this is the only copy. `deploy/backup.sh`
dumps the whole database nightly and keeps 14 days.

```bash
cd ~/site
chmod +x deploy/backup.sh deploy/restore.sh
./deploy/backup.sh                      # run once to check it works
```

It reads `MONGO_URI` from `.env.production`, so rotating the password needs no
change here. Dumps land in `~/backups`. Schedule it:

```bash
crontab -e
# 02:30 daily, appending to a log
30 2 * * * $HOME/site/deploy/backup.sh >> $HOME/backups/backup.log 2>&1
```

Check it is running with `tail ~/backups/backup.log`. Every line is `OK` or
`FAIL` with a reason. A dump under 1 KB is treated as a failure and discarded,
so an unreachable database cannot quietly replace good backups with empty ones.

To restore — this drops the collections in the archive and replaces them:

```bash
./deploy/restore.sh ~/backups/psx-20260815-023000.archive.gz --yes
```

Copy a dump off the VM occasionally. A backup on the same disk as the database
does not survive losing the disk:

```bash
scp user@your-vm:'~/backups/psx-*.archive.gz' ~/psx-backups/
```

## What this does not cover

- **The Python strategy engine.** Separate repo, separate service. Leave
  `PYTHON_SERVICE_URL` blank until it is deployed.
- **Monitoring.** An uptime check against `/health` will tell you it died
  before you notice yourself.
