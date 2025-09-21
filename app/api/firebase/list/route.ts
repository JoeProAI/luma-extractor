import { NextRequest, NextResponse } from 'next/server';
import { initializeApp } from 'firebase/app';
import { getStorage, ref, listAll, getDownloadURL, getMetadata } from 'firebase/storage';

export async function GET(request: NextRequest) {
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

    // Get folder parameter
    const searchParams = request.nextUrl.searchParams;
    const folder = searchParams.get('folder') || '';

    // List files in the specified folder
    const storageRef = ref(storage, folder);
    const result = await listAll(storageRef);

    // Get file details
    const files = await Promise.all(
      result.items.map(async (itemRef) => {
        try {
          const [downloadURL, metadata] = await Promise.all([
            getDownloadURL(itemRef),
            getMetadata(itemRef)
          ]);

          return {
            name: itemRef.name,
            fullPath: itemRef.fullPath,
            downloadURL,
            size: metadata.size,
            timeCreated: metadata.timeCreated,
            contentType: metadata.contentType,
          };
        } catch (error) {
          console.error(`Error getting details for ${itemRef.name}:`, error);
          return null;
        }
      })
    );

    // Filter out failed items and sort by creation time
    const validFiles = files
      .filter(Boolean)
      .sort((a, b) => new Date(b!.timeCreated).getTime() - new Date(a!.timeCreated).getTime());

    // Get folder names
    const folders = result.prefixes.map(prefix => ({
      name: prefix.name,
      fullPath: prefix.fullPath,
    }));

    return NextResponse.json({
      success: true,
      files: validFiles,
      folders,
      currentFolder: folder,
      totalFiles: validFiles.length,
    });

  } catch (error) {
    console.error('Error listing Firebase files:', error);
    return NextResponse.json(
      { error: `Failed to list files: ${error}` },
      { status: 500 }
    );
  }
}
