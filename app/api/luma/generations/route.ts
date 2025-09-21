import { NextRequest, NextResponse } from 'next/server';
import LumaService from '@/lib/lumaService';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.LUMA_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Luma API key not configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const fetchAll = searchParams.get('fetchAll') === 'true';

    const lumaService = new LumaService(apiKey);

    if (fetchAll) {
      // Fetch all video generations
      const allVideos = await lumaService.fetchAllVideoGenerations();
      
      // Get metadata for each video
      const videosWithMetadata = await Promise.all(
        allVideos.map(async (video) => {
          if (!video.assets?.video) return video;
          
          try {
            const metadata = await lumaService.getVideoMetadata(video.assets.video);
            return {
              ...video,
              metadata: {
                ...video.metadata,
                size: metadata.size,
                formattedSize: lumaService.formatFileSize(metadata.size),
                contentType: metadata.contentType,
              },
            };
          } catch (error) {
            console.error(`Error getting metadata for video ${video.id}:`, error);
            return video;
          }
        })
      );

      return NextResponse.json({
        generations: videosWithMetadata,
        total_count: videosWithMetadata.length,
        has_more: false,
      });
    } else {
      // Fetch paginated results
      const response = await lumaService.fetchGenerations(limit, offset);
      return NextResponse.json(response);
    }
  } catch (error) {
    console.error('Error in /api/luma/generations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch generations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.LUMA_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Luma API key not configured' },
        { status: 500 }
      );
    }

    const { videoIds } = await request.json();
    
    if (!videoIds || !Array.isArray(videoIds)) {
      return NextResponse.json(
        { error: 'Invalid video IDs provided' },
        { status: 400 }
      );
    }

    const lumaService = new LumaService(apiKey);
    
    // Fetch all generations first
    const allVideos = await lumaService.fetchAllVideoGenerations();
    
    // Filter for requested video IDs
    const requestedVideos = allVideos.filter(video => videoIds.includes(video.id));
    
    // Download videos and prepare for upload
    const videoData = await Promise.all(
      requestedVideos.map(async (video) => {
        if (!video.assets?.video) return null;
        
        try {
          const buffer = await lumaService.downloadVideo(video.assets.video);
          const filename = lumaService.generateFilename(video);
          
          return {
            id: video.id,
            buffer: buffer,
            filename: filename,
            size: buffer.length,
            metadata: video,
          };
        } catch (error) {
          console.error(`Error downloading video ${video.id}:`, error);
          return null;
        }
      })
    );

    // Filter out failed downloads
    const successfulDownloads = videoData.filter(Boolean);

    return NextResponse.json({
      success: true,
      downloaded: successfulDownloads.length,
      failed: videoIds.length - successfulDownloads.length,
      videos: successfulDownloads.map(video => ({
        id: video!.id,
        filename: video!.filename,
        size: lumaService.formatFileSize(video!.size),
      })),
    });
  } catch (error) {
    console.error('Error in POST /api/luma/generations:', error);
    return NextResponse.json(
      { error: 'Failed to download videos' },
      { status: 500 }
    );
  }
}
