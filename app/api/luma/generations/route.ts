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
      // Limit to prevent timeouts and memory issues, but allow more for large collections
      const maxVideos = parseInt(searchParams.get('maxVideos') || '3000');
      const skipMetadata = searchParams.get('skipMetadata') === 'true';
      console.log(`Fetching up to ${maxVideos} videos...`);
      
      // Fetch video generations with limit
      const allVideos = await lumaService.fetchAllVideoGenerations(maxVideos);
      console.log(`Retrieved ${allVideos.length} videos from Luma API`);
      
      if (skipMetadata) {
        // Return videos immediately without metadata to avoid timeouts
        console.log(`Returning ${allVideos.length} videos without metadata to avoid timeout`);
        
        const videosWithBasicInfo = allVideos.map(video => ({
          ...video,
          metadata: {
            ...video.metadata,
            size: 0,
            formattedSize: 'Loading...',
            contentType: 'video/mp4',
          },
        }));

        return NextResponse.json({
          generations: videosWithBasicInfo,
          total_count: videosWithBasicInfo.length,
          has_more: allVideos.length >= maxVideos,
          fetched_count: allVideos.length,
          max_videos: maxVideos,
          metadata_skipped: true,
        });
      }
      
      // Process metadata for smaller collections or when explicitly requested
      const videoUrls = allVideos
        .filter(video => video.assets?.video)
        .map(video => video.assets!.video!);
      
      console.log(`Processing metadata for ${videoUrls.length} videos...`);
      
      // Get metadata in batches to prevent EMFILE errors
      const metadataResults = await lumaService.getBatchVideoMetadata(videoUrls, 8);
      
      // Combine videos with their metadata
      const videosWithMetadata = allVideos.map((video, index) => {
        if (!video.assets?.video) return video;
        
        const metadata = metadataResults[allVideos.filter(v => v.assets?.video).indexOf(video)];
        
        return {
          ...video,
          metadata: {
            ...video.metadata,
            size: metadata?.size || 0,
            formattedSize: lumaService.formatFileSize(metadata?.size || 0),
            contentType: metadata?.contentType || 'video/mp4',
          },
        };
      });

      console.log(`Completed processing ${videosWithMetadata.length} videos`);

      return NextResponse.json({
        generations: videosWithMetadata,
        total_count: videosWithMetadata.length,
        has_more: allVideos.length >= maxVideos,
        fetched_count: allVideos.length,
        max_videos: maxVideos,
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
    
    // Fetch videos with a reasonable limit to find the requested ones
    const allVideos = await lumaService.fetchAllVideoGenerations(2000);
    
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
