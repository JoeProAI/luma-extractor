# Luma Extractor

A comprehensive web application to extract, manage, and upload all your Luma Labs generated videos to Google Drive. Built with Next.js 14 and designed for deployment on Vercel.

## Features

- 🎥 **Complete Video Extraction**: Fetch all your Luma Labs videos with pagination support
- 📊 **Detailed Analytics**: View video counts, total storage size, and metadata
- 🔍 **Advanced Filtering**: Search by prompt, filter by size/date, sort by various criteria
- ☁️ **Google Drive Integration**: Direct upload to Google Drive with folder organization
- 📱 **Responsive Design**: Works perfectly on desktop and mobile devices
- ⚡ **Real-time Progress**: Live progress tracking for downloads and uploads
- 🎯 **Batch Operations**: Select and process multiple videos at once

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd luma-extractor
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

#### Required Environment Variables:

**Luma Labs API:**
- `LUMA_API_KEY`: Your Luma Labs API key from [Luma Labs Dashboard](https://lumalabs.ai/dashboard)

**Google Drive API:**
- `GOOGLE_DRIVE_CLIENT_ID`: OAuth 2.0 Client ID
- `GOOGLE_DRIVE_CLIENT_SECRET`: OAuth 2.0 Client Secret  
- `GOOGLE_DRIVE_REDIRECT_URI`: OAuth redirect URI (use `http://localhost:3000/api/auth/google/callback` for local dev)
- `GOOGLE_DRIVE_REFRESH_TOKEN`: OAuth refresh token

### 3. Google Drive API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Drive API
4. Create OAuth 2.0 credentials:
   - Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
5. Get your refresh token:
   - Use the OAuth 2.0 Playground or implement the auth flow
   - Make sure to request the `https://www.googleapis.com/auth/drive.file` scope

### 4. Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Deployment on Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy!

## Usage

### Extracting Videos

1. **Load Videos**: Click "Refresh" to fetch all your Luma Labs videos
2. **Browse & Filter**: Use search, filters, and sorting to find specific videos
3. **Select Videos**: Check individual videos or use "Select All"
4. **Upload to Drive**: Click "Upload to Drive" to batch upload selected videos

### Features Explained

- **Search**: Find videos by prompt text or video ID
- **Filters**: 
  - All Videos: Show everything
  - Recent: Videos from last 7 days
  - Large Files: Videos larger than 10MB
- **Sorting**: Sort by creation date or file size
- **Batch Selection**: Select multiple videos for bulk operations
- **Progress Tracking**: Real-time progress for downloads and uploads

## API Endpoints

### `/api/luma/generations`
- **GET**: Fetch Luma Labs video generations
- **Query Parameters**:
  - `limit`: Number of results per page (default: 50)
  - `offset`: Pagination offset (default: 0)  
  - `fetchAll`: Set to 'true' to fetch all videos with metadata

### `/api/drive/upload`
- **POST**: Upload videos to Google Drive
- **Body**: `{ videoIds: string[], folderName?: string }`

## File Structure

```
luma-extractor/
├── app/
│   ├── api/
│   │   ├── luma/generations/route.ts    # Luma Labs API integration
│   │   └── drive/upload/route.ts        # Google Drive upload
│   ├── globals.css                      # Global styles
│   ├── layout.tsx                       # Root layout
│   └── page.tsx                         # Main application page
├── components/
│   ├── VideoCard.tsx                    # Individual video display
│   └── ProgressModal.tsx                # Upload progress modal
├── lib/
│   ├── lumaService.ts                   # Luma Labs API service
│   └── googleDriveService.ts            # Google Drive API service
└── ...config files
```

## Technologies Used

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Luma Labs API**: Video generation service
- **Google Drive API**: Cloud storage integration
- **Vercel**: Deployment platform

## Troubleshooting

### Common Issues

1. **"Luma API key not configured"**
   - Make sure `LUMA_API_KEY` is set in your environment variables
   - Verify the API key is valid in Luma Labs dashboard

2. **"Missing environment variables"**
   - Check that all Google Drive API variables are set
   - Ensure variable names match exactly (case-sensitive)

3. **"Failed to upload to Google Drive"**
   - Verify your Google Drive API credentials
   - Check that the refresh token is still valid
   - Ensure proper OAuth scopes are granted

4. **Videos not loading**
   - Check browser console for API errors
   - Verify network connectivity
   - Try refreshing the page

### Getting Help

- Check the browser console for detailed error messages
- Verify all environment variables are correctly set
- Test API credentials independently
- Check Vercel deployment logs if deployed

## License

MIT License - feel free to use this project for your own video management needs!
