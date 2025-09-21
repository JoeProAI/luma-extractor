#!/usr/bin/env node

/**
 * Download ALL 2,115+ Luma Videos Directly
 * This script bypasses the 1000 video display limit and downloads everything
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

// Configuration
const CONFIG = {
  downloadDir: './downloads/all-videos',
  maxConcurrent: 5,
  retryAttempts: 3,
  timeout: 300000, // 5 minutes per video
  apiUrl: 'https://luma-extractor-git-main-joeproais-projects.vercel.app/api/luma/generations?fetchAll=true&skipMetadata=true&maxVideos=3000'
};

console.log('🎬 Luma Video Complete Downloader');
console.log('==================================');
console.log('This will download ALL your videos, not just the first 1000!');
console.log('');

// Create download directory
if (!fs.existsSync(CONFIG.downloadDir)) {
  fs.mkdirSync(CONFIG.downloadDir, { recursive: true });
  console.log(`📁 Created directory: ${CONFIG.downloadDir}`);
}

/**
 * Fetch all videos from API (bypassing frontend limit)
 */
async function fetchAllVideos() {
  console.log('🔍 Fetching all videos from API...');
  
  return new Promise((resolve, reject) => {
    https.get(CONFIG.apiUrl, { timeout: 60000 }, (response) => {
      let data = '';
      
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.generations) {
            console.log(`✅ Found ${result.generations.length} videos in API response`);
            console.log(`📊 Total videos found: ${result.total_count || result.generations.length}`);
            resolve(result.generations);
          } else {
            reject(new Error('No videos found in API response'));
          }
        } catch (error) {
          reject(new Error(`Failed to parse API response: ${error.message}`));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Download a single video with retry logic
 */
async function downloadVideo(video, attempt = 1) {
  const videoUrl = video.assets?.video;
  if (!videoUrl) {
    console.log(`⚠️  Skipping ${video.id} (no video URL)`);
    return { success: false, reason: 'No URL' };
  }

  const filename = `luma_${video.id}_${video.created_at.split('T')[0]}.mp4`;
  const filePath = path.join(CONFIG.downloadDir, filename);
  
  // Skip if file already exists
  if (fs.existsSync(filePath)) {
    console.log(`✅ Skipping ${filename} (already exists)`);
    return { success: true, reason: 'Already exists' };
  }

  console.log(`📥 Downloading ${filename} (attempt ${attempt}/${CONFIG.retryAttempts})`);
  
  return new Promise((resolve) => {
    const file = fs.createWriteStream(filePath);
    const request = https.get(videoUrl, { timeout: CONFIG.timeout }, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(filePath, () => {});
        
        if (attempt < CONFIG.retryAttempts) {
          console.log(`⚠️  Retrying ${filename} (HTTP ${response.statusCode})`);
          setTimeout(() => {
            downloadVideo(video, attempt + 1).then(resolve);
          }, 2000 * attempt);
        } else {
          resolve({ success: false, reason: `HTTP ${response.statusCode}` });
        }
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
        resolve({ success: true, reason: 'Downloaded' });
      });
    });

    request.on('error', (error) => {
      file.close();
      fs.unlink(filePath, () => {});
      
      if (attempt < CONFIG.retryAttempts) {
        console.log(`\n⚠️  Retrying ${filename} (${error.message})`);
        setTimeout(() => {
          downloadVideo(video, attempt + 1).then(resolve);
        }, 2000 * attempt);
      } else {
        resolve({ success: false, reason: error.message });
      }
    });

    request.on('timeout', () => {
      request.destroy();
      file.close();
      fs.unlink(filePath, () => {});
      
      if (attempt < CONFIG.retryAttempts) {
        console.log(`\n⚠️  Retrying ${filename} (timeout)`);
        setTimeout(() => {
          downloadVideo(video, attempt + 1).then(resolve);
        }, 2000 * attempt);
      } else {
        resolve({ success: false, reason: 'Timeout' });
      }
    });
  });
}

/**
 * Download all videos in batches
 */
async function downloadAllVideos(videos) {
  console.log(`\n🚀 Starting download of ${videos.length} videos...`);
  console.log(`📁 Saving to: ${path.resolve(CONFIG.downloadDir)}`);
  console.log(`⚡ Concurrent downloads: ${CONFIG.maxConcurrent}`);
  console.log('');

  const results = {
    total: videos.length,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    errors: []
  };

  // Filter videos with valid URLs
  const validVideos = videos.filter(video => video.assets?.video);
  console.log(`📊 Videos with download URLs: ${validVideos.length}/${videos.length}`);

  // Download in batches
  for (let i = 0; i < validVideos.length; i += CONFIG.maxConcurrent) {
    const batch = validVideos.slice(i, i + CONFIG.maxConcurrent);
    console.log(`\n📦 Processing batch ${Math.floor(i / CONFIG.maxConcurrent) + 1}/${Math.ceil(validVideos.length / CONFIG.maxConcurrent)}`);
    
    const batchPromises = batch.map(video => downloadVideo(video));
    const batchResults = await Promise.all(batchPromises);
    
    batchResults.forEach((result, index) => {
      if (result.success) {
        if (result.reason === 'Already exists') {
          results.skipped++;
        } else {
          results.downloaded++;
        }
      } else {
        results.failed++;
        results.errors.push(`${batch[index].id}: ${result.reason}`);
      }
    });

    console.log(`📊 Progress: ${results.downloaded + results.skipped}/${validVideos.length} completed`);
  }

  return results;
}

/**
 * Main function
 */
async function main() {
  try {
    // Fetch all videos
    const videos = await fetchAllVideos();
    
    if (videos.length === 0) {
      console.log('❌ No videos found to download');
      process.exit(1);
    }

    // Download all videos
    const results = await downloadAllVideos(videos);
    
    // Show final results
    console.log('\n🎉 Download Complete!');
    console.log('====================');
    console.log(`📊 Total videos: ${results.total}`);
    console.log(`✅ Downloaded: ${results.downloaded}`);
    console.log(`⏭️  Skipped (already existed): ${results.skipped}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📁 Location: ${path.resolve(CONFIG.downloadDir)}`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ Failed downloads:');
      results.errors.slice(0, 10).forEach(error => console.log(`   ${error}`));
      if (results.errors.length > 10) {
        console.log(`   ... and ${results.errors.length - 10} more`);
      }
    }
    
    console.log('\n🎬 All your Luma videos have been downloaded!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});

// Run the script
main();
