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
    const format = searchParams.get('format') || 'json'; // json or txt
    const maxVideos = parseInt(searchParams.get('maxVideos') || '5000');
    
    console.log(`Bulk download request: format=${format}, maxVideos=${maxVideos}`);

    const lumaService = new LumaService(apiKey);
    
    // Fetch ALL videos without any display limits
    console.log('Fetching all videos for bulk download...');
    const allVideos = await lumaService.fetchAllVideoGenerations(maxVideos);
    console.log(`Retrieved ${allVideos.length} videos for bulk download`);
    
    // Filter for videos with download URLs
    const downloadableVideos = allVideos.filter(video => video.assets?.video);
    console.log(`${downloadableVideos.length} videos have download URLs`);

    if (format === 'txt') {
      // Return as text file with download URLs
      const textContent = downloadableVideos.map(video => {
        const filename = lumaService.generateFilename(video);
        return `${filename}\n${video.assets!.video}\nCreated: ${video.created_at}\nPrompt: ${video.prompt || 'N/A'}\n`;
      }).join('\n');

      return new NextResponse(textContent, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="all-luma-videos-${new Date().toISOString().split('T')[0]}.txt"`,
        },
      });
    } else {
      // Return as JSON with all video data
      const videoData = downloadableVideos.map(video => ({
        id: video.id,
        filename: lumaService.generateFilename(video),
        downloadUrl: video.assets!.video,
        created_at: video.created_at,
        prompt: video.prompt,
        state: video.state,
        generation_type: video.generation_type,
      }));

      return NextResponse.json({
        success: true,
        total_found: allVideos.length,
        downloadable_count: downloadableVideos.length,
        videos: videoData,
        bulk_download: true,
        note: `All ${downloadableVideos.length} downloadable videos included (no 1000 video limit)`
      });
    }

  } catch (error) {
    console.error('Error in bulk download:', error);
    return NextResponse.json(
      { error: `Bulk download failed: ${error}` },
      { status: 500 }
    );
  }
}
