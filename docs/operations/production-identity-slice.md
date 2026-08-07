# Production identity slice runbook

This runbook deploys the shared NestJS API defined by ADR-006. It does not
deploy the worker and does not move API routes into Next.js.

## Fixed production topology

| Concern                      | Value                              |
| ---------------------------- | ---------------------------------- |
| Web                          | `https://vibes-hub-web.vercel.app` |
| Supabase project             | `jelugsfwttolvtrduefo`             |
| Supabase region              | `eu-central-1` (Frankfurt)         |
| Cloud Run region             | `europe-west3` (Frankfurt)         |
| Cloud Run service            | `vibeshub-api`                     |
| Artifact Registry repository | `vibeshub`                         |
| Runtime service account      | `vibeshub-api-runtime`             |
| Database secret              | `vibeshub-database-url`            |

## Prerequisites

1. Enable billing on the Google Cloud project.
2. Authenticate `gcloud` with an authorized individual account.
3. Set the Google Cloud project ID explicitly and verify it before every
   mutating command.
4. Obtain the current Supabase database password and publishable key without
   placing either value in source control, terminal history, or chat.

## Google Cloud foundation

```bash
gcloud config set project YOUR_GOOGLE_CLOUD_PROJECT_ID
gcloud config get-value project

gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com

gcloud artifacts repositories create vibeshub \
  --location=europe-west3 \
  --repository-format=docker \
  --description="VibesHub production containers"

gcloud iam service-accounts create vibeshub-api-runtime \
  --display-name="VibesHub API runtime"
```

If a resource already exists, inspect it and continue; do not create a second
resource with a different name.

## Database secret

Use the Supavisor session-pooler endpoint on port `5432`:

```text
postgresql://postgres.jelugsfwttolvtrduefo:<URL_ENCODED_PASSWORD>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres
```

Create `vibeshub-database-url` in Google Secret Manager by passing the URL via
standard input. Do not pass it as a command-line argument or store it in shell
history:

```bash
gcloud secrets create vibeshub-database-url \
  --data-file=- \
  --replication-policy=automatic
```

Paste the complete connection string, press Enter, and then send EOF. Pin the
Cloud Run environment variable to secret version `1` for the initial
deployment. If the secret already exists, add a new version with
`gcloud secrets versions add vibeshub-database-url --data-file=-` and pin that
version instead.

Grant only the runtime service account access to this secret:

```bash
gcloud secrets add-iam-policy-binding vibeshub-database-url \
  --member="serviceAccount:vibeshub-api-runtime@YOUR_GOOGLE_CLOUD_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Build the API image

Run from the repository root and replace `GIT_SHA` with the deployed commit:

```bash
gcloud builds submit \
  --config=deploy/cloudbuild.api.yaml \
  --substitutions=_IMAGE_TAG=GIT_SHA \
  .
```

The build definition uses `docker/api.Dockerfile`. It cannot build or publish
the worker image.

## Deploy the API

```bash
gcloud run deploy vibeshub-api \
  --allow-unauthenticated \
  --concurrency=40 \
  --cpu=1 \
  --image=europe-west3-docker.pkg.dev/YOUR_GOOGLE_CLOUD_PROJECT_ID/vibeshub/vibeshub-api:GIT_SHA \
  --max-instances=3 \
  --memory=512Mi \
  --min-instances=0 \
  --port=8080 \
  --region=europe-west3 \
  --service-account=vibeshub-api-runtime@YOUR_GOOGLE_CLOUD_PROJECT_ID.iam.gserviceaccount.com \
  --set-env-vars="NODE_ENV=production,LOG_LEVEL=info,CORS_ORIGINS=https://vibes-hub-web.vercel.app,SUPABASE_URL=https://jelugsfwttolvtrduefo.supabase.co,SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY" \
  --set-secrets="DATABASE_URL=vibeshub-database-url:1"
```

The Cloud Run service is publicly invokable because authentication is enforced
inside the API with verified Supabase bearer tokens. Creator and moderator
authorization remains database-owned.

## Deployment smoke tests

```bash
curl --fail-with-body https://YOUR_CLOUD_RUN_URL/health
curl --fail-with-body https://YOUR_CLOUD_RUN_URL/health/ready
curl --include https://YOUR_CLOUD_RUN_URL/v1/me
```

The first two requests must return `200`. The unauthenticated `/v1/me` request
must return `401` with `application/problem+json`.

## Vercel configuration

For Production only, set:

```text
NEXT_PUBLIC_API_URL=https://YOUR_CLOUD_RUN_URL
NEXT_PUBLIC_SUPABASE_URL=https://jelugsfwttolvtrduefo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<production publishable key>
```

Remove both Supabase variables from Preview until a separate staging Supabase
project exists:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Redeploy `vibeshub-web` after changing environment variables.

## Production acceptance test

- [ ] Email signup creates an account and sends confirmation.
- [ ] Confirmed email login reaches `/account`.
- [ ] Google OAuth login returns to `/account`.
- [ ] Shopper account data loads from Cloud Run.
- [ ] Shopper submits a creator application with Hebrew content.
- [ ] A moderator starts review and requests changes.
- [ ] The applicant sees public feedback and no private notes.
- [ ] A moderator approves the application.
- [ ] Creator capabilities and profile are created transactionally.
- [ ] Missing or invalid tokens receive `401` Problem Details.
- [ ] A shopper receives `403` on moderator endpoints.
- [ ] Browser requests from the production Vercel origin pass CORS.
- [ ] Preview has no production Supabase credentials.
- [ ] No worker service or image was deployed.
