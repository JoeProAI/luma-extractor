#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up Luma Extractor...\n');

// Check if .env.local exists
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env.local from template...');
  const examplePath = path.join(process.cwd(), '.env.example');
  if (fs.existsSync(examplePath)) {
    fs.copyFileSync(examplePath, envPath);
    console.log('✅ Created .env.local - Please fill in your API keys\n');
  } else {
    console.log('❌ .env.example not found\n');
  }
} else {
  console.log('✅ .env.local already exists\n');
}

// Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed successfully\n');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Check environment variables
console.log('🔍 Checking environment configuration...');
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
  console.log('⚠️  Missing environment variables:');
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  console.log('\n📖 Please check the README.md for setup instructions\n');
} else {
  console.log('✅ All environment variables configured\n');
}

// Create directories
const dirs = ['temp', 'downloads'];
dirs.forEach(dir => {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`📁 Created ${dir} directory`);
  }
});

console.log('\n🎉 Setup complete!');
console.log('\n📋 Next steps:');
console.log('1. Fill in your API keys in .env.local');
console.log('2. Run: npm run dev');
console.log('3. Open: http://localhost:3000');
console.log('\n📖 For detailed setup instructions, see README.md');
