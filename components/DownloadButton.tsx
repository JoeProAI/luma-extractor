'use client';

import { useState } from 'react';
import { Download, Package, Link } from 'lucide-react';

interface DownloadButtonProps {
  selectedVideoIds: string[];
  disabled?: boolean;
  className?: string;
}

export default function DownloadButton({ 
  selectedVideoIds, 
  disabled = false,
  className = '' 
}: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'zip' | 'links'>('zip');

  const handleDownload = async () => {
    if (selectedVideoIds.length === 0 || downloading) return;

    setDownloading(true);
    
    try {
      const response = await fetch('/api/luma/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          videoIds: selectedVideoIds,
          format: downloadFormat 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Download failed');
      }

      if (downloadFormat === 'zip') {
        // Handle ZIP download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `luma-videos-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Handle individual links
        const data = await response.json();
        
        // Create a text file with download links
        const linkText = data.downloads.map((video: any) => 
          `${video.filename}\n${video.url}\nSize: ${video.formattedSize}\nCreated: ${video.created_at}\nPrompt: ${video.prompt || 'N/A'}\n\n`
        ).join('');
        
        const blob = new Blob([linkText], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `luma-video-links-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Download error:', error);
      alert(`Download failed: ${error}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <select
        value={downloadFormat}
        onChange={(e) => setDownloadFormat(e.target.value as 'zip' | 'links')}
        className="input-field text-sm py-1 px-2"
        disabled={downloading}
      >
        <option value="zip">ZIP Archive</option>
        <option value="links">Download Links</option>
      </select>
      
      <button
        onClick={handleDownload}
        disabled={disabled || downloading || selectedVideoIds.length === 0}
        className="btn-secondary flex items-center space-x-2 text-sm"
      >
        {downloading ? (
          <>
            <Package className="w-4 h-4 animate-pulse" />
            <span>Preparing...</span>
          </>
        ) : downloadFormat === 'zip' ? (
          <>
            <Download className="w-4 h-4" />
            <span>Download ZIP ({selectedVideoIds.length})</span>
          </>
        ) : (
          <>
            <Link className="w-4 h-4" />
            <span>Get Links ({selectedVideoIds.length})</span>
          </>
        )}
      </button>
    </div>
  );
}
