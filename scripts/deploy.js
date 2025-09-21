#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying Luma Extractor to Vercel...\n');

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local not found. Please run npm run setup first.');
  process.exit(1);
}

// Load environment variables
require('dotenv').config({ path: envPath });

const requiredVars = [
  'LUMA_API_KEY',
  'GOOGLE_DRIVE_CLIENT_ID',
  'GOOGLE_DRIVE_CLIENT_SECRET',
  'GOOGLE_DRIVE_REDIRECT_URI',
  'GOOGLE_DRIVE_REFRESH_TOKEN'
];

const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease configure all environment variables before deploying.');
  process.exit(1);
}

console.log('✅ Environment variables validated\n');

// Check if Vercel CLI is installed
try {
  execSync('vercel --version', { stdio: 'pipe' });
} catch (error) {
  console.log('📦 Installing Vercel CLI...');
  try {
    execSync('npm install -g vercel', { stdio: 'inherit' });
  } catch (installError) {
    console.error('❌ Failed to install Vercel CLI:', installError.message);
    console.error('Please install it manually: npm install -g vercel');
    process.exit(1);
  }
}

// Build the project
console.log('🔨 Building project...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build successful\n');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Deploy to Vercel
console.log('🚀 Deploying to Vercel...');
try {
  // Set environment variables in Vercel
  console.log('📝 Setting environment variables...');
  
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      try {
        execSync(`vercel env add ${varName} production`, {
          input: value,
          stdio: ['pipe', 'inherit', 'inherit']
        });
      } catch (envError) {
        // Environment variable might already exist, that's okay
        console.log(`⚠️  Environment variable ${varName} might already exist`);
      }
    }
  });

  // Deploy
  execSync('vercel --prod', { stdio: 'inherit' });
  
  console.log('\n🎉 Deployment successful!');
  console.log('\n📋 Next steps:');
  console.log('1. Update your Google Drive OAuth redirect URI to include your Vercel domain');
  console.log('2. Test the application with your production URL');
  console.log('3. Monitor the deployment logs for any issues');
  
} catch (error) {
  console.error('❌ Deployment failed:', error.message);
  console.error('\n💡 Troubleshooting tips:');
  console.error('1. Make sure you\'re logged into Vercel: vercel login');
  console.error('2. Check that all environment variables are set correctly');
  console.error('3. Verify your Google Drive API credentials');
  process.exit(1);
}
