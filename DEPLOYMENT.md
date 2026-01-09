# Netlify Deployment Guide

## Prerequisites

1. A [Netlify account](https://app.netlify.com/signup)
2. Your Supabase project credentials
3. Git repository (GitHub, GitLab, or Bitbucket)

## Deployment Steps

### Option 1: Deploy via Netlify CLI (Recommended)

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Initialize your site**
   ```bash
   netlify init
   ```
   - Choose "Create & configure a new site"
   - Select your team
   - Choose a unique site name
   - The build command and publish directory will be auto-detected from `netlify.toml`

4. **Set Environment Variables**
   ```bash
   netlify env:set NEXT_PUBLIC_SUPABASE_URL "your_supabase_url"
   netlify env:set NEXT_PUBLIC_SUPABASE_ANON_KEY "your_supabase_anon_key"
   netlify env:set SUPABASE_SERVICE_ROLE_KEY "your_service_role_key"
   netlify env:set NEXT_PUBLIC_APP_URL "https://your-site.netlify.app"
   ```

5. **Deploy**
   ```bash
   netlify deploy --prod
   ```

### Option 2: Deploy via Netlify Dashboard

1. **Push your code to Git**
   ```bash
   git add .
   git commit -m "Add Netlify configuration"
   git push origin main
   ```

2. **Connect to Netlify**
   - Go to [Netlify Dashboard](https://app.netlify.com)
   - Click "Add new site" > "Import an existing project"
   - Connect your Git provider and select your repository

3. **Configure Build Settings**
   - Build command: `npm run build` (auto-detected)
   - Publish directory: `.next` (auto-detected)
   - Click "Show advanced" and add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `NEXT_PUBLIC_APP_URL` (your Netlify URL)

4. **Deploy**
   - Click "Deploy site"
   - Wait for the build to complete

## Required Environment Variables

Add these environment variables in Netlify:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=https://your-site.netlify.app
```

## Post-Deployment

1. **Update Supabase Settings**
   - Go to your Supabase project settings
   - Add your Netlify URL to "Allowed URLs" in Authentication > URL Configuration

2. **Test Your Deployment**
   - Visit your Netlify URL
   - Test authentication
   - Verify API routes are working

3. **Configure Custom Domain (Optional)**
   - In Netlify: Site settings > Domain management
   - Add your custom domain
   - Update `NEXT_PUBLIC_APP_URL` environment variable

## Troubleshooting

### Build Fails

- Check build logs in Netlify dashboard
- Verify all environment variables are set
- Ensure dependencies are correctly listed in package.json

### API Routes Not Working

- Verify the `@netlify/plugin-nextjs` plugin is installed
- Check that API routes are in the `app/api/` directory
- Ensure serverless functions timeout is sufficient (Site settings > Functions)

### PWA Not Working

- Service worker files are generated during build
- Clear browser cache after deployment
- Check manifest.json is accessible

## Continuous Deployment

Once configured, Netlify automatically:
- Builds and deploys on every push to your main branch
- Creates preview deployments for pull requests
- Provides deploy previews for testing

## Resources

- [Netlify Next.js Documentation](https://docs.netlify.com/frameworks/next-js/)
- [Netlify CLI Documentation](https://docs.netlify.com/cli/get-started/)
- [Environment Variables](https://docs.netlify.com/environment-variables/overview/)
