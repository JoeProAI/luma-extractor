'use client';

import { useState, useEffect } from 'react';
import { Download, Folder, Video, RefreshCw } from 'lucide-react';

interface FirebaseFile {
  name: string;
  fullPath: string;
  downloadURL: string;
  size: number;
  timeCreated: string;
}

export default function FirebaseBrowser() {
  const [files, setFiles] = useState<FirebaseFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [currentFolder, setCurrentFolder] = useState('');

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/firebase/list?folder=${currentFolder}`);
      const data = await response.json();
      
      if (response.ok) {
        setFiles(data.files || []);
      } else {
        console.error('Failed to fetch files:', data.error);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [currentFolder]);

  const handleFileSelect = (filePath: string, selected: boolean) => {
    const newSelected = new Set(selectedFiles);
    if (selected) {
      newSelected.add(filePath);
    } else {
      newSelected.delete(filePath);
    }
    setSelectedFiles(newSelected);
  };

  const downloadSelected = async () => {
    const selectedFilesList = Array.from(selectedFiles);
    if (selectedFilesList.length === 0) return;

    try {
      const response = await fetch('/api/firebase/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePaths: selectedFilesList }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `firebase-videos-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const error = await response.json();
        alert(`Download failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      alert(`Download failed: ${error}`);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const folders = [...new Set(files.map(file => file.fullPath.split('/')[0]))].filter(Boolean);
  const currentFiles = files.filter(file => 
    currentFolder ? file.fullPath.startsWith(currentFolder + '/') : true
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Firebase Storage Browser</h1>
              <p className="text-white/70">Browse and download your uploaded videos</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchFiles}
                disabled={loading}
                className="btn-secondary flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              
              <button
                onClick={downloadSelected}
                disabled={selectedFiles.size === 0}
                className="btn-primary flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download Selected ({selectedFiles.size})</span>
              </button>
            </div>
          </div>

          {/* Folder Navigation */}
          <div className="mb-6">
            <div className="flex items-center space-x-2 mb-4">
              <Folder className="w-5 h-5 text-white/70" />
              <span className="text-white/70">Current folder:</span>
              <span className="text-white font-medium">
                {currentFolder || 'Root'}
              </span>
              {currentFolder && (
                <button
                  onClick={() => setCurrentFolder('')}
                  className="text-blue-300 hover:text-blue-200 text-sm"
                >
                  ← Back to root
                </button>
              )}
            </div>
            
            {folders.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {folders.map(folder => (
                  <button
                    key={folder}
                    onClick={() => setCurrentFolder(folder)}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                      currentFolder === folder
                        ? 'bg-blue-500 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    📁 {folder}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Files Grid */}
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-white/50" />
              <p className="text-white/70">Loading files...</p>
            </div>
          ) : currentFiles.length === 0 ? (
            <div className="text-center py-12">
              <Video className="w-12 h-12 mx-auto mb-4 text-white/30" />
              <p className="text-white/50">No files found in this folder</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentFiles.map(file => (
                <div
                  key={file.fullPath}
                  className="bg-white/5 rounded-lg p-4 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.fullPath)}
                        onChange={(e) => handleFileSelect(file.fullPath, e.target.checked)}
                        className="rounded border-white/30 bg-white/10 text-blue-500"
                      />
                      <Video className="w-5 h-5 text-blue-400" />
                    </div>
                    
                    <a
                      href={file.downloadURL}
                      download
                      className="text-blue-300 hover:text-blue-200 transition-colors"
                      title="Direct download"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                  
                  <h3 className="text-white font-medium text-sm mb-2 truncate" title={file.name}>
                    {file.name}
                  </h3>
                  
                  <div className="text-xs text-white/50 space-y-1">
                    <div>Size: {formatFileSize(file.size)}</div>
                    <div>Created: {new Date(file.timeCreated).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
