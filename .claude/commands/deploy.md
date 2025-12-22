# Deploy to Vercel

## Prerequisites
- Vercel CLI installed (`npm i -g vercel`)
- Project linked to Vercel (`vercel link`)
- Environment variables set in Vercel dashboard

## Deployment Steps

1. **Run tests first:**
   ```bash
   npm test
   ```

2. **Deploy to preview:**
   ```bash
   vercel
   ```

3. **Deploy to production:**
   ```bash
   vercel --prod
   ```

## Environment Variables Needed

Set these in Vercel Dashboard > Settings > Environment Variables:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_KEY` - Backend service role key (secret)
- `SUPABASE_ANON_KEY` - Public anonymous key

## Troubleshooting

**Cold start delays:**
Supabase free tier may pause after inactivity. First request after pause takes ~10-20 seconds.

**API errors:**
Check Vercel Functions logs in the dashboard.

**Realtime not working:**
Verify Supabase Realtime is enabled and ANON_KEY is correct.
