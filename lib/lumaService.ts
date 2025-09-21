import axios from 'axios';

export interface LumaGeneration {
  id: string;
  state: 'completed' | 'processing' | 'failed' | 'queued';
  generation_type: 'video' | 'image';
  created_at: string;
  updated_at: string;
  prompt?: string;
  assets?: {
    video?: string;
    image?: string;
  };
  metadata?: {
    duration?: number;
    resolution?: string;
    aspect_ratio?: string;
    model?: string;
  };
}

export interface LumaResponse {
  generations: LumaGeneration[];
  has_more: boolean;
  total_count?: number;
}

export interface VideoMetadata {
  id: string;
  url: string;
  filename: string;
  size: number;
  duration?: number;
  resolution?: string;
  created_at: string;
  prompt?: string;
}

class LumaService {
  private apiKey: string;
  private baseUrl = 'https://api.lumalabs.ai/dream-machine/v1/generations';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async fetchGenerations(limit = 50, offset = 0, retries = 3): Promise<LumaResponse> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.get(this.baseUrl, {
          headers: this.getHeaders(),
          params: { limit, offset },
          timeout: 30000,
        });

        return response.data;
      } catch (error: any) {
        console.error(`Error fetching generations (attempt ${attempt}/${retries}):`, error.message);
        
        // If it's a 502 Bad Gateway or rate limit, wait longer before retry
        if (error.response?.status === 502 || error.response?.status === 429) {
          if (attempt < retries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }
        
        // If it's the last attempt or a different error, throw
        if (attempt === retries) {
          throw new Error(`Failed to fetch generations after ${retries} attempts: ${error.message}`);
        }
      }
    }
    
    throw new Error('Unexpected error in fetchGenerations');
  }

  async fetchAllVideoGenerations(maxVideos = 1000): Promise<LumaGeneration[]> {
    const allVideos: LumaGeneration[] = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;

    console.log(`Starting to fetch videos (max: ${maxVideos})...`);

    while (hasMore && allVideos.length < maxVideos) {
      try {
        console.log(`Fetching videos ${offset}-${offset + limit - 1}...`);
        const response = await this.fetchGenerations(limit, offset);
        
        // Filter for completed videos only
        const videos = response.generations.filter(
          gen => gen.generation_type === 'video' && 
                 gen.state === 'completed' && 
                 gen.assets?.video
        );

        allVideos.push(...videos);
        
        hasMore = response.has_more;
        offset += limit;
        consecutiveErrors = 0; // Reset error counter on success

        console.log(`Found ${videos.length} videos, total: ${allVideos.length}`);

        // Progressive delay - longer delays as we fetch more
        if (hasMore && allVideos.length < maxVideos) {
          const delay = Math.min(500 + Math.floor(offset / 1000) * 200, 2000); // 500ms to 2s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        consecutiveErrors++;
        console.error(`Error fetching page at offset ${offset} (${consecutiveErrors}/${maxConsecutiveErrors}):`, error);
        
        if (consecutiveErrors >= maxConsecutiveErrors) {
          console.log(`Too many consecutive errors, stopping at ${allVideos.length} videos`);
          break;
        }
        
        // Skip this batch and continue
        offset += limit;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s before trying next batch
      }
    }

    console.log(`Finished fetching ${allVideos.length} videos`);
    return allVideos;
  }

  async getVideoMetadata(videoUrl: string, retries = 2): Promise<{ size: number; contentType: string }> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await axios.head(videoUrl, { 
          timeout: 10000,
          maxRedirects: 5 
        });
        
        return {
          size: parseInt(response.headers['content-length'] || '0', 10),
          contentType: response.headers['content-type'] || 'video/mp4',
        };
      } catch (error: any) {
        if (attempt < retries && (error.code === 'EMFILE' || error.code === 'ECONNRESET')) {
          // Wait before retry for connection issues
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        
        console.error(`Error getting video metadata (attempt ${attempt}):`, error.message);
        return { size: 0, contentType: 'video/mp4' };
      }
    }
    
    return { size: 0, contentType: 'video/mp4' };
  }

  async getBatchVideoMetadata(videoUrls: string[], batchSize = 10): Promise<{ size: number; contentType: string }[]> {
    const results: { size: number; contentType: string }[] = [];
    
    for (let i = 0; i < videoUrls.length; i += batchSize) {
      const batch = videoUrls.slice(i, i + batchSize);
      console.log(`Processing metadata batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(videoUrls.length / batchSize)}`);
      
      const batchPromises = batch.map(url => this.getVideoMetadata(url));
      const batchResults = await Promise.allSettled(batchPromises);
      
      const processedResults = batchResults.map(result => 
        result.status === 'fulfilled' 
          ? result.value 
          : { size: 0, contentType: 'video/mp4' }
      );
      
      results.push(...processedResults);
      
      // Add delay between batches to prevent overwhelming the system
      if (i + batchSize < videoUrls.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return results;
  }

  async downloadVideo(videoUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 60000, // 1 minute timeout for video downloads
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading video:', error);
      throw new Error(`Failed to download video: ${error}`);
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  generateFilename(generation: LumaGeneration): string {
    const timestamp = new Date(generation.created_at).toISOString().replace(/[:.]/g, '-');
    return `luma_${generation.id}_${timestamp}.mp4`;
  }
}

export default LumaService;
