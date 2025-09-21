import { NextRequest, NextResponse } from 'next/server';
import GoogleDriveService from '@/lib/googleDriveService';
import LumaService from '@/lib/lumaService';

export async function POST(request: NextRequest) {
  try {
    // Check for required environment variables
    const requiredEnvVars = [
      'GOOGLE_DRIVE_CLIENT_ID',
      'GOOGLE_DRIVE_CLIENT_SECRET',
      'GOOGLE_DRIVE_REDIRECT_URI',
      'GOOGLE_DRIVE_REFRESH_TOKEN',
      'LUMA_API_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return NextResponse.json(
        { error: `Missing environment variables: ${missingVars.join(', ')}` },
        { status: 500 }
      );
    }

    const { videoIds, folderName = 'Luma Labs Videos' } = await request.json();
    
    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'No video IDs provided' },
        { status: 400 }
      );
    }

    // Initialize services
    const driveConfig = {
      clientId: process.env.GOOGLE_DRIVE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
      redirectUri: process.env.GOOGLE_DRIVE_REDIRECT_URI!,
      refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!,
    };

    const driveService = new GoogleDriveService(driveConfig);
    const lumaService = new LumaService(process.env.LUMA_API_KEY!);

    // Create or find the folder
    const folderId = await driveService.findOrCreateFolder(folderName);

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

    // Upload videos to Google Drive
    const uploadResults = await driveService.batchUploadVideos(
      videoBuffers.map(v => ({ buffer: v.buffer, filename: v.filename })),
      folderId
    );

    // Get storage quota info
    const storageQuota = await driveService.getStorageQuota();

    return NextResponse.json({
      success: true,
      folderId,
      folderName,
      uploaded: uploadResults.length,
      failed: videoBuffers.length - uploadResults.length,
      totalSize: videoBuffers.reduce((sum, v) => sum + v.buffer.length, 0),
      storageQuota,
      results: uploadResults.map((result, index) => ({
        ...result,
        originalId: videoBuffers[index]?.id,
      })),
    });

  } catch (error) {
    console.error('Error in /api/drive/upload:', error);
    return NextResponse.json(
      { error: `Upload failed: ${error}` },
      { status: 500 }
    );
  }
}
