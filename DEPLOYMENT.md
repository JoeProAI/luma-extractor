# Deployment Guide

This guide covers deploying the Luma Extractor application to Vercel and configuring all necessary services.

## Prerequisites

- Node.js 18+ installed
- Luma Labs API account and API key
- Google Cloud Platform account with Drive API enabled
- Vercel account
- Git repository (GitHub recommended)

## Quick Start

1. **Clone and Setup**
   ```bash
   git clone <your-repo-url>
   cd luma-extractor
   npm run setup
   ```

2. **Configure Environment Variables**
   Edit `.env.local` with your API credentials (see below for details)

3. **Test Locally**
   ```bash
   npm run dev
   ```

4. **Deploy to Vercel**
   ```bash
   npm run deploy
   ```

## Detailed Configuration

### 1. Luma Labs API Setup

1. Go to [Luma Labs Dashboard](https://lumalabs.ai/dashboard)
2. Navigate to API section
3. Generate an API key
4. Add to `.env.local`:
   ```
   LUMA_API_KEY=your_luma_api_key_here
   ```

### 2. Google Drive API Setup

#### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click "Enable"

#### Step 2: Create OAuth 2.0 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Configure OAuth consent screen if prompted
4. Application type: "Web application"
5. Add authorized redirect URIs:
   - For local development: `http://localhost:3000/api/auth/google/callback`
   - For production: `https://your-vercel-domain.vercel.app/api/auth/google/callback`
6. Save and note down:
   - Client ID
   - Client Secret

#### Step 3: Get Refresh Token
You need to obtain a refresh token for server-side access. Use one of these methods:

**Method A: OAuth 2.0 Playground**
1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (settings)
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. In Step 1, select "Drive API v3" → "https://www.googleapis.com/auth/drive.file"
6. Click "Authorize APIs"
7. Complete the authorization flow
8. In Step 2, click "Exchange authorization code for tokens"
9. Copy the refresh token

**Method B: Manual Flow**
1. Create a temporary authorization URL:
   ```
   https://accounts.google.com/o/oauth2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&scope=https://www.googleapis.com/auth/drive.file&response_type=code&access_type=offline&prompt=consent
   ```
2. Visit the URL and authorize
3. Extract the authorization code from the redirect
4. Exchange for refresh token using your preferred method

#### Step 4: Configure Environment Variables
Add to `.env.local`:
```
GOOGLE_DRIVE_CLIENT_ID=your_client_id
GOOGLE_DRIVE_CLIENT_SECRET=your_client_secret
GOOGLE_DRIVE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
GOOGLE_DRIVE_REFRESH_TOKEN=your_refresh_token
```

### 3. Vercel Deployment

#### Automatic Deployment (Recommended)
```bash
npm run deploy
```

This script will:
- Validate environment variables
- Build the project
- Deploy to Vercel
- Set environment variables in Vercel

#### Manual Deployment
1. Install Vercel CLI: `npm install -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`
4. Set environment variables in Vercel dashboard

#### Environment Variables in Vercel
Go to your Vercel project dashboard and add these environment variables:
- `LUMA_API_KEY`
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REDIRECT_URI` (update with your Vercel domain)
- `GOOGLE_DRIVE_REFRESH_TOKEN`

### 4. Post-Deployment Configuration

1. **Update OAuth Redirect URI**
   - Go back to Google Cloud Console
   - Update your OAuth 2.0 client
   - Add your Vercel domain to authorized redirect URIs

2. **Test the Application**
   - Visit your deployed URL
   - Test video fetching
   - Test Google Drive upload
   - Verify download functionality

## Troubleshooting

### Common Issues

1. **"Luma API key not configured"**
   - Verify `LUMA_API_KEY` is set in Vercel environment variables
   - Check the API key is valid in Luma Labs dashboard

2. **"Missing environment variables"**
   - Ensure all Google Drive variables are set in Vercel
   - Variable names are case-sensitive

3. **Google Drive upload fails**
   - Verify OAuth redirect URI includes your Vercel domain
   - Check refresh token is still valid
   - Ensure proper scopes were granted during OAuth flow

4. **Build failures**
   - Check Node.js version compatibility
   - Verify all dependencies are properly installed
   - Review build logs in Vercel dashboard

### API Rate Limits

- **Luma Labs**: Respect their rate limits (typically 100 requests/minute)
- **Google Drive**: Has generous quotas but monitor usage
- The app includes built-in delays to prevent rate limiting

### Performance Optimization

1. **Large Video Collections**
   - The app uses pagination to handle large collections
   - Consider implementing caching for frequently accessed data

2. **Download Performance**
   - ZIP downloads are compressed for faster transfer
   - Large files may timeout - consider implementing resumable downloads

3. **Memory Usage**
   - Vercel functions have memory limits
   - Large video downloads are streamed to minimize memory usage

## Security Considerations

1. **API Keys**
   - Never commit API keys to version control
   - Use Vercel environment variables for production
   - Rotate keys regularly

2. **OAuth Tokens**
   - Refresh tokens should be stored securely
   - Monitor for unauthorized access
   - Implement token rotation if needed

3. **CORS and Domain Restrictions**
   - Configure Google OAuth for specific domains only
   - Use Vercel's built-in security features

## Monitoring and Maintenance

1. **Vercel Analytics**
   - Enable Vercel Analytics for usage insights
   - Monitor function execution times and errors

2. **Error Tracking**
   - Check Vercel function logs regularly
   - Implement error notifications if needed

3. **API Usage Monitoring**
   - Monitor Luma Labs API usage
   - Track Google Drive API quotas
   - Set up alerts for quota limits

## Support

- Check the main README.md for general usage
- Review Vercel documentation for deployment issues
- Consult Google Drive API documentation for OAuth problems
- Check Luma Labs documentation for API changes
