#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Get generation ID from command line argument
const generationId = process.argv[2] || 'luma-846d7dfe-c4c3-4ce8-9ab4-e1dce634d852-8e456ca4-b7b7-4998-ae36-08c002f4c375';

if (!generationId) {
  console.error('Usage: node scripts/single-video.js <generation-id>');
  process.exit(1);
}

async function fetchSingleVideo(id) {
  const apiKey = process.env.LUMA_API_KEY;
  
  if (!apiKey) {
    console.error('❌ LUMA_API_KEY not found in environment variables');
    process.exit(1);
  }

  try {
    console.log(`🔍 Fetching video: ${id}`);
    
    const response = await axios.get(`https://api.lumalabs.ai/dream-machine/v1/generations/${id}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const video = response.data;
    
    console.log('\n📹 Video Details:');
    console.log(`ID: ${video.id}`);
    console.log(`Status: ${video.state}`);
    console.log(`Type: ${video.generation_type}`);
    console.log(`Created: ${video.created_at}`);
    console.log(`Prompt: ${video.prompt || 'N/A'}`);
    
    if (video.assets?.video) {
      console.log(`Video URL: ${video.assets.video}`);
      
      // Get video metadata
      const headResponse = await axios.head(video.assets.video);
      const size = parseInt(headResponse.headers['content-length'] || '0', 10);
      const sizeFormatted = formatBytes(size);
      
      console.log(`File Size: ${sizeFormatted}`);
      
      // Download option
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      readline.question('\n💾 Download this video? (y/n): ', (answer) => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          downloadVideo(video.assets.video, `${id}.mp4`);
        }
        readline.close();
      });
    } else {
      console.log('❌ No video URL available');
    }
    
  } catch (error) {
    console.error('❌ Error fetching video:', error.response?.data || error.message);
  }
}

async function downloadVideo(url, filename) {
  try {
    console.log(`⬇️ Downloading ${filename}...`);
    
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 60000,
    });
    
    const writer = fs.createWriteStream(filename);
    response.data.pipe(writer);
    
    writer.on('finish', () => {
      console.log(`✅ Downloaded: ${filename}`);
    });
    
    writer.on('error', (error) => {
      console.error('❌ Download failed:', error.message);
    });
    
  } catch (error) {
    console.error('❌ Download error:', error.message);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Run the script
fetchSingleVideo(generationId);
