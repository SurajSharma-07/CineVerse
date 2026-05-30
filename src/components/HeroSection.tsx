import { useState, useEffect } from 'react';
import { Play, Plus, Star, ChevronDown, Sparkles } from 'lucide-react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { Movie } from './MovieCard';
import { getImageUrl } from '../utils/url';

interface HeroProps {
  featuredMovie: Movie | null;
  onBrowse: () => void;
  onAdd: () => void;
  isReadOnly?: boolean;
}

export default function HeroSection({ featuredMovie, onBrowse, onAdd, isReadOnly = false }: HeroProps) {
  const { scrollY } = useScroll();
  const imgY = useTransform(scrollY, [0, 700], [0, 250]);
  const imgScale = useTransform(scrollY, [0, 700], [1, 1.18]);
  const contentOpacity = useTransform(scrollY, [0, 450], [1, 0]);
  const contentY = useTransform(scrollY, [0, 450], [0, -80]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <section className="relative min-h-[100vh] w-full overflow-hidden flex flex-col justify-end px-6 md:px-16 pb-24 md:pb-36 pt-32">
      {/* Parallax Background */}
      <motion.div style={isMobile ? {} : { y: imgY, scale: imgScale }} className={isMobile ? "absolute inset-0 w-full h-full pointer-events-none" : "absolute inset-[-10%] w-[120%] h-[120%] pointer-events-none"}>
        {featuredMovie ? (
          <img src={getImageUrl(featuredMovie.thumbnailUrl)} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neon-purple/20 via-bg-dark to-neon-blue/10" />
        )}
      </motion.div>

      {/* Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-bg-dark via-bg-dark/40 to-bg-dark/30 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg-dark/95 via-bg-dark/40 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-bg-dark to-transparent pointer-events-none" />

      {/* Animated Vignette */}
      <div className="absolute inset-0 shadow-[inset_0_0_200px_60px_rgba(7,7,8,0.85)] pointer-events-none" />

      {/* Hero Content */}
      <motion.div style={isMobile ? {} : { opacity: contentOpacity, y: contentY }}
        className="relative w-full z-10 max-w-5xl">

        <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.7 }}>
          <div className="flex items-center gap-3 mb-5">
            <span className="bg-gradient-to-r from-neon-purple to-neon-pink text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-[0.15em] shadow-neon-purple">
              <Sparkles className="w-3 h-3 inline mr-1 -mt-0.5" />Featured
            </span>
            <div className="flex items-center gap-1 text-neon-blue">
              <Star className="w-3.5 h-3.5 fill-current" />
              <span className="text-xs font-bold">9.2</span>
            </div>
            <span className="text-gray-400 text-xs">Sci-Fi • Drama • 2024</span>
          </div>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.9, ease: 'easeOut' }}
          className="text-4xl xs:text-5xl sm:text-7xl md:text-8xl lg:text-[7rem] font-black font-display text-white mb-5 uppercase tracking-tight leading-[0.9] max-w-4xl break-words">
          {featuredMovie?.title || 'CINEVERSE'}
        </motion.h1>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="text-gray-300/80 text-sm md:text-base max-w-lg mb-8 leading-relaxed">
          A premium spatial gallery to catalog your cinematic journeys. Upload keyframes and manage your Watched & Watch Later collections with immersive 3D experiences.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
          className="flex flex-wrap gap-4">
          <button onClick={onBrowse}
            className="flex items-center gap-2.5 bg-white text-black font-bold py-3 px-8 rounded-lg hover:bg-gray-200 transition-all duration-200 hover:scale-105 cursor-pointer shadow-[0_4px_20px_rgba(255,255,255,0.15)]">
            <Play className="w-5 h-5 fill-current" /> Browse Collection
          </button>
          {!isReadOnly && (
            <button onClick={onAdd}
              className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md text-white font-bold py-3 px-8 rounded-lg border border-white/15 hover:bg-white/20 transition-all duration-200 hover:scale-105 cursor-pointer">
              <Plus className="w-5 h-5" /> Add Movie
            </button>
          )}
        </motion.div>
      </motion.div>

      {/* Scroll Indicator */}
      <motion.div animate={{ y: [0, 12, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-white/40 pointer-events-none">
        <span className="text-[10px] uppercase tracking-widest font-semibold">Scroll</span>
        <ChevronDown className="w-5 h-5" />
      </motion.div>
    </section>
  );
}
