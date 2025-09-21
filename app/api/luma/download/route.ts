import { NextRequest, NextResponse } from 'next/server';
import LumaService from '@/lib/lumaService';
import JSZip from 'jszip';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.LUMA_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Luma API key not configured' },
        { status: 500 }
      );
    }

    const { videoIds, format = 'zip' } = await request.json();
    
    if (!videoIds || !Array.isArray(videoIds) || videoIds.length === 0) {
      return NextResponse.json(
        { error: 'No video IDs provided' },
        { status: 400 }
      );
    }

    const lumaService = new LumaService(apiKey);
    
    // Fetch all generations to get the requested videos
    const allVideos = await lumaService.fetchAllVideoGenerations();
    const requestedVideos = allVideos.filter(video => videoIds.includes(video.id));

    if (requestedVideos.length === 0) {
      return NextResponse.json(
        { error: 'No valid videos found for the provided IDs' },
        { status: 404 }
      );
    }

    if (format === 'zip') {
      // Create a ZIP file containing all videos
      const zip = new JSZip();
      let totalSize = 0;

      for (const video of requestedVideos) {
        if (!video.assets?.video) continue;
        
        try {
          const buffer = await lumaService.downloadVideo(video.assets.video);
          const filename = lumaService.generateFilename(video);
          
          zip.file(filename, buffer);
          totalSize += buffer.length;
        } catch (error) {
          console.error(`Failed to download video ${video.id}:`, error);
          // Add error info to zip
          zip.file(`ERROR_${video.id}.txt`, `Failed to download: ${error}`);
        }
      }

      // Add metadata file
      const metadata = {
        downloadDate: new Date().toISOString(),
        totalVideos: requestedVideos.length,
        totalSize: lumaService.formatFileSize(totalSize),
        videos: requestedVideos.map(video => ({
          id: video.id,
          filename: lumaService.generateFilename(video),
          created_at: video.created_at,
          prompt: video.prompt,
          metadata: video.metadata,
        })),
      };

      zip.file('metadata.json', JSON.stringify(metadata, null, 2));

      // Generate ZIP buffer
      const zipBuffer = await zip.generateAsync({ 
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 1 } // Fast compression
      });

      // Return ZIP file
      return new NextResponse(zipBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="luma-videos-${new Date().toISOString().split('T')[0]}.zip"`,
          'Content-Length': zipBuffer.length.toString(),
        },
      });

    } else {
      // Return individual download links
      const downloadLinks = await Promise.all(
        requestedVideos.map(async (video) => {
          if (!video.assets?.video) return null;
          
          try {
            const metadata = await lumaService.getVideoMetadata(video.assets.video);
            return {
              id: video.id,
              filename: lumaService.generateFilename(video),
              url: video.assets.video,
              size: metadata.size,
              formattedSize: lumaService.formatFileSize(metadata.size),
              created_at: video.created_at,
              prompt: video.prompt,
            };
          } catch (error) {
            console.error(`Error getting metadata for video ${video.id}:`, error);
            return null;
          }
        })
      );

      const validLinks = downloadLinks.filter(Boolean);

      return NextResponse.json({
        success: true,
        total: validLinks.length,
        downloads: validLinks,
      });
    }

  } catch (error) {
    console.error('Error in /api/luma/download:', error);
    return NextResponse.json(
      { error: `Download failed: ${error}` },
      { status: 500 }
    );
  }
}
