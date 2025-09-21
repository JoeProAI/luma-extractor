import { NextRequest, NextResponse } from 'next/server';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import JSZip from 'jszip';

export async function POST(request: NextRequest) {
  try {
    // Check for required environment variables
    const requiredEnvVars = [
      'FIREBASE_API_KEY',
      'FIREBASE_AUTH_DOMAIN',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_STORAGE_BUCKET',
      'FIREBASE_MESSAGING_SENDER_ID',
      'FIREBASE_APP_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return NextResponse.json(
        { error: `Missing environment variables: ${missingVars.join(', ')}` },
        { status: 500 }
      );
    }

    const { filePaths } = await request.json();
    
    if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
      return NextResponse.json(
        { error: 'No file paths provided' },
        { status: 400 }
      );
    }

    // Limit to prevent timeouts
    if (filePaths.length > 50) {
      return NextResponse.json(
        { error: 'Too many files selected. Please select 50 or fewer files at a time.' },
        { status: 400 }
      );
    }

    // Initialize Firebase
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY!,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.FIREBASE_PROJECT_ID!,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.FIREBASE_APP_ID!,
    };

    const app = initializeApp(firebaseConfig);
    const storage = getStorage(app);

    // Create ZIP file
    const zip = new JSZip();
    let successCount = 0;

    for (const filePath of filePaths) {
      try {
        console.log(`Getting download URL for: ${filePath}`);
        const storageRef = ref(storage, filePath);
        const downloadURL = await getDownloadURL(storageRef);
        
        // Download the file
        const response = await fetch(downloadURL);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const buffer = await response.arrayBuffer();
        const fileName = filePath.split('/').pop() || `file_${successCount}`;
        
        zip.file(fileName, buffer);
        successCount++;
        
      } catch (error) {
        console.error(`Failed to download ${filePath}:`, error);
        // Add error info to zip
        zip.file(`ERROR_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}.txt`, 
          `Failed to download ${filePath}: ${error}`);
      }
    }

    if (successCount === 0) {
      return NextResponse.json(
        { error: 'Failed to download any files' },
        { status: 500 }
      );
    }

    // Add metadata
    const metadata = {
      downloadDate: new Date().toISOString(),
      requestedFiles: filePaths.length,
      successfulDownloads: successCount,
      failedDownloads: filePaths.length - successCount,
    };

    zip.file('download_info.json', JSON.stringify(metadata, null, 2));

    // Generate ZIP
    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 } // Fast compression
    });

    // Return ZIP file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="firebase-videos-${new Date().toISOString().split('T')[0]}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error('Error downloading from Firebase:', error);
    return NextResponse.json(
      { error: `Download failed: ${error}` },
      { status: 500 }
    );
  }
}
