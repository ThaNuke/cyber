# 🚀 Deployment Guide - Render.com

## Prerequisites
- GitHub account with the project pushed
- Render.com account (https://render.com)
- Supabase account (already configured)
- Microsoft Entra ID app registration (already configured)

## Environment Files Setup

### Frontend (.env.production)
```
VITE_API_URL=https://cyber-backend.onrender.com/api
VITE_MSAL_CLIENT_ID=f536f86f-a1b4-466d-bda9-9aa4d4a869d0
VITE_MSAL_TENANT_ID=6f4432dc-20d2-441d-b1db-ac3380ba633d
```

### Backend (.env.production)
**Note:** Set these environment variables in Render dashboard, do NOT commit secrets!
```
NODE_ENV=production
PORT=5000
SUPABASE_URL=https://gnmlimcoyddttkkbwrhe.supabase.co
SUPABASE_ANON_KEY=<from_supabase_settings>
SUPABASE_SERVICE_KEY=<from_supabase_settings>
JWT_SECRET=<generate_a_new_random_secret>
EVAL_ENCRYPTION_KEY=<from_local_.env>
FRONTEND_ORIGINS=https://cyber.onrender.com
MS_TENANT_ID=6f4432dc-20d2-441d-b1db-ac3380ba633d
MS_CLIENT_ID=f536f86f-a1b4-466d-bda9-9aa4d4a869d0
MS_ALLOWED_DOMAINS=kmutt.ac.th,mail.kmutt.ac.th
SENDGRID_API_KEY=<from_sendgrid>
SENDGRID_FROM_EMAIL=<from_sendgrid>
ALLOW_PASSWORD_LOGIN=false
```

## Deployment Steps

### 1. Backend Deployment
1. Go to https://render.com/dashboard
2. Click "New ++" → "Web Service"
3. Connect your GitHub repository (ThaNuke/cyber)
4. Configure:
   - **Name:** cyber-backend
   - **Branch:** main
   - **Runtime:** Node
   - **Build Command:** `cd backend && npm install`
   - **Start Command:** `cd backend && npm start`
5. Add Environment Variables (from your `.env` file - copy values):
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `JWT_SECRET` (generate new)
   - `EVAL_ENCRYPTION_KEY`
   - `SENDGRID_API_KEY`
   - `SENDGRID_FROM_EMAIL`
   - And others from list above
6. Click "Create Web Service"

### 2. Frontend Deployment
1. Click "New +" → "Static Site"
2. Connect your GitHub repository (same repo)
3. Configure:
   - **Name:** cyber
   - **Branch:** main
   - **Build Command:** `npm run build`
   - **Publish directory:** `dist`
4. Add Environment Variables: (top section of `.env.production`)
   - `VITE_API_URL`
   - `VITE_MSAL_CLIENT_ID`
   - `VITE_MSAL_TENANT_ID`
5. Click "Create Static Site"

### 3. Update Microsoft Azure Configuration
1. Go to Azure Portal → App Registrations
2. Find your app (cyber)
3. Go to Authentication
4. Add Redirect URIs:
   - `https://cyber.onrender.com` 
   - `https://cyber.onrender.com/login`
5. Save changes

## Testing Deployment

```bash
# Test backend health
curl https://cyber-backend.onrender.com/api/health

# Test frontend
Visit https://cyber.onrender.com

# Check logs on Render dashboard
Click on service → "Logs" tab
```

## Common Issues & Solutions

### CORS Errors
- Check `FRONTEND_ORIGINS` env var matches frontend URL
- Make sure frontend URL is exact match (including protocol and domain)

### JWT/Token Errors
- Generate a NEW secure JWT_SECRET for production
- Use a tool like: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Database Connection Issues
- Verify Supabase credentials are correct
- Check Supabase project is active
- Ensure IP allowlist is open (or set to accept all in dev)

### Build Failures
- Check build logs on Render dashboard
- Ensure all dependencies are in package.json
- Verify build commands match your project structure

## Subsequent Deployments

After initial setup, just push to main branch:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

Render will automatically rebuild and deploy!

## Production Checklist

- [x] Environment files created
- [x] GitHub repository linked to Render
- [ ] Backend deployed and health check passing
- [ ] Frontend deployed and accessible
- [ ] CORS configured correctly
- [ ] Microsoft Auth working
- [ ] AES-256 encryption working
- [ ] Database calls working
- [ ] Email service working (if applicable)

## URLs

- **Frontend:** https://cyber.onrender.com
- **Backend API:** https://cyber-backend.onrender.com/api
- **Health Check:** https://cyber-backend.onrender.com/api/health

## Security Best Practices

1. **Never commit secrets** - Use Render dashboard environment variables
2. **Use strong JWT_SECRET** - Generate random 32-byte key
3. **HTTPS only** - Render provides free HTTPS
4. **CORS strict mode** - Only allow your frontend domain in production
5. **Rate limiting** - Already configured in backend

## Support

If deployment fails:
1. Check Render service logs
2. Verify environment variables
3. Test locally: `npm run dev` (frontend), `npm run dev` (backend)
4. Check GitHub Actions if any
