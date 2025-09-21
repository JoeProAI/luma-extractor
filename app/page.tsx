'use client';

import { useState, useEffect } from 'react';
import { 
  Download, 
  Upload, 
  RefreshCw, 
  CheckSquare, 
  Square, 
  Search,
  Filter,
  Calendar,
  HardDrive,
  Video,
  AlertCircle
} from 'lucide-react';
import VideoCard from '@/components/VideoCard';
import ProgressModal from '@/components/ProgressModal';
import DownloadButton from '@/components/DownloadButton';
import FirebaseUploadButton from '@/components/FirebaseUploadButton';

interface LumaGeneration {
  id: string;
  state: string;
  generation_type: string;
  created_at: string;
  prompt?: string;
  assets?: {
    video?: string;
  };
  metadata?: {
    size?: number;
    formattedSize?: string;
    duration?: number;
    resolution?: string;
  };
}

interface ProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  details?: string;
}

export default function HomePage() {
  const [videos, setVideos] = useState<LumaGeneration[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'size'>('date');
  const [filterBy, setFilterBy] = useState<'all' | 'large' | 'recent'>('all');
  
  // Progress modal state
  const [showProgress, setShowProgress] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [progressTitle, setProgressTitle] = useState('');
  const [canCloseProgress, setCanCloseProgress] = useState(false);

  // Stats
  const [totalSize, setTotalSize] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    setLoading(true);
    try {
      // For large collections, skip metadata initially to avoid timeouts
      const response = await fetch('/api/luma/generations?fetchAll=true&skipMetadata=true');
      const data = await response.json();
      
      if (response.ok) {
        setVideos(data.generations || []);
        setTotalCount(data.total_count || 0);
        
        // Calculate total size (will be 0 initially if metadata was skipped)
        const size = data.generations?.reduce((sum: number, video: LumaGeneration) => {
          return sum + (video.metadata?.size || 0);
        }, 0) || 0;
        setTotalSize(size);

        // Show success message for large collections
        if (data.metadata_skipped && data.total_count > 1000) {
          console.log(`Successfully loaded ${data.total_count} videos! File sizes will load in the background.`);
        }
      } else {
        console.error('Failed to fetch videos:', data.error);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelect = (videoId: string, selected: boolean) => {
    const newSelected = new Set(selectedVideos);
    if (selected) {
      newSelected.add(videoId);
    } else {
      newSelected.delete(videoId);
    }
    setSelectedVideos(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedVideos.size === filteredVideos.length) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(filteredVideos.map(v => v.id)));
    }
  };

  const handleUploadToGoogleDrive = async () => {
    if (selectedVideos.size === 0) return;

    setProgressTitle('Uploading to Google Drive');
    setCanCloseProgress(false);
    setProgressSteps([
      { id: 'download', label: 'Downloading videos from Luma Labs', status: 'processing', progress: 0 },
      { id: 'upload', label: 'Uploading to Google Drive', status: 'pending' },
      { id: 'complete', label: 'Upload complete', status: 'pending' },
    ]);
    setShowProgress(true);

    try {
      // Step 1: Download videos
      setProgressSteps(prev => prev.map(step => 
        step.id === 'download' 
          ? { ...step, status: 'processing', progress: 50 }
          : step
      ));

      const videoIds = Array.from(selectedVideos);
      const response = await fetch('/api/drive/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoIds }),
      });

      const result = await response.json();

      if (response.ok) {
        // Step 2: Upload complete
        setProgressSteps(prev => prev.map(step => {
          if (step.id === 'download') {
            return { ...step, status: 'completed', progress: 100 };
          }
          if (step.id === 'upload') {
            return { ...step, status: 'completed', details: `${result.uploaded} videos uploaded successfully` };
          }
          if (step.id === 'complete') {
            return { 
              ...step, 
              status: 'completed', 
              details: `Folder: ${result.folderName} | Total size: ${formatBytes(result.totalSize)}`
            };
          }
          return step;
        }));
        
        setCanCloseProgress(true);
        setSelectedVideos(new Set()); // Clear selection
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      setProgressSteps(prev => prev.map(step => 
        step.status === 'processing' || step.status === 'pending'
          ? { ...step, status: 'error', details: `Error: ${error}` }
          : step
      ));
      setCanCloseProgress(true);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter and sort videos
  const filteredVideos = videos
    .filter(video => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          video.prompt?.toLowerCase().includes(searchLower) ||
          video.id.toLowerCase().includes(searchLower)
        );
      }
      return true;
    })
    .filter(video => {
      // Category filter
      switch (filterBy) {
        case 'large':
          return (video.metadata?.size || 0) > 10 * 1024 * 1024; // > 10MB
        case 'recent':
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return new Date(video.created_at) > weekAgo;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'size':
          return (b.metadata?.size || 0) - (a.metadata?.size || 0);
        case 'date':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const selectedSize = videos
    .filter(v => selectedVideos.has(v.id))
    .reduce((sum, v) => sum + (v.metadata?.size || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center space-x-3">
            <Video className="w-8 h-8 text-primary-600" />
            <div>
              <p className="text-sm text-gray-600">Total Videos</p>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center space-x-3">
            <HardDrive className="w-8 h-8 text-success-600" />
            <div>
              <p className="text-sm text-gray-600">Total Size</p>
              <p className="text-2xl font-bold text-gray-900">{formatBytes(totalSize)}</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center space-x-3">
            <CheckSquare className="w-8 h-8 text-warning-600" />
            <div>
              <p className="text-sm text-gray-600">Selected</p>
              <p className="text-2xl font-bold text-gray-900">{selectedVideos.size}</p>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="flex items-center space-x-3">
            <Upload className="w-8 h-8 text-indigo-600" />
            <div>
              <p className="text-sm text-gray-600">Selected Size</p>
              <p className="text-2xl font-bold text-gray-900">{formatBytes(selectedSize)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search videos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10 w-full sm:w-64"
              />
            </div>

            {/* Filters */}
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as any)}
              className="input-field w-full sm:w-auto"
            >
              <option value="all">All Videos</option>
              <option value="recent">Recent (7 days)</option>
              <option value="large">Large Files (&gt;10MB)</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input-field w-full sm:w-auto"
            >
              <option value="date">Sort by Date</option>
              <option value="size">Sort by Size</option>
            </select>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={fetchVideos}
              disabled={loading}
              className="btn-secondary flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleSelectAll}
              className="btn-secondary flex items-center space-x-2"
            >
              {selectedVideos.size === filteredVideos.length ? (
                <Square className="w-4 h-4" />
              ) : (
                <CheckSquare className="w-4 h-4" />
              )}
              <span>
                {selectedVideos.size === filteredVideos.length ? 'Deselect All' : 'Select All'}
              </span>
            </button>

            <DownloadButton
              selectedVideoIds={Array.from(selectedVideos)}
              disabled={selectedVideos.size === 0}
            />

            <FirebaseUploadButton
              selectedVideoIds={Array.from(selectedVideos)}
              disabled={selectedVideos.size === 0}
            />
          </div>
        </div>
      </div>

      {/* Video List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center space-x-3">
            <RefreshCw className="w-6 h-6 animate-spin text-primary-600" />
            <span className="text-lg text-gray-600">Loading your videos...</span>
          </div>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No videos found</h3>
          <p className="text-gray-600">
            {videos.length === 0 
              ? "You haven't generated any videos yet, or your API key might be incorrect."
              : "No videos match your current search and filter criteria."
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isSelected={selectedVideos.has(video.id)}
              onSelect={handleVideoSelect}
            />
          ))}
        </div>
      )}

      {/* Progress Modal */}
      <ProgressModal
        isOpen={showProgress}
        onClose={() => setShowProgress(false)}
        title={progressTitle}
        steps={progressSteps}
        canClose={canCloseProgress}
      />
    </div>
  );
}
