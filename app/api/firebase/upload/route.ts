import { NextRequest, NextResponse } from 'next/server';
import FirebaseService from '@/lib/firebaseService';
import LumaService from '@/lib/lumaService';

export async function POST(request: NextRequest) {
  try {
    // Check for required environment variables
    const requiredEnvVars = [
      'FIREBASE_API_KEY',
      'FIREBASE_AUTH_DOMAIN',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_STORAGE_BUCKET',
      'FIREBASE_MESSAGING_SENDER_ID',
      'FIREBASE_APP_ID',
      'LUMA_API_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return NextResponse.json(
        { error: `Missing environment variables: ${missingVars.join(', ')}` },
        { status: 500 }
      );
    }

    const { videoIds, folderName = 'luma-videos' } = await request.json();
    
    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'No video IDs provided' },
        { status: 400 }
      );
    }

    // Initialize Firebase service
    const firebaseConfig = {
      apiKey: process.env.FIREBASE_API_KEY!,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.FIREBASE_PROJECT_ID!,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.FIREBASE_APP_ID!,
    };

    const firebaseService = new FirebaseService(firebaseConfig);
    const lumaService = new LumaService(process.env.LUMA_API_KEY!);

    // Fetch all video generations
    const allVideos = await lumaService.fetchAllVideoGenerations();
    
    // Filter for requested videos
    const requestedVideos = allVideos.filter(video => videoIds.includes(video.id));

    if (requestedVideos.length === 0) {
      return NextResponse.json(
        { error: 'No valid videos found for the provided IDs' },
        { status: 404 }
      );
    }

    // Download and prepare videos for upload
    const videoBuffers: Array<{ buffer: Buffer; filename: string; id: string }> = [];
    
    for (const video of requestedVideos) {
      if (!video.assets?.video) continue;
      
      try {
        const buffer = await lumaService.downloadVideo(video.assets.video);
        const filename = lumaService.generateFilename(video);
        
        videoBuffers.push({
          buffer,
          filename,
          id: video.id,
        });
      } catch (error) {
        console.error(`Failed to download video ${video.id}:`, error);
      }
    }

    if (videoBuffers.length === 0) {
      return NextResponse.json(
        { error: 'Failed to download any videos' },
        { status: 500 }
      );
    }

    // Create organized folder path based on current date
    const folderPath = firebaseService.generateFolderPath();

    // Upload videos to Firebase Storage
    const uploadResults = await firebaseService.batchUploadVideos(
      videoBuffers.map(v => ({ buffer: v.buffer, filename: v.filename })),
      folderPath
    );

    // Calculate total size
    const totalSize = videoBuffers.reduce((sum, v) => sum + v.buffer.length, 0);

    return NextResponse.json({
      success: true,
      folderPath,
      uploaded: uploadResults.length,
      failed: videoBuffers.length - uploadResults.length,
      totalSize: firebaseService.formatBytes(totalSize),
      results: uploadResults.map((result, index) => ({
        ...result,
        originalId: videoBuffers[index]?.id,
      })),
    });

  } catch (error) {
    console.error('Error in /api/firebase/upload:', error);
    return NextResponse.json(
      { error: `Upload failed: ${error}` },
      { status: 500 }
    );
  }
}
