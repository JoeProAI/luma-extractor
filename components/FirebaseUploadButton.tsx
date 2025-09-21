'use client';

import { useState } from 'react';
import { Upload, Cloud, Loader2 } from 'lucide-react';

interface FirebaseUploadButtonProps {
  selectedVideoIds: string[];
  disabled?: boolean;
  className?: string;
}

export default function FirebaseUploadButton({ 
  selectedVideoIds, 
  disabled = false,
  className = '' 
}: FirebaseUploadButtonProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (selectedVideoIds.length === 0 || uploading) return;

    setUploading(true);
    
    try {
      const response = await fetch('/api/firebase/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          videoIds: selectedVideoIds,
          folderName: 'luma-videos'
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      // Show success message
      alert(`✅ Successfully uploaded ${result.uploaded} videos to Firebase Storage!\n\nFolder: ${result.folderPath}\nTotal size: ${result.totalSize}`);
      
    } catch (error) {
      console.error('Upload error:', error);
      alert(`❌ Upload failed: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <button
      onClick={handleUpload}
      disabled={disabled || uploading || selectedVideoIds.length === 0}
      className={`btn-primary flex items-center space-x-2 ${className}`}
    >
      {uploading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Uploading...</span>
        </>
      ) : (
        <>
          <Cloud className="w-4 h-4" />
          <span>Upload to Firebase ({selectedVideoIds.length})</span>
        </>
      )}
    </button>
  );
}
