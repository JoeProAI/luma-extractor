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

  async fetchGenerations(limit = 50, offset = 0): Promise<LumaResponse> {
    try {
      const response = await axios.get(this.baseUrl, {
        headers: this.getHeaders(),
        params: { limit, offset },
        timeout: 30000,
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching generations:', error);
      throw new Error(`Failed to fetch generations: ${error}`);
    }
  }

  async fetchAllVideoGenerations(): Promise<LumaGeneration[]> {
    const allVideos: LumaGeneration[] = [];
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      try {
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

        // Add small delay to avoid rate limiting
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Error fetching page at offset ${offset}:`, error);
        break;
      }
    }

    return allVideos;
  }

  async getVideoMetadata(videoUrl: string): Promise<{ size: number; contentType: string }> {
    try {
      const response = await axios.head(videoUrl, { timeout: 10000 });
      
      return {
        size: parseInt(response.headers['content-length'] || '0', 10),
        contentType: response.headers['content-type'] || 'video/mp4',
      };
    } catch (error) {
      console.error('Error getting video metadata:', error);
      return { size: 0, contentType: 'video/mp4' };
    }
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
