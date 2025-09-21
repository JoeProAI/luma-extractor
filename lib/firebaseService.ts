import { initializeApp } from 'firebase/app';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  uploadBytesResumable,
  UploadTaskSnapshot 
} from 'firebase/storage';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface FirebaseUploadResult {
  id: string;
  name: string;
  downloadURL: string;
  size: number;
  path: string;
}

class FirebaseService {
  private storage: any;
  private app: any;

  constructor(config: FirebaseConfig) {
    this.app = initializeApp(config);
    this.storage = getStorage(this.app);
  }

  async uploadVideo(
    videoBuffer: Buffer,
    filename: string,
    folderPath: string = 'luma-videos',
    onProgress?: (progress: number) => void
  ): Promise<FirebaseUploadResult> {
    try {
      const fullPath = `${folderPath}/${filename}`;
      const storageRef = ref(this.storage, fullPath);
      
      if (onProgress) {
        // Use resumable upload for progress tracking
        const uploadTask = uploadBytesResumable(storageRef, videoBuffer, {
          contentType: 'video/mp4',
        });

        return new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot: UploadTaskSnapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              onProgress(Math.round(progress));
            },
            (error) => {
              console.error('Upload error:', error);
              reject(new Error(`Upload failed: ${error.message}`));
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve({
                  id: uploadTask.snapshot.ref.name,
                  name: filename,
                  downloadURL,
                  size: videoBuffer.length,
                  path: fullPath,
                });
              } catch (error) {
                reject(error);
              }
            }
          );
        });
      } else {
        // Simple upload without progress
        const snapshot = await uploadBytes(storageRef, videoBuffer, {
          contentType: 'video/mp4',
        });
        
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        return {
          id: snapshot.ref.name,
          name: filename,
          downloadURL,
          size: videoBuffer.length,
          path: fullPath,
        };
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      throw new Error(`Failed to upload video: ${error}`);
    }
  }

  async batchUploadVideos(
    videos: Array<{ buffer: Buffer; filename: string }>,
    folderPath: string = 'luma-videos',
    onProgress?: (current: number, total: number, currentFileProgress: number) => void
  ): Promise<FirebaseUploadResult[]> {
    const results: FirebaseUploadResult[] = [];
    
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      
      try {
        const result = await this.uploadVideo(
          video.buffer,
          video.filename,
          folderPath,
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

  async createFolder(folderName: string): Promise<string> {
    // Firebase Storage doesn't have explicit folders, but we can simulate them with paths
    return `${folderName}/`;
  }

  async listFiles(folderPath: string = 'luma-videos'): Promise<any[]> {
    // Note: Firebase Storage doesn't have a direct list operation in the client SDK
    // This would typically be done server-side or with Firebase Admin SDK
    // For now, we'll return an empty array and handle this in the backend
    console.warn('File listing should be implemented server-side with Firebase Admin SDK');
    return [];
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Generate organized folder structure
  generateFolderPath(date?: string): string {
    const now = date ? new Date(date) : new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    
    return `luma-videos/${year}/${month}`;
  }

  // Get storage usage (requires Firebase Admin SDK on server-side)
  async getStorageUsage(): Promise<{ used: string; limit: string }> {
    // This would need to be implemented server-side
    return {
      used: 'Unknown',
      limit: '5GB (Free Tier)',
    };
  }
}

export default FirebaseService;
