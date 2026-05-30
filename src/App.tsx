import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Check, X, UploadCloud, Video, Smartphone, Sparkles, Film, Clock, Compass, RefreshCw, AlertCircle, ChevronLeft, ChevronRight, Trophy, Send, User } from 'lucide-react';
import { trpc } from './trpc';
import { AnimatePresence, motion, useScroll } from 'framer-motion';
import HeroSection from './components/HeroSection';
import MovieCard from './components/MovieCard';
import type { Movie } from './components/MovieCard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { getImageUrl } from './utils/url';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
let toastIdCounter = 0;
const generateToastId = () => `toast-${++toastIdCounter}`;

const generateParticles = () => Array.from({length:30},(_,i)=>({
  id: i,
  left: `${Math.random()*100}%`,
  size: Math.random()*3+1.5,
  speed: i%3===0 ? 'animate-particle-slow' : i%3===1 ? 'animate-particle-mid' : 'animate-particle-fast',
  delay: `${Math.random()*10}s`
}));

interface Toast { id: string; type: 'success'|'error'|'info'; message: string; }

export function MovieApp() {
  const utils = trpc.useContext();
  
  // Shared View / Friend Mode state
  const isReadOnly = typeof window !== 'undefined' && 
    (new URLSearchParams(window.location.search).get('view') === 'friend' || 
     new URLSearchParams(window.location.search).get('share') === 'explorer');

  // Fetch movies and recommendations with 10-second automatic polling
  const { data: movies = [], isLoading, error: fetchError } = trpc.getMovies.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const { data: recommendations = [], isLoading: isRecsLoading } = trpc.getRecommendations.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const addMut = trpc.addMovie.useMutation({ onSuccess: () => { utils.getMovies.invalidate(); showToast('success','Movie added!'); closeModal(); }, onError: (e) => showToast('error', e.message) });
  const editMut = trpc.editMovie.useMutation({ onSuccess: () => { utils.getMovies.invalidate(); showToast('success','Updated!'); closeModal(); }, onError: (e) => showToast('error', e.message) });
  const delMut = trpc.deleteMovie.useMutation({ onSuccess: () => { utils.getMovies.invalidate(); showToast('success','Deleted.'); setDelMovie(null); }, onError: (e) => showToast('error', e.message) });
  const moveMut = trpc.moveCollection.useMutation({ onSuccess: (_,v) => { utils.getMovies.invalidate(); showToast('success',`Moved to ${v.collection==='watched'?'Watched':'Watch Later'}!`); }, onError: (e) => showToast('error', e.message) });
  const titleMut = trpc.editTitle.useMutation({ onSuccess: () => { utils.getMovies.invalidate(); }, onError: (e) => showToast('error', e.message) });

  // Absolute Cinema (Top Rank) Mutations
  const addRecMut = trpc.addRecommendation.useMutation({
    onSuccess: () => {
      utils.getRecommendations.invalidate();
      showToast('success', 'Masterpiece added to rankings!');
      setRecTitle('');
      setRecRank(1);
      setRecFile(null);
      setRecPreview('');
      setAddRankOpen(false);
    },
    onError: (e) => showToast('error', e.message),
  });

  const editRecMut = trpc.editRecommendation.useMutation({
    onSuccess: () => {
      utils.getRecommendations.invalidate();
      showToast('success', 'Ranking updated successfully!');
      setEditingRecId(null);
    },
    onError: (e) => showToast('error', e.message),
  });

  const delRecMut = trpc.deleteRecommendation.useMutation({
    onSuccess: () => {
      utils.getRecommendations.invalidate();
      showToast('success', 'Movie removed from rankings.');
    },
    onError: (e) => showToast('error', e.message),
  });

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<Movie|null>(null);
  const [delMovie, setDelMovie] = useState<Movie|null>(null);
  const [inlineId, setInlineId] = useState<string|null>(null);
  const [inlineVal, setInlineVal] = useState('');
  
  // Movie Add/Edit Form states
  const [formTitle, setFormTitle] = useState('');
  const [formAR, setFormAR] = useState<'16:9'|'9:16'>('16:9');
  const [formFile, setFormFileState] = useState<File|null>(null);
  const [formPreview, setFormPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [existUrl, setExistUrl] = useState('');
  const [existKey, setExistKey] = useState<string|null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Absolute Cinema (Top Rank) states
  const [recTitle, setRecTitle] = useState('');
  const [recRank, setRecRank] = useState<number>(1);
  const [recFile, setRecFile] = useState<File|null>(null);
  const [recPreview, setRecPreview] = useState('');
  const [recUploading, setRecUploading] = useState(false);
  const [recDragActive, setRecDragActive] = useState(false);
  const [recName, setRecName] = useState('');

  const [addRankOpen, setAddRankOpen] = useState(false);
  const [editingRecId, setEditingRecId] = useState<string|null>(null);
  const [editRecTitle, setEditRecTitle] = useState('');
  const [editRecRank, setEditRecRank] = useState<number>(1);
  const [editRecFile, setEditRecFile] = useState<File|null>(null);
  const [editRecPreview, setEditRecPreview] = useState('');
  const [editRecUploading, setEditRecUploading] = useState(false);

  const [scrolled, setScrolled] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const recFileRef = useRef<HTMLInputElement>(null);
  const wlScrollRef = useRef<HTMLDivElement>(null);
  const wScrollRef = useRef<HTMLDivElement>(null);
  const recScrollRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll();
  
  const [isMobile, setIsMobile] = useState(false);
  const [particles, setParticles] = useState<{ id: number; left: string; size: number; speed: string; delay: string; }[]>([]);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setParticles([]);
      } else {
        setParticles(generateParticles());
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => { const h = () => setScrolled(window.scrollY > 60); window.addEventListener('scroll',h); return ()=>window.removeEventListener('scroll',h); }, []);

  const showToast = (type: Toast['type'], message: string) => { const id = generateToastId(); setToasts(p=>[...p,{id,type,message}]); setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),4000); };
  const scrollTo = () => document.getElementById('collections')?.scrollIntoView({behavior:'smooth'});
  const openAdd = () => { setEditingMovie(null); setFormTitle(''); setFormAR('16:9'); setFormFileState(null); setFormPreview(''); setExistUrl(''); setExistKey(null); setModalOpen(true); };
  const openEdit = (m: Movie) => { setEditingMovie(m); setFormTitle(m.title); setFormAR(m.aspectRatio); setFormFileState(null); setFormPreview(getImageUrl(m.thumbnailUrl)); setExistUrl(m.thumbnailUrl); setExistKey(m.thumbnailKey); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingMovie(null); setFormFileState(null); setFormPreview(''); setUploading(false); };

  const processFile = (f: File, isRec: boolean = false) => {
    if(!f.type.startsWith('image/')){showToast('error','Only images allowed!');return;}
    if(f.size>5*1024*1024){showToast('error','Max 5MB!');return;}
    if (isRec) {
      setRecFormFile(f);
    } else {
      setFormFile(f);
    }
  };

  const setFormFile = (f: File) => {
    setFormFileState(f);
    const r=new FileReader();
    r.onloadend=()=>setFormPreview(r.result as string);
    r.readAsDataURL(f);
  };

  const setRecFormFile = (f: File) => {
    setRecFile(f);
    const r=new FileReader();
    r.onloadend=()=>setRecPreview(r.result as string);
    r.readAsDataURL(f);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type==='dragenter'||e.type==='dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if(e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0], false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!formTitle.trim()){showToast('error','Title required!');return;}
    if(!formPreview&&!formFile){showToast('error','Upload a thumbnail!');return;}
    setUploading(true);
    let url=existUrl, key=existKey;
    try {
      if(formFile){
        const fd=new FormData();
        fd.append('thumbnail',formFile);
        const r=await fetch(`${API_BASE_URL}/api/upload`,{method:'POST',body:fd});
        if(!r.ok){const d=await r.json();throw new Error(d.error);}
        const d=await r.json();
        url=d.url;
        key=d.key;
      }
      if(editingMovie) await editMut.mutateAsync({id:editingMovie.id,title:formTitle,thumbnailUrl:url,thumbnailKey:key,aspectRatio:formAR});
      else await addMut.mutateAsync({title:formTitle,thumbnailUrl:url,thumbnailKey:key,aspectRatio:formAR,collection:'watchLater'});
    } catch(err: unknown){ const error = err instanceof Error ? err : new Error(String(err)); showToast('error', error.message || 'Error'); } finally { setUploading(false); }
  };

  // Handle ranking submit (Create)
  const handleRecSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!recTitle.trim()){showToast('error','Movie title is required!');return;}
    setRecUploading(true);
    
    // Default movie frame if user doesn't upload a keyframe
    let url = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80';
    let key: string | null = null;
    
    try {
      if (recFile) {
        const fd = new FormData();
        fd.append('thumbnail', recFile);
        const r = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body: fd });
        if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
        const d = await r.json();
        url = d.url;
        key = d.key;
      }
      
      await addRecMut.mutateAsync({
        title: recTitle.trim(),
        thumbnailUrl: url,
        thumbnailKey: key,
        rank: recRank,
        recommendedBy: 'Cinematic Explorer', // Purely user-owned rankings
      });
    } catch(err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      showToast('error', error.message || 'Error creating ranked movie');
    } finally {
      setRecUploading(false);
    }
  };

  // Handle ranking edit (Update)
  const handleRecEditSubmit = async (id: string, existUrl: string, existKey: string | null) => {
    if(!editRecTitle.trim()){showToast('error','Movie title is required!');return;}
    setEditRecUploading(true);
    
    let url = existUrl;
    let key = existKey;
    
    try {
      if (editRecFile) {
        const fd = new FormData();
        fd.append('thumbnail', editRecFile);
        const r = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body: fd });
        if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
        const d = await r.json();
        url = d.url;
        key = d.key;
      }
      
      await editRecMut.mutateAsync({
        id,
        title: editRecTitle.trim(),
        rank: editRecRank,
        thumbnailUrl: url,
        thumbnailKey: key,
      });
      setEditRecFile(null);
      setEditRecPreview('');
    } catch(err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      showToast('error', error.message || 'Error updating ranked movie');
    } finally {
      setEditRecUploading(false);
    }
  };

  const startInline = (m: Movie) => { setInlineId(m.id); setInlineVal(m.title); };
  const cancelInline = () => setInlineId(null);
  const saveInline = async (m: Movie) => { if(!inlineVal.trim()){showToast('error','Empty!');return;} if(inlineVal.trim()===m.title){setInlineId(null);return;} setInlineId(null); await titleMut.mutateAsync({id:m.id,title:inlineVal.trim()}); };

  const scrollCarousel = (ref: React.RefObject<HTMLDivElement|null>, dir: 'left'|'right') => { ref.current?.scrollBy({left:dir==='left'?-600:600,behavior:'smooth'}); };

  const watched = movies.filter((m: Movie) => m.collection === 'watched');
  const watchLater = movies.filter((m: Movie) => m.collection === 'watchLater');
  const featured = watchLater[0]||watched[0]||null;

  const cardProps = (m: Movie) => ({ movie:m, onEdit:openEdit, onDelete:setDelMovie, onMove:(id:string)=>moveMut.mutate({id,collection:m.collection==='watched'?'watchLater':'watched'}), isMoving:moveMut.isPending&&moveMut.variables?.id===m.id, inlineEditingId:inlineId, inlineTitleValue:inlineVal, setInlineTitleValue:setInlineVal, startInlineEdit:startInline, cancelInlineEdit:cancelInline, saveInlineEdit:saveInline });

  return (
    <div className="min-h-screen bg-bg-dark text-white overflow-x-hidden">
      {/* Scroll Progress */}
      <motion.div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-neon-purple via-neon-blue to-neon-pink z-[60] origin-left" style={{scaleX:scrollYProgress}} />

      {/* Particles */}
      {!isMobile && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          {particles.map(p=><div key={p.id} className={`absolute bg-white rounded-full ${p.speed}`} style={{left:p.left,width:p.size,height:p.size,animationDelay:p.delay,bottom:'-20px',opacity:0.25}} />)}
        </div>
      )}

      {/* Navbar */}
      <header className={`fixed top-0 w-full z-50 transition-all duration-500 px-6 md:px-12 flex justify-between items-center ${scrolled?'bg-bg-dark/95 backdrop-blur-xl border-b border-white/5 py-3':'bg-gradient-to-b from-bg-dark/85 to-transparent py-5'}`}>
        <div className="flex items-center gap-3">
          <div className="relative"><Film className="w-7 h-7 text-neon-purple animate-pulse-glow" /><Sparkles className="w-3.5 h-3.5 text-neon-cyan absolute -top-1 -right-1" /></div>
          <span className="text-lg font-bold font-display tracking-wider bg-gradient-to-r from-white via-neon-purple to-neon-cyan bg-clip-text text-transparent">CINEVERSE</span>
          
          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6 ml-8 text-[10px] font-black uppercase tracking-[0.15em] text-gray-400">
            <button onClick={scrollTo} className="hover:text-white transition-colors cursor-pointer">Collections</button>
            <button onClick={() => document.getElementById('absolute-cinema')?.scrollIntoView({behavior:'smooth'})} className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-red-500 animate-pulse" /> Absolute Cinema</button>
            <button onClick={() => document.getElementById('recommendations')?.scrollIntoView({behavior:'smooth'})} className="hover:text-white transition-colors cursor-pointer">Recommendations</button>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {isReadOnly ? (
            <button onClick={() => document.getElementById('recommendation-form')?.scrollIntoView({behavior:'smooth'})} className="flex items-center gap-2 bg-gradient-to-r from-neon-purple to-neon-pink text-white font-medium py-2 px-4 rounded-xl border border-white/10 shadow-neon-purple transition-all hover:scale-[1.03] text-sm cursor-pointer"><Sparkles className="w-4 h-4" /><span className="hidden sm:inline">Recommend Movie</span><span className="sm:hidden">Recommend</span></button>
          ) : (
            <button onClick={openAdd} className="flex items-center gap-2 bg-gradient-to-r from-neon-purple to-neon-blue text-white font-medium py-2 px-4 rounded-xl border border-white/10 shadow-neon-purple transition-all hover:scale-[1.03] text-sm cursor-pointer"><Plus className="w-4 h-4" /><span className="hidden sm:inline">Add Movie</span></button>
          )}
          <div className="items-center gap-2 bg-white/5 border border-white/5 py-1 px-3 rounded-full hidden md:flex">
            <img src={isReadOnly ? "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&auto=format&fit=crop&q=80" : "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80&auto=format&fit=crop&q=80"} alt="" className="w-6 h-6 rounded-full border border-neon-purple/50" />
            <span className="text-xs font-semibold text-gray-200">{isReadOnly ? 'Friend Guest' : 'Explorer'}</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <HeroSection featuredMovie={featured} onBrowse={scrollTo} onAdd={openAdd} isReadOnly={isReadOnly} />

      {/* Error */}
      {fetchError && <div className="max-w-6xl mx-auto px-6 py-4"><div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex gap-3 items-center text-red-200 text-sm"><AlertCircle className="w-5 h-5 text-red-400 shrink-0" /><span>Server warning: {fetchError.message}. Running in offline sandbox.</span></div></div>}

      {/* Collections & Recommendations */}
      <div id="collections" className="relative z-10 scroll-mt-20">

        {/* Watch Later */}
        <motion.section initial={{opacity:0,y:80}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:'-80px'}} transition={{duration:0.7,ease:'easeOut'}} className="py-10">
          <div className="flex justify-between items-center px-6 md:px-12 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-neon-purple/10 flex items-center justify-center border border-neon-purple/20"><Clock className="w-4 h-4 text-neon-purple" /></div>
              <div><h2 className="text-xl md:text-2xl font-extrabold text-white font-display">Watch Later</h2><p className="text-[11px] text-gray-500">Upcoming cinematic blockbusters</p></div>
            </div>
            <span className="text-neon-purple text-xs font-bold bg-neon-purple/10 border border-neon-purple/20 px-3 py-1 rounded-full">{watchLater.length} {watchLater.length===1?'Movie':'Movies'}</span>
          </div>
          {isLoading ? <div className="flex justify-center py-16"><RefreshCw className="w-7 h-7 text-neon-purple animate-spin" /></div>
          : watchLater.length===0 ? <div className="mx-6 md:mx-12 glassmorphism rounded-2xl p-12 text-center border border-white/5 flex flex-col items-center"><Film className="w-10 h-10 text-gray-600 mb-3" /><h3 className="text-base font-bold text-gray-300 mb-1">Queue empty</h3><p className="text-sm text-gray-500 mb-4">Add some movies!</p>{!isReadOnly && <button onClick={openAdd} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white py-2 px-4 rounded-xl border border-white/10 text-sm cursor-pointer"><Plus className="w-4 h-4" />Add Movie</button>}</div>
          : <div className="relative group/car">
               <button onClick={()=>scrollCarousel(wlScrollRef,'left')} className="absolute left-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-r from-bg-dark to-transparent flex items-center justify-center opacity-0 group-hover/car:opacity-100 transition-opacity cursor-pointer"><ChevronLeft className="w-7 h-7 text-white" /></button>
               <div ref={wlScrollRef} className="flex gap-5 overflow-x-auto scrollbar-hide scroll-smooth px-6 md:px-12 pb-4">
                 {watchLater.map((m: Movie, i: number)=><motion.div key={m.id} initial={{opacity:0,scale:0.85,y:30}} whileInView={{opacity:1,scale:1,y:0}} viewport={{once:true}} transition={{duration:0.4,delay:i*0.08}} className="card-perspective"><MovieCard {...cardProps(m)} isReadOnly={isReadOnly} /></motion.div>)}
               </div>
               <button onClick={()=>scrollCarousel(wlScrollRef,'right')} className="absolute right-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-l from-bg-dark to-transparent flex items-center justify-center opacity-0 group-hover/car:opacity-100 transition-opacity cursor-pointer"><ChevronRight className="w-7 h-7 text-white" /></button>
             </div>}
        </motion.section>

        {/* Absolute Cinema (Top Rankings) Section */}
        <motion.section id="absolute-cinema" initial={{opacity:0,y:80}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:'-80px'}} transition={{duration:0.7,ease:'easeOut'}} className="py-12 border-t border-white/5 bg-gradient-to-b from-black/20 to-transparent">
          <div className="flex justify-between items-center px-6 md:px-12 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center border border-red-500/20"><Trophy className="w-4 h-4 text-red-500 animate-pulse" /></div>
              <div><h2 className="text-xl md:text-2xl font-black text-white font-display uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-neon-cyan to-white">Absolute Cinema</h2><p className="text-[11px] text-gray-500">Your top-notch personal movie rankings (N &lt; 30)</p></div>
            </div>
            {!isReadOnly && (
              <button onClick={() => setAddRankOpen(!addRankOpen)} className="flex items-center gap-1.5 bg-red-600/15 hover:bg-red-600/30 text-red-400 text-xs font-black border border-red-500/30 px-3 py-1.5 rounded-xl cursor-pointer transition-all shadow-neon-pink">
                {addRankOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{addRankOpen ? 'Cancel' : 'Add Rank'}</span>
              </button>
            )}
          </div>

          <div className="max-w-4xl mx-auto px-6 md:px-12">
            {/* Minimalistic Inline Add Form */}
            {addRankOpen && !isReadOnly && (
              <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} className="glassmorphism rounded-2xl border border-white/10 p-5 mb-8 flex flex-col gap-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5"><Plus className="w-4 h-4 text-red-500" /> Add Movie to Rankings</h3>
                <form onSubmit={handleRecSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-4 flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Movie Title</label>
                    <input type="text" required placeholder="e.g. Inception" value={recTitle} onChange={e=>setRecTitle(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-red-500 transition-all" />
                  </div>

                  <div className="md:col-span-3 flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Pick Rank</label>
                    <select value={recRank} onChange={e=>setRecRank(Number(e.target.value))} className="w-full bg-bg-card border border-white/5 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-red-500 transition-all">
                      {Array.from({length: 29}, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>🏆 Rank #{num}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3 flex flex-col gap-1.5">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Keyframe Poster (Optional)</label>
                    <div onClick={()=>recFileRef.current?.click()} className="w-full bg-white/5 border border-dashed border-white/10 hover:border-red-500/50 rounded-xl px-3 py-2 text-gray-500 text-center cursor-pointer transition-all truncate text-[10px] font-semibold flex items-center justify-center gap-1.5 h-[34px]">
                      <input ref={recFileRef} type="file" accept="image/*" onChange={e=>{if(e.target.files?.[0])processFile(e.target.files[0], true)}} className="hidden" />
                      {recPreview ? <img src={recPreview} alt="" className="w-6 h-4 object-cover rounded" /> : <UploadCloud className="w-3.5 h-3.5 text-red-500" />}
                      <span>{recFile ? recFile.name : 'Upload Poster'}</span>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <button type="submit" disabled={recUploading} className="w-full bg-gradient-to-r from-red-600 to-neon-pink text-white font-bold py-2 rounded-xl border border-white/10 shadow-neon-pink flex items-center justify-center gap-1.5 cursor-pointer text-xs disabled:opacity-50 transition-all h-[34px]">
                      {recUploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Add</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Rankings Stack */}
            {isRecsLoading ? (
              <div className="flex justify-center py-16"><RefreshCw className="w-7 h-7 text-neon-purple animate-spin" /></div>
            ) : recommendations.length === 0 ? (
              <div className="glassmorphism rounded-2xl p-12 text-center border border-white/5 flex flex-col items-center justify-center"><Trophy className="w-10 h-10 text-gray-600 mb-3 animate-pulse" /><h3 className="text-base font-bold text-gray-300 mb-1">No ranked movies yet</h3><p className="text-sm text-gray-500">Curations are waiting. Crown your favorite movies as Absolute Cinema!</p></div>
            ) : (
              <div className="flex flex-col gap-2">
                {[...recommendations].sort((a: any, b: any) => a.rank - b.rank).map((rec: any, index: number) => {
                  const isEditing = editingRecId === rec.id;
                  
                  return (
                    <motion.div 
                      key={rec.id}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.4) }}
                      className="glassmorphism rounded-2xl p-3 flex flex-col md:flex-row items-center justify-between gap-4 border border-white/5 hover:border-red-500/20 hover:bg-white/[0.01] transition-all"
                    >
                      {/* Left: Rank, Image and Title */}
                      <div className="flex items-center gap-4 w-full md:w-auto min-w-0">
                        {/* Rank Badge */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-sm shrink-0 ${
                          rec.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-black shadow-lg shadow-yellow-500/20'
                          : rec.rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-500 text-black'
                          : rec.rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white'
                          : 'bg-white/5 border border-white/10 text-gray-400'
                        }`}>
                          #{rec.rank}
                        </div>

                        {/* Thumbnail (Aspect Ratio Protected) */}
                        <div className="w-12 h-8 rounded overflow-hidden bg-black/40 border border-white/5 shrink-0">
                          <img src={getImageUrl(rec.thumbnailUrl)} alt="" className="w-full h-full object-cover" />
                        </div>

                        {/* Details */}
                        {isEditing ? (
                          <div className="flex flex-col sm:flex-row gap-3 w-full sm:items-center">
                            <input 
                              type="text" 
                              required 
                              value={editRecTitle} 
                              onChange={e=>setEditRecTitle(e.target.value)} 
                              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-red-500 min-w-[160px]" 
                            />
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-gray-500 uppercase">Rank:</span>
                              <select 
                                value={editRecRank} 
                                onChange={e=>setEditRecRank(Number(e.target.value))} 
                                className="bg-bg-card border border-white/5 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-red-500"
                              >
                                {Array.from({length: 29}, (_, i) => i + 1).map(num => (
                                  <option key={num} value={num}>#{num}</option>
                                ))}
                              </select>
                            </div>
                            
                            {/* Edit Thumbnail */}
                            <div onClick={()=>fileRef.current?.click()} className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg px-2 py-1 text-gray-400 text-[10px] cursor-pointer flex items-center gap-1">
                              <input ref={fileRef} type="file" accept="image/*" onChange={e=>{if(e.target.files?.[0]) { setEditRecFile(e.target.files[0]); const r=new FileReader(); r.onloadend=()=>setEditRecPreview(r.result as string); r.readAsDataURL(e.target.files[0]); }}} className="hidden" />
                              {editRecPreview ? <img src={editRecPreview} alt="" className="w-5 h-3.5 object-cover rounded" /> : <UploadCloud className="w-3 h-3 text-red-500" />}
                              <span>{editRecFile ? 'Replaced' : 'Poster'}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col min-w-0">
                            <h4 className="text-sm font-bold text-white font-display truncate leading-snug">{rec.title}</h4>
                            <span className="text-[9px] font-medium text-gray-500 uppercase tracking-widest mt-0.5">Absolute Cinema Log</span>
                          </div>
                        )}
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 border-white/5 pt-2.5 md:pt-0 shrink-0">
                        {isReadOnly ? (
                          <span className="text-[9px] font-black text-red-500/60 uppercase tracking-widest bg-red-950/20 border border-red-900/30 px-2 py-0.5 rounded-full"> CROWNED </span>
                        ) : isEditing ? (
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => handleRecEditSubmit(rec.id, rec.thumbnailUrl, rec.thumbnailKey)}
                              disabled={editRecUploading}
                              className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1"
                            >
                              {editRecUploading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              <span>Save</span>
                            </button>
                            <button 
                              onClick={() => setEditingRecId(null)}
                              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-[10px] font-medium cursor-pointer transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => { setEditingRecId(rec.id); setEditRecTitle(rec.title); setEditRecRank(rec.rank); setEditRecFile(null); setEditRecPreview(''); }}
                              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition-all border border-white/5 cursor-pointer"
                              title="Edit Rank"
                            >
                              <Plus className="w-3.5 h-3.5 rotate-45 shrink-0" />
                            </button>
                            <button 
                              onClick={() => { if(confirm(`Remove "${rec.title}" from rankings?`)) delRecMut.mutate({id: rec.id}); }}
                              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-600 text-gray-400 hover:text-white flex items-center justify-center transition-all border border-white/5 cursor-pointer"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.section>

        {/* Watched */}
        <motion.section initial={{opacity:0,y:80}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:'-80px'}} transition={{duration:0.7,ease:'easeOut'}} className="py-10">
          <div className="flex justify-between items-center px-6 md:px-12 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-neon-cyan/10 flex items-center justify-center border border-neon-cyan/20"><Check className="w-4 h-4 text-neon-cyan" /></div>
              <div><h2 className="text-xl md:text-2xl font-extrabold text-white font-display">Watched</h2><p className="text-[11px] text-gray-500">Your logged cinematic memories</p></div>
            </div>
            <span className="text-neon-cyan text-xs font-bold bg-neon-cyan/10 border border-neon-cyan/20 px-3 py-1 rounded-full">{watched.length} {watched.length===1?'Movie':'Movies'}</span>
          </div>
          {isLoading ? <div className="flex justify-center py-16"><RefreshCw className="w-7 h-7 text-neon-cyan animate-spin" /></div>
          : watched.length===0 ? <div className="mx-6 md:mx-12 glassmorphism rounded-2xl p-12 text-center border border-white/5 flex flex-col items-center"><Compass className="w-10 h-10 text-gray-600 mb-3" /><h3 className="text-base font-bold text-gray-300 mb-1">No movies logged</h3><p className="text-sm text-gray-500">Immerse inside your library!</p></div>
          : <div className="relative group/car2">
               <button onClick={()=>scrollCarousel(wScrollRef,'left')} className="absolute left-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-r from-bg-dark to-transparent flex items-center justify-center opacity-0 group-hover/car2:opacity-100 transition-opacity cursor-pointer"><ChevronLeft className="w-7 h-7 text-white" /></button>
               <div ref={wScrollRef} className="flex gap-5 overflow-x-auto scrollbar-hide scroll-smooth px-6 md:px-12 pb-4">
                 {watched.map((m: Movie, i: number)=><motion.div key={m.id} initial={{opacity:0,scale:0.85,y:30}} whileInView={{opacity:1,scale:1,y:0}} viewport={{once:true}} transition={{duration:0.4,delay:i*0.08}} className="card-perspective"><MovieCard {...cardProps(m)} isReadOnly={isReadOnly} /></motion.div>)}
               </div>
               <button onClick={()=>scrollCarousel(wScrollRef,'right')} className="absolute right-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-l from-bg-dark to-transparent flex items-center justify-center opacity-0 group-hover/car2:opacity-100 transition-opacity cursor-pointer"><ChevronRight className="w-7 h-7 text-white" /></button>
             </div>}
        </motion.section>

        {/* Friend Recommendations & Submission Board */}
        <motion.section id="recommendations" initial={{opacity:0,y:80}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:'-80px'}} transition={{duration:0.7,ease:'easeOut'}} className="py-10 pb-24 border-t border-white/5 bg-black/25">
          <div className="px-6 md:px-12 mb-8">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-neon-blue/10 flex items-center justify-center border border-neon-blue/20"><Trophy className="w-4 h-4 text-neon-blue" /></div>
                <div><h2 className="text-xl md:text-2xl font-extrabold text-white font-display">Friend Recommendations</h2><p className="text-[11px] text-gray-500">Ranked cinematic recommendations by guests</p></div>
              </div>
              <span className="text-neon-blue text-xs font-bold bg-neon-blue/10 border border-neon-blue/20 px-3 py-1 rounded-full">{recommendations.length} Recommendations</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-6 md:px-12">
            {/* Recommendations List Carousel */}
            <div className="lg:col-span-8 flex flex-col justify-center">
              {isRecsLoading ? <div className="flex justify-center py-16"><RefreshCw className="w-7 h-7 text-neon-blue animate-spin" /></div>
              : recommendations.length === 0 ? (
                <div className="glassmorphism rounded-2xl p-12 text-center border border-white/5 flex flex-col items-center justify-center h-full"><Trophy className="w-10 h-10 text-gray-600 mb-3" /><h3 className="text-base font-bold text-gray-300 mb-1">No recommendations yet</h3><p className="text-sm text-gray-500">Be the first to recommend a ranked movie!</p></div>
              ) : (
                <div className="relative group/rec-car">
                  <button onClick={()=>scrollCarousel(recScrollRef,'left')} className="absolute left-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-r from-bg-dark to-transparent flex items-center justify-center opacity-0 group-hover/rec-car:opacity-100 transition-opacity cursor-pointer"><ChevronLeft className="w-7 h-7 text-white" /></button>
                  <div ref={recScrollRef} className="flex gap-5 overflow-x-auto scrollbar-hide scroll-smooth pb-4">
                    {[...recommendations].sort((a: any, b: any) => a.rank - b.rank).map((rec: any, i: number) => (
                      <motion.div key={rec.id} initial={{opacity:0,scale:0.85,y:30}} whileInView={{opacity:1,scale:1,y:0}} viewport={{once:true}} transition={{duration:0.4,delay:i*0.08}}
                        className="relative bg-bg-card rounded-2xl overflow-hidden border border-white/5 shadow-md flex-shrink-0 w-[240px] group flex flex-col cursor-pointer transition-all hover:border-neon-blue/30">
                        {/* Thumbnail */}
                        <div className="relative aspect-video overflow-hidden bg-black/40">
                          <img src={getImageUrl(rec.thumbnailUrl)} alt={rec.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                          {/* Rank Badge */}
                          <div className={`absolute top-2 left-2 flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase ${
                            rec.rank === 1 ? 'bg-yellow-500/20 border-yellow-500/60 text-yellow-400' : rec.rank === 2 ? 'bg-slate-300/20 border-slate-300/60 text-slate-200' : rec.rank === 3 ? 'bg-amber-700/20 border-amber-700/60 text-amber-500' : 'bg-white/5 border-white/10 text-gray-400'
                          }`}>
                            <Trophy className="w-3 h-3" />
                            <span>#{rec.rank}</span>
                          </div>
                        </div>
                        {/* Footer */}
                        <div className="p-3 flex flex-col gap-1.5 bg-bg-card z-10">
                          <h4 className="text-xs font-bold text-white font-display truncate leading-tight group-hover:text-neon-blue transition-colors">{rec.title}</h4>
                          <div className="flex justify-between items-center text-[10px] text-gray-500">
                            <span className="flex items-center gap-1 font-medium"><User className="w-3 h-3 text-neon-cyan" /> {rec.recommendedBy}</span>
                            <span className="text-gray-600 font-semibold">{new Date(rec.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <button onClick={()=>scrollCarousel(recScrollRef,'right')} className="absolute right-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-l from-bg-dark to-transparent flex items-center justify-center opacity-0 group-hover/rec-car:opacity-100 transition-opacity cursor-pointer"><ChevronRight className="w-7 h-7 text-white" /></button>
                </div>
              )}
            </div>

            {/* Recommendation Form Submission Panel */}
            <div id="recommendation-form" className="lg:col-span-4">
              <div className="glassmorphism rounded-2xl border border-white/10 p-5 md:p-6 flex flex-col gap-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2"><Send className="w-4 h-4 text-neon-blue" /> Recommend a Movie</h3>
                
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if(!recName.trim()){showToast('error','Your name is required!');return;}
                  if(!recTitle.trim()){showToast('error','Movie title is required!');return;}
                  setRecUploading(true);
                  let url = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80';
                  let key: string | null = null;
                  try {
                    if (recFile) {
                      const fd = new FormData();
                      fd.append('thumbnail', recFile);
                      const r = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body: fd });
                      if (!r.ok) { const d = await r.json(); throw new Error(d.error); }
                      const d = await r.json();
                      url = d.url; key = d.key;
                    }
                    await addRecMut.mutateAsync({ title: recTitle.trim(), thumbnailUrl: url, thumbnailKey: key, rank: recRank, recommendedBy: recName.trim() });
                    setRecName('');
                  } catch(err: unknown) {
                    const error = err instanceof Error ? err : new Error(String(err));
                    showToast('error', error.message || 'Error submitting recommendation');
                  } finally { setRecUploading(false); }
                }} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Your Name</label>
                    <input type="text" required placeholder="e.g. Nolan Fan" value={recName} onChange={e=>setRecName(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-neon-blue transition-all" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Movie Title</label>
                    <input type="text" required placeholder="e.g. The Matrix" value={recTitle} onChange={e=>setRecTitle(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-neon-blue transition-all" />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pick Rank</label>
                    <select value={recRank} onChange={e=>setRecRank(Number(e.target.value))} className="w-full bg-bg-card border border-white/5 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-neon-blue transition-all">
                      {Array.from({length: 29}, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>🏆 {num === 1 ? '1st Rank (Your Favorite)' : num === 2 ? '2nd Rank' : num === 3 ? '3rd Rank' : `${num}th Rank`}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Upload keyframe (Optional)</label>
                    <div onDragEnter={e=>{e.preventDefault();e.stopPropagation();setRecDragActive(true)}} onDragOver={e=>{e.preventDefault();e.stopPropagation();setRecDragActive(true)}} onDragLeave={e=>{e.preventDefault();e.stopPropagation();setRecDragActive(false)}} onDrop={e=>{e.preventDefault();e.stopPropagation();setRecDragActive(false);if(e.dataTransfer.files?.[0])processFile(e.dataTransfer.files[0], true)}} onClick={()=>recFileRef.current?.click()}
                      className={`relative w-full border border-dashed rounded-xl overflow-hidden cursor-pointer transition-all duration-300 flex flex-col items-center justify-center text-center p-4 min-h-[90px] ${recDragActive?'border-neon-blue bg-neon-blue/10':'border-white/5 bg-white/5 hover:border-white/20'}`}>
                      <input ref={recFileRef} type="file" accept="image/*" onChange={e=>{if(e.target.files?.[0])processFile(e.target.files[0], true)}} className="hidden" />
                      {recPreview ? <div className="absolute inset-0"><img src={recPreview} alt="" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold transition-opacity"><UploadCloud className="w-4 h-4 mr-1.5" />Replace</div></div>
                      : <div className="flex flex-col items-center text-gray-500 p-2"><UploadCloud className="w-5 h-5 text-neon-blue mb-1" /><span className="text-[10px] font-semibold text-white mb-0.5">Drop frame image here</span><span className="text-[9px] text-gray-600">JPEG, PNG (Max 5MB)</span></div>}
                    </div>
                  </div>

                  <button type="submit" disabled={recUploading} className="w-full bg-gradient-to-r from-neon-purple to-neon-blue hover:from-neon-blue hover:to-neon-pink text-white font-bold py-2 rounded-xl border border-white/10 shadow-neon-purple flex items-center justify-center gap-1.5 cursor-pointer text-xs disabled:opacity-50 transition-all">
                    {recUploading?<><RefreshCw className="w-4 h-4 animate-spin" />Submitting...</>:<><Send className="w-4 h-4" />Submit Recommendation</>}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </motion.section>

      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={closeModal} className="absolute inset-0 bg-black/80 backdrop-blur-md" />
          <motion.div initial={{opacity:0,scale:0.9,y:20}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.9,y:20}} className="relative w-full max-w-lg glassmorphism rounded-3xl overflow-hidden border border-white/10 shadow-2xl p-6 md:p-8 z-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white font-display flex items-center gap-2"><Film className="w-5 h-5 text-neon-purple" />{editingMovie?'Edit Movie':'Add Movie'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-full transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Title</label>
                <input type="text" required placeholder="e.g. Interstellar" value={formTitle} onChange={e=>setFormTitle(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Format</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={()=>setFormAR('16:9')} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ${formAR==='16:9'?'bg-neon-purple/20 border-neon-purple text-white shadow-neon-purple':'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}><Video className="w-4 h-4" />Landscape</button>
                  <button type="button" onClick={()=>setFormAR('9:16')} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all cursor-pointer ${formAR==='9:16'?'bg-neon-blue/20 border-neon-blue text-white shadow-neon-cyan':'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}><Smartphone className="w-4 h-4" />Portrait</button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Thumbnail</label>
                <div onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop} onClick={()=>fileRef.current?.click()}
                  className={`relative w-full border-2 border-dashed rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 flex flex-col items-center justify-center text-center p-6 ${dragActive?'border-neon-purple bg-neon-purple/10':'border-white/10 bg-white/5 hover:border-white/20'} ${formAR==='16:9'?'aspect-video':'aspect-[9/14] max-w-[220px] mx-auto'}`}>
                  <input ref={fileRef} type="file" accept="image/*" onChange={e=>{if(e.target.files?.[0])processFile(e.target.files[0], false)}} className="hidden" />
                  {formPreview ? <div className="absolute inset-0"><img src={formPreview} alt="" className="w-full h-full object-cover" /><div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center text-white text-sm font-semibold transition-opacity"><UploadCloud className="w-5 h-5 mr-2" />Replace</div></div>
                  : <div className="flex flex-col items-center text-gray-400 p-4"><UploadCloud className="w-8 h-8 text-neon-purple mb-2 animate-bounce" /><span className="text-sm font-medium text-white mb-1">Drop file here</span><span className="text-xs text-gray-500">JPEG, PNG, WEBP (Max 5MB)</span></div>}
                </div>
              </div>
              <button type="submit" disabled={uploading} className="w-full bg-gradient-to-r from-neon-purple to-neon-blue text-white font-bold py-3 rounded-xl border border-white/10 shadow-neon-purple flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50">
                {uploading?<><RefreshCw className="w-5 h-5 animate-spin" />{editingMovie?'Updating...':'Uploading...'}</>:<><Check className="w-5 h-5" />{editingMovie?'Save Changes':'Add Movie'}</>}
              </button>
            </form>
          </motion.div>
        </div>}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {delMovie && <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setDelMovie(null)} className="absolute inset-0 bg-black/85 backdrop-blur-md" />
          <motion.div initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.95}} className="relative w-full max-w-sm glassmorphism rounded-3xl p-6 text-center border border-red-500/20 shadow-neon-pink z-10">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 mx-auto mb-4"><Trash2 className="w-5 h-5 text-red-500" /></div>
            <h3 className="text-lg font-bold text-white mb-2 font-display">Delete Movie?</h3>
            <p className="text-sm text-gray-400 mb-5">Remove <span className="text-white font-semibold">"{delMovie.title}"</span> permanently?</p>
            <div className="flex gap-3">
              <button onClick={()=>setDelMovie(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-2.5 rounded-xl border border-white/5 cursor-pointer text-sm">Cancel</button>
              <button onClick={()=>delMut.mutate({id:delMovie.id})} disabled={delMut.isPending} className="flex-1 bg-gradient-to-r from-red-600 to-neon-pink text-white font-bold py-2.5 rounded-xl border border-white/10 shadow-neon-pink cursor-pointer text-sm flex items-center justify-center">
                {delMut.isPending?<RefreshCw className="w-4 h-4 animate-spin" />:'Delete'}
              </button>
            </div>
          </motion.div>
        </div>}
      </AnimatePresence>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full">
        <AnimatePresence>
          {toasts.map(t=><motion.div key={t.id} initial={{opacity:0,x:50,scale:0.9}} animate={{opacity:1,x:0,scale:1}} exit={{opacity:0,x:50,scale:0.9}}
            className={`p-3 rounded-2xl glassmorphism border flex justify-between items-start shadow-lg ${t.type==='success'?'border-green-500/30':'border-red-500/30'}`}>
            <div className="flex gap-2">
              <div className={`mt-0.5 shrink-0 ${t.type==='success'?'text-green-400':'text-red-400'}`}>{t.type==='success'?<Check className="w-4 h-4" />:<AlertCircle className="w-4 h-4" />}</div>
              <p className="text-sm text-gray-200">{t.message}</p>
            </div>
            <button onClick={()=>setToasts(p=>p.filter(x=>x.id!==t.id))} className="text-gray-500 hover:text-white ml-2 cursor-pointer"><X className="w-3 h-3" /></button>
          </motion.div>)}
        </AnimatePresence>
      </div>
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/trpc`,
      headers() {
        return {
          Authorization: 'Bearer manus-session-token-xyz123',
        };
      },
    }),
  ],
});

export default function App() {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <MovieApp />
      </QueryClientProvider>
    </trpc.Provider>
  );
}
