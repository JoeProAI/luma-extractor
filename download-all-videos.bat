@echo off
echo ========================================
echo    LUMA VIDEO BULK DOWNLOADER
echo ========================================
echo.
echo This script will download ALL your videos using multiple methods.
echo Choose your preferred method:
echo.
echo 1. Firebase CLI (Recommended - Downloads all uploaded videos)
echo 2. Direct URLs (Downloads all 2115 videos from Luma directly)
echo 3. Both methods
echo.
set /p choice="Enter your choice (1, 2, or 3): "

if "%choice%"=="1" goto firebase
if "%choice%"=="2" goto direct
if "%choice%"=="3" goto both
echo Invalid choice. Please run the script again.
pause
exit

:firebase
echo.
echo ========================================
echo    METHOD 1: FIREBASE DOWNLOAD
echo ========================================
echo.
echo Checking if Firebase CLI is installed...
firebase --version >nul 2>&1
if errorlevel 1 (
    echo Firebase CLI not found. Installing...
    npm install -g firebase-tools
    if errorlevel 1 (
        echo Failed to install Firebase CLI. Please install Node.js first.
        echo Download from: https://nodejs.org/
        pause
        exit
    )
)

echo Firebase CLI found! Logging in...
firebase login

echo.
echo Creating downloads directory...
if not exist "downloads" mkdir downloads
if not exist "downloads\firebase" mkdir downloads\firebase

echo.
echo Downloading all videos from Firebase Storage...
echo This may take a while depending on your collection size...
firebase storage:download gs://luma-extractor.firebasestorage.app downloads\firebase --recursive

echo.
echo ✅ Firebase download complete!
echo Videos saved to: downloads\firebase\
echo.

if "%choice%"=="1" goto end
goto direct

:direct
echo.
echo ========================================
echo    METHOD 2: DIRECT DOWNLOAD
echo ========================================
echo.
echo Checking if Node.js is installed...
node --version >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Please install Node.js first.
    echo Download from: https://nodejs.org/
    pause
    exit
)

echo Node.js found! Getting download URLs...
if not exist "downloads" mkdir downloads
if not exist "downloads\direct" mkdir downloads\direct

echo.
echo Fetching all video URLs from your app...
echo This will get URLs for all 2115 videos...

curl -s "https://luma-extractor-git-main-joeproais-projects.vercel.app/api/luma/generations?fetchAll=true&skipMetadata=true&maxVideos=3000" > temp_videos.json

echo.
echo Processing video URLs...
node -e "
const fs = require('fs');
const https = require('https');
const path = require('path');

try {
    const data = JSON.parse(fs.readFileSync('temp_videos.json', 'utf8'));
    const videos = data.generations || [];
    
    console.log(`Found ${videos.length} videos to download`);
    
    if (videos.length === 0) {
        console.log('No videos found. Please check your app is working.');
        process.exit(1);
    }
    
    // Create download list
    const downloadList = videos
        .filter(video => video.assets && video.assets.video)
        .map(video => ({
            url: video.assets.video,
            filename: `luma_${video.id}_${video.created_at.split('T')[0]}.mp4`
        }));
    
    fs.writeFileSync('download_list.json', JSON.stringify(downloadList, null, 2));
    console.log(`Created download list with ${downloadList.length} videos`);
    console.log('Starting downloads...');
    
    let completed = 0;
    let failed = 0;
    const maxConcurrent = 3; // Download 3 videos at once
    
    async function downloadVideo(item) {
        return new Promise((resolve) => {
            const filePath = path.join('downloads', 'direct', item.filename);
            
            // Skip if already exists
            if (fs.existsSync(filePath)) {
                console.log(`✅ Skipping ${item.filename} (already exists)`);
                completed++;
                resolve();
                return;
            }
            
            console.log(`📥 Downloading ${item.filename}...`);
            
            const file = fs.createWriteStream(filePath);
            const request = https.get(item.url, { timeout: 300000 }, (response) => {
                if (response.statusCode !== 200) {
                    console.log(`❌ Failed ${item.filename}: HTTP ${response.statusCode}`);
                    failed++;
                    fs.unlink(filePath, () => {});
                    resolve();
                    return;
                }
                
                response.pipe(file);
                
                file.on('finish', () => {
                    file.close();
                    completed++;
                    console.log(`✅ Downloaded ${item.filename} (${completed}/${downloadList.length})`);
                    resolve();
                });
            });
            
            request.on('error', (error) => {
                console.log(`❌ Failed ${item.filename}: ${error.message}`);
                failed++;
                fs.unlink(filePath, () => {});
                resolve();
            });
            
            request.on('timeout', () => {
                request.destroy();
                console.log(`❌ Timeout ${item.filename}`);
                failed++;
                fs.unlink(filePath, () => {});
                resolve();
            });
        });
    }
    
    async function downloadBatch(items) {
        const promises = items.map(downloadVideo);
        await Promise.all(promises);
    }
    
    async function downloadAll() {
        for (let i = 0; i < downloadList.length; i += maxConcurrent) {
            const batch = downloadList.slice(i, i + maxConcurrent);
            await downloadBatch(batch);
        }
        
        console.log(`\n🎉 Download complete!`);
        console.log(`✅ Successful: ${completed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📁 Files saved to: downloads\\direct\\`);
    }
    
    downloadAll().catch(console.error);
    
} catch (error) {
    console.error('Error processing videos:', error.message);
    process.exit(1);
}
"

del temp_videos.json >nul 2>&1
del download_list.json >nul 2>&1

echo.
echo ✅ Direct download complete!
echo Videos saved to: downloads\direct\
echo.

if "%choice%"=="3" goto end

:both
call :firebase
call :direct
goto end

:end
echo.
echo ========================================
echo    DOWNLOAD COMPLETE!
echo ========================================
echo.
if "%choice%"=="1" (
    echo Your videos are in: downloads\firebase\
) else if "%choice%"=="2" (
    echo Your videos are in: downloads\direct\
) else (
    echo Your videos are in:
    echo   Firebase: downloads\firebase\
    echo   Direct:   downloads\direct\
)
echo.
echo You now have all your Luma videos downloaded locally!
echo.
pause
