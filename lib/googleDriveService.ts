import { google } from 'googleapis';
import { Readable } from 'stream';

export interface DriveUploadResult {
  id: string;
  name: string;
  webViewLink: string;
  size: string;
}

export interface DriveConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
}

class GoogleDriveService {
  private drive: any;
  private auth: any;

  constructor(config: DriveConfig) {
    this.auth = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );

    this.auth.setCredentials({
      refresh_token: config.refreshToken,
    });

    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  async createFolder(name: string, parentId?: string): Promise<string> {
    try {
      const fileMetadata = {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined,
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
      });

      return response.data.id;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw new Error(`Failed to create folder: ${error}`);
    }
  }

  async findOrCreateFolder(name: string, parentId?: string): Promise<string> {
    try {
      // Search for existing folder
      const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false${
        parentId ? ` and '${parentId}' in parents` : ''
      }`;

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      // Create folder if it doesn't exist
      return await this.createFolder(name, parentId);
    } catch (error) {
      console.error('Error finding or creating folder:', error);
      throw new Error(`Failed to find or create folder: ${error}`);
    }
  }

  async uploadVideo(
    videoBuffer: Buffer,
    filename: string,
    folderId?: string,
    onProgress?: (progress: number) => void
  ): Promise<DriveUploadResult> {
    try {
      const fileMetadata = {
        name: filename,
        parents: folderId ? [folderId] : undefined,
      };

      const media = {
        mimeType: 'video/mp4',
        body: Readable.from(videoBuffer),
      };

      // Create a progress tracking stream if callback provided
      if (onProgress) {
        let uploaded = 0;
        const totalSize = videoBuffer.length;
        
        const originalBody = media.body;
        media.body = new Readable({
          read() {
            const chunk = originalBody.read();
            if (chunk) {
              uploaded += chunk.length;
              const progress = Math.round((uploaded / totalSize) * 100);
              onProgress(progress);
            }
            this.push(chunk);
          }
        });
      }

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink, size',
      });

      return {
        id: response.data.id,
        name: response.data.name,
        webViewLink: response.data.webViewLink,
        size: response.data.size || '0',
      };
    } catch (error) {
      console.error('Error uploading video:', error);
      throw new Error(`Failed to upload video: ${error}`);
    }
  }

  async batchUploadVideos(
    videos: Array<{ buffer: Buffer; filename: string }>,
    folderId?: string,
    onProgress?: (current: number, total: number, currentFileProgress: number) => void
  ): Promise<DriveUploadResult[]> {
    const results: DriveUploadResult[] = [];
    
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      
      try {
        const result = await this.uploadVideo(
          video.buffer,
          video.filename,
          folderId,
          (fileProgress) => {
            if (onProgress) {
              onProgress(i + 1, videos.length, fileProgress);
            }
          }
        );
        
        results.push(result);
      } catch (error) {
        console.error(`Failed to upload ${video.filename}:`, error);
        // Continue with other uploads even if one fails
      }
    }

    return results;
  }

  async listFiles(folderId?: string, pageSize = 100): Promise<any[]> {
    try {
      const query = folderId 
        ? `'${folderId}' in parents and trashed=false`
        : 'trashed=false';

      const response = await this.drive.files.list({
        q: query,
        pageSize: pageSize,
        fields: 'files(id, name, size, createdTime, webViewLink, mimeType)',
      });

      return response.data.files || [];
    } catch (error) {
      console.error('Error listing files:', error);
      throw new Error(`Failed to list files: ${error}`);
    }
  }

  async getStorageQuota(): Promise<{ used: string; limit: string; available: string }> {
    try {
      const response = await this.drive.about.get({
        fields: 'storageQuota',
      });

      const quota = response.data.storageQuota;
      const used = parseInt(quota.usage || '0');
      const limit = parseInt(quota.limit || '0');
      const available = limit - used;

      return {
        used: this.formatBytes(used),
        limit: this.formatBytes(limit),
        available: this.formatBytes(available),
      };
    } catch (error) {
      console.error('Error getting storage quota:', error);
      return { used: 'Unknown', limit: 'Unknown', available: 'Unknown' };
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default GoogleDriveService;
