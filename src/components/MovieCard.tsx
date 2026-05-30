import React from 'react';
import { Edit2, Trash2, ArrowLeftRight, Check, X, Clock, RefreshCw } from 'lucide-react';

interface Movie {
  id: string;
  userId: string;
  title: string;
  thumbnailUrl: string;
  thumbnailKey: string | null;
  aspectRatio: '16:9' | '9:16';
  collection: 'watched' | 'watchLater';
  createdAt: Date | string;
  updatedAt: Date | string;
}

interface MovieCardProps {
  movie: Movie;
  onEdit: (movie: Movie) => void;
  onDelete: (movie: Movie) => void;
  onMove: (id: string) => void;
  isMoving: boolean;
  inlineEditingId: string | null;
  inlineTitleValue: string;
  setInlineTitleValue: (val: string) => void;
  startInlineEdit: (movie: Movie) => void;
  cancelInlineEdit: () => void;
  saveInlineEdit: (movie: Movie) => void;
  isReadOnly?: boolean;
}

export type { Movie, MovieCardProps };

export default function MovieCard({
  movie, onEdit, onDelete, onMove, isMoving,
  inlineEditingId, inlineTitleValue, setInlineTitleValue,
  startInlineEdit, cancelInlineEdit, saveInlineEdit,
  isReadOnly = false,
}: MovieCardProps) {
  const isEditing = inlineEditingId === movie.id;
  const isLandscape = movie.aspectRatio === '16:9';

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((centerY - y) / centerY) * 8; // Restrained to 8 deg for absolute luxury feel
    const rotateY = ((x - centerX) / centerX) * 8;
    card.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
    card.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`;
    card.style.transition = 'transform 0.1s cubic-bezier(0.25, 0.8, 0.25, 1), border-color 0.3s, box-shadow 0.3s';
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    card.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), border-color 0.3s, box-shadow 0.3s';
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative bg-bg-card rounded-2xl overflow-hidden border border-white/5 shadow-lg group card-preserve-3d transition-all duration-300 hover:border-neon-purple/40 hover:shadow-neon-purple flex flex-col cursor-pointer flex-shrink-0 ${
        isLandscape ? 'w-[300px]' : 'w-[200px]'
      }`}
    >
      <div className="glow-overlay rounded-2xl" />

      {/* Thumbnail */}
      <div className={`relative overflow-hidden w-full bg-black/40 ${isLandscape ? 'aspect-video' : 'aspect-[9/14]'}`}>
        <img
          src={movie.thumbnailUrl}
          alt={movie.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />
        <span className={`absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full border tracking-wide ${
          isLandscape
            ? 'bg-neon-purple/30 border-neon-purple/60 text-white'
            : 'bg-neon-blue/30 border-neon-blue/60 text-white'
        }`}>
          {movie.aspectRatio}
        </span>

        {/* Hover Actions Overlay - Hidden in Read Only Mode */}
        {!isReadOnly && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center gap-3 pb-4">
            <button onClick={() => onMove(movie.id)} disabled={isMoving}
              title={movie.collection === 'watchLater' ? 'Move to Watched' : 'Move to Watch Later'}
              className="w-9 h-9 rounded-full bg-white text-bg-dark hover:bg-neon-purple hover:text-white flex items-center justify-center transition-all hover:scale-110 cursor-pointer disabled:opacity-50">
              {isMoving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
            </button>
            <button onClick={() => onEdit(movie)} title="Edit"
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-neon-blue text-white flex items-center justify-center transition-all hover:scale-110 backdrop-blur border border-white/10 cursor-pointer">
              <Edit2 className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(movie)} title="Delete"
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-red-600 text-white flex items-center justify-center transition-all hover:scale-110 backdrop-blur border border-white/10 cursor-pointer">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="p-3 flex flex-col gap-2 z-10">
        {isEditing && !isReadOnly ? (
          <div className="flex items-center gap-1.5">
            <input type="text" autoFocus value={inlineTitleValue}
              onChange={(e) => setInlineTitleValue(e.target.value)}
              onBlur={() => saveInlineEdit(movie)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(movie); if (e.key === 'Escape') cancelInlineEdit(); }}
              className="bg-white/5 border border-neon-purple rounded px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-neon-purple w-full" />
            <button onMouseDown={() => saveInlineEdit(movie)} className="text-green-400 hover:text-green-300 cursor-pointer"><Check className="w-4 h-4" /></button>
            <button onMouseDown={cancelInlineEdit} className="text-red-400 hover:text-red-300 cursor-pointer"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <h3 onClick={() => !isReadOnly && startInlineEdit(movie)} title={isReadOnly ? undefined : "Click to edit"}
            className={`text-sm font-bold text-gray-100 font-display leading-tight truncate transition-colors ${
              isReadOnly ? '' : 'hover:text-neon-purple cursor-pointer'
            }`}>
            {movie.title}
          </h3>
        )}
        <div className="flex justify-between items-center text-[10px] text-gray-500 font-medium">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(movie.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          <span className="text-neon-cyan uppercase font-bold tracking-widest text-[9px]">
            {movie.collection === 'watched' ? 'Logged' : 'Queued'}
          </span>
        </div>
      </div>
    </div>
  );
}
