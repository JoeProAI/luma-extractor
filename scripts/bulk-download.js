#!/usr/bin/env node

/**
 * Bulk Download Script for Luma Videos
 * Downloads all videos from Firebase Storage or direct URLs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  downloadDir: './downloads',
  maxConcurrent: 5,
  retryAttempts: 3,
  timeout: 300000, // 5 minutes per video
};

// Create download directory
if (!fs.existsSync(CONFIG.downloadDir)) {
  fs.mkdirSync(CONFIG.downloadDir, { recursive: true });
}

/**
 * Download a single video from URL
 */
async function downloadVideo(url, filename, attempt = 1) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(CONFIG.downloadDir, filename);
    
    // Skip if file already exists
    if (fs.existsSync(filePath)) {
      console.log(`✅ Skipping ${filename} (already exists)`);
      resolve(filePath);
      return;
    }

    console.log(`📥 Downloading ${filename} (attempt ${attempt}/${CONFIG.retryAttempts})`);
    
    const file = fs.createWriteStream(filePath);
    const request = https.get(url, { timeout: CONFIG.timeout }, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'] || '0');
      let downloadedSize = 0;

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;
        if (totalSize > 0) {
          const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
          process.stdout.write(`\r📥 ${filename}: ${progress}%`);
        }
      });

      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`\n✅ Downloaded ${filename}`);
        resolve(filePath);
      });
    });

    request.on('error', (error) => {
      fs.unlink(filePath, () => {}); // Delete partial file
      
      if (attempt < CONFIG.retryAttempts) {
        console.log(`\n⚠️  Retrying ${filename}...`);
        setTimeout(() => {
          downloadVideo(url, filename, attempt + 1)
            .then(resolve)
            .catch(reject);
        }, 2000 * attempt);
      } else {
        reject(error);
      }
    });

    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Download videos from URLs file
 */
async function downloadFromUrlsFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error('❌ URLs file not found. Please download it from your app first.');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const videos = [];
  for (let i = 0; i < lines.length; i += 6) { // Each video has 6 lines
    const filename = lines[i];
    const url = lines[i + 1];
    
    if (filename && url && url.startsWith('http')) {
      videos.push({ filename: filename.trim(), url: url.trim() });
    }
  }

  console.log(`🎬 Found ${videos.length} videos to download`);
  
  // Download in batches
  const batches = [];
  for (let i = 0; i < videos.length; i += CONFIG.maxConcurrent) {
    batches.push(videos.slice(i, i + CONFIG.maxConcurrent));
  }

  let completed = 0;
  let failed = 0;

  for (const batch of batches) {
    const promises = batch.map(video => 
      downloadVideo(video.url, video.filename)
        .then(() => completed++)
        .catch(error => {
          console.error(`❌ Failed to download ${video.filename}: ${error.message}`);
          failed++;
        })
    );

    await Promise.all(promises);
    console.log(`\n📊 Progress: ${completed} completed, ${failed} failed, ${videos.length - completed - failed} remaining\n`);
  }

  console.log(`\n🎉 Download complete! ${completed} successful, ${failed} failed`);
  console.log(`📁 Files saved to: ${path.resolve(CONFIG.downloadDir)}`);
}

/**
 * Download from Firebase using CLI
 */
function downloadFromFirebase() {
  try {
    console.log('🔥 Downloading from Firebase Storage...');
    
    // Check if Firebase CLI is installed
    execSync('firebase --version', { stdio: 'ignore' });
    
    // Download all files
    const command = `firebase storage:download gs://luma-extractor.firebasestorage.app ${CONFIG.downloadDir} --recursive`;
    console.log(`Running: ${command}`);
    
    execSync(command, { stdio: 'inherit' });
    
    console.log('🎉 Firebase download complete!');
    console.log(`📁 Files saved to: ${path.resolve(CONFIG.downloadDir)}`);
    
  } catch (error) {
    if (error.message.includes('firebase')) {
      console.error('❌ Firebase CLI not installed. Install with: npm install -g firebase-tools');
      console.log('💡 Alternative: Use the URLs file method instead');
    } else {
      console.error('❌ Firebase download failed:', error.message);
    }
    process.exit(1);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🎬 Luma Video Bulk Downloader

Usage:
  node bulk-download.js urls <file>     # Download from URLs file
  node bulk-download.js firebase       # Download from Firebase Storage
  node bulk-download.js --help         # Show this help

Examples:
  node bulk-download.js urls luma-video-links-2024-01-20.txt
  node bulk-download.js firebase

Options:
  --dir <path>        # Download directory (default: ./downloads)
  --concurrent <num>  # Max concurrent downloads (default: 5)
  --retries <num>     # Retry attempts (default: 3)
`);
    process.exit(0);
  }

  const method = args[0];
  
  // Parse options
  const dirIndex = args.indexOf('--dir');
  if (dirIndex !== -1 && args[dirIndex + 1]) {
    CONFIG.downloadDir = args[dirIndex + 1];
  }
  
  const concurrentIndex = args.indexOf('--concurrent');
  if (concurrentIndex !== -1 && args[concurrentIndex + 1]) {
    CONFIG.maxConcurrent = parseInt(args[concurrentIndex + 1]);
  }

  switch (method) {
    case 'urls':
      const urlsFile = args[1];
      if (!urlsFile) {
        console.error('❌ Please specify the URLs file path');
        process.exit(1);
      }
      await downloadFromUrlsFile(urlsFile);
      break;
      
    case 'firebase':
      downloadFromFirebase();
      break;
      
    default:
      console.error('❌ Unknown method. Use "urls" or "firebase"');
      process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the script
main().catch(console.error);
