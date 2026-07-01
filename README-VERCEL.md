# Ankapur Dhaba Frontend Production

This folder is the clean frontend package for local testing and Vercel deployment.

## Local Test

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 8081
```

By default, local mode connects to:

```text
http://localhost:4000/api
http://localhost:4000
```

## Vercel Environment Variables

Add these in Vercel Project Settings:

```text
VITE_API_BASE_URL=https://ntxublkpbfmnaxjadhuc.supabase.co/functions/v1/api
VITE_SOCKET_URL=
VITE_SUPABASE_URL=https://ntxublkpbfmnaxjadhuc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SsVWDzTpWFNjaa-hhxpQJg_nkngcSZl
```

Do not add Supabase secret keys or database passwords to the frontend.

## Vercel Settings

Use this folder as the project root:

```text
frontend-production
```

Build command:

```text
npm run build
```

Output directory:

```text
.output/public
```
