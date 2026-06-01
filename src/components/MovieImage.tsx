import { useState } from 'react';
import { Film } from 'lucide-react';
import { getImageUrl } from '../utils/url';

interface MovieImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  aspectRatio?: '16:9' | '9:16' | string;
}

export default function MovieImage({
  src,
  alt,
  className = "w-full h-full object-cover",
  aspectRatio = '16:9',
}: MovieImageProps) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className={`w-full h-full bg-gradient-to-br from-neon-purple/20 via-bg-card to-neon-blue/20 flex flex-col items-center justify-center p-4 text-center ${
        aspectRatio === '9:16' ? 'py-12' : ''
      }`}>
        <div className="relative mb-2">
          <Film className="w-8 h-8 text-white/30 animate-pulse" />
          <div className="absolute inset-0 bg-neon-purple/20 blur-md rounded-full pointer-events-none" />
        </div>
        <span className="text-[10px] font-black uppercase text-white/60 tracking-widest line-clamp-2 px-2 leading-relaxed">
          {alt}
        </span>
        <span className="text-[8px] text-gray-500 font-bold tracking-wider uppercase mt-1">
          No Poster Available
        </span>
      </div>
    );
  }

  return (
    <img
      src={getImageUrl(src)}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}
