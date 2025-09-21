'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Play, Download, Calendar, Clock, Monitor } from 'lucide-react';

interface VideoCardProps {
  video: {
    id: string;
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
  };
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
}

export default function VideoCard({ video, isSelected, onSelect }: VideoCardProps) {
  const [imageError, setImageError] = useState(false);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSelect(video.id, e.target.checked);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Unknown date';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm');
    } catch {
      return '';
    }
  };

  const getThumbnailUrl = (videoUrl?: string) => {
    if (!videoUrl) return null;
    // Try to generate a thumbnail URL (this might need adjustment based on Luma's CDN)
    return videoUrl.replace('.mp4', '_thumbnail.jpg');
  };

  return (
    <div className={`card transition-all duration-200 hover:shadow-md ${
      isSelected ? 'ring-2 ring-primary-500 bg-primary-50' : ''
    }`}>
      <div className="flex items-start space-x-4">
        {/* Checkbox */}
        <div className="flex-shrink-0 pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
          />
        </div>

        {/* Thumbnail */}
        <div className="flex-shrink-0">
          <div className="w-24 h-16 bg-gray-200 rounded-lg overflow-hidden relative">
            {video.assets?.video && !imageError ? (
              <img
                src={getThumbnailUrl(video.assets.video) || ''}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-300 to-gray-400">
                <Play className="w-6 h-6 text-gray-600" />
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-900 truncate">
                {video.prompt || `Video ${video.id.slice(0, 8)}`}
              </h3>
              
              <div className="mt-1 flex items-center space-x-4 text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(video.created_at)}</span>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatTime(video.created_at)}</span>
                </div>

                {video.metadata?.duration && (
                  <div className="flex items-center space-x-1">
                    <Play className="w-3 h-3" />
                    <span>{video.metadata.duration}s</span>
                  </div>
                )}

                {video.metadata?.resolution && (
                  <div className="flex items-center space-x-1">
                    <Monitor className="w-3 h-3" />
                    <span>{video.metadata.resolution}</span>
                  </div>
                )}
              </div>

              {video.metadata?.formattedSize && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    <Download className="w-3 h-3 mr-1" />
                    {video.metadata.formattedSize}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 ml-4">
              {video.assets?.video && (
                <a
                  href={video.assets.video}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Preview
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
