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
    
    // For large collections, limit the search to avoid timeouts
    const maxVideos = Math.min(videoIds.length * 10, 2000); // Search reasonable range
    const allVideos = await lumaService.fetchAllVideoGenerations(maxVideos);
    const requestedVideos = allVideos.filter(video => videoIds.includes(video.id));

    if (requestedVideos.length === 0) {
      return NextResponse.json(
        { error: 'No valid videos found for the provided IDs' },
        { status: 404 }
      );
    }

    if (format === 'zip') {
      // For large collections, ZIP download is not practical due to size and timeout limits
      // Instead, return an error suggesting to use individual links
      if (requestedVideos.length > 10) {
        return NextResponse.json({
          error: `ZIP download not supported for ${requestedVideos.length} videos. Please use "Download Links" option instead for large collections.`,
          suggestion: 'Use the "Download Links" option to get direct URLs for all videos.'
        }, { status: 400 });
      }

      // For small collections (≤10 videos), create ZIP
      const zip = new JSZip();
      let totalSize = 0;
      let successCount = 0;

      for (const video of requestedVideos) {
        if (!video.assets?.video) continue;
        
        try {
          console.log(`Downloading video ${video.id}...`);
          const buffer = await lumaService.downloadVideo(video.assets.video);
          const filename = lumaService.generateFilename(video);
          
          zip.file(filename, buffer);
          totalSize += buffer.length;
          successCount++;
        } catch (error) {
          console.error(`Failed to download video ${video.id}:`, error);
          // Add error info to zip
          zip.file(`ERROR_${video.id}.txt`, `Failed to download: ${error}`);
        }
      }

      if (successCount === 0) {
        return NextResponse.json({
          error: 'Failed to download any videos. Please try individual links instead.'
        }, { status: 500 });
      }

      // Add metadata file
      const metadata = {
        downloadDate: new Date().toISOString(),
        totalVideos: requestedVideos.length,
        successfulDownloads: successCount,
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
      // Return individual download links (much faster, no metadata fetching)
      const downloadLinks = requestedVideos
        .filter(video => video.assets?.video)
        .map(video => ({
          id: video.id,
          filename: lumaService.generateFilename(video),
          url: video.assets.video,
          size: 0, // Skip metadata for speed
          formattedSize: 'Unknown',
          created_at: video.created_at,
          prompt: video.prompt || 'No prompt available',
          downloadInstructions: 'Right-click the URL and select "Save link as..." to download'
        }));

      return NextResponse.json({
        success: true,
        total: downloadLinks.length,
        downloads: downloadLinks,
        note: 'Use these direct URLs to download videos individually. Right-click each URL and select "Save link as..."'
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
