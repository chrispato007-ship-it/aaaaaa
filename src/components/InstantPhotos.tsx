import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc,
  setDoc
} from 'firebase/firestore';
import { 
  Camera, 
  Upload, 
  Clock, 
  Trash2, 
  Heart, 
  Sparkles, 
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { UserProfile, InstantPhoto } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface InstantPhotosProps {
  user: UserProfile;
  coupleId: string;
  accentColor: string; // Dynamic coloring based on role ('#FFB399' or '#9176EB')
}

export default function InstantPhotos({ user, coupleId, accentColor }: InstantPhotosProps) {
  const [photos, setPhotos] = useState<InstantPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update current time every minute to refresh countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Listen to instant photos in real-time
  useEffect(() => {
    if (!coupleId) return;

    const photosRef = collection(db, 'instant_photos');
    const q = query(photosRef, where('coupleId', '==', coupleId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: InstantPhoto[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          coupleId: data.coupleId,
          senderId: data.senderId,
          senderName: data.senderName,
          senderRole: data.senderRole,
          imageUrl: data.imageUrl,
          caption: data.caption || '',
          createdAt: data.createdAt,
          expiresAt: data.expiresAt
        });
      });

      // Filter on client side: only show photos that haven't expired yet
      const nowStr = new Date().toISOString();
      const activePhotos = list.filter(photo => photo.expiresAt > nowStr);

      // Sort by creation date descending
      activePhotos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setPhotos(activePhotos);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to instant photos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [coupleId]);

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        handleImageSelect(file);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleImageSelect(e.target.files[0]);
    }
  };

  const handleImageSelect = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  // Resize and compress image using Canvas to ensure it fits safely in Firestore
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Scale down to a max dimension of 600px to keep base64 extremely small and speedy (~30KB-70KB)
          const maxDimension = 600;
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context could not be created'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          
          // Export as compressed JPEG (0.65 quality is perfect for mobile and saves massive space)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          resolve(dataUrl);
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleUploadPhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || uploading) return;

    setUploading(true);

    try {
      // 1. Compress image to Base64
      const compressedBase64 = await resizeImage(selectedFile);

      const now = new Date();
      const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // exactly 24 hours later

      const photoId = 'instant_' + Math.random().toString(36).substring(2, 15);
      const photoDoc = {
        id: photoId,
        coupleId,
        senderId: user.id,
        senderName: user.displayName,
        senderRole: user.role,
        imageUrl: compressedBase64,
        caption: caption.trim(),
        createdAt: now.toISOString(),
        expiresAt: expires.toISOString()
      };

      // 2. Write to Firestore
      await setDoc(doc(db, 'instant_photos', photoId), photoDoc);

      // 3. Create interactive real-time alert for partner
      const alertId = 'alert_' + Math.random().toString(36).substring(2, 15);
      const recipientId = user.role === 'ella' ? 'el' : 'ella'; // Send to the other role or lookup
      
      // Let's create an alert targeted to partner
      await setDoc(doc(db, 'alerts', alertId), {
        id: alertId,
        coupleId,
        senderId: user.id,
        recipientId: user.role === 'ella' ? 'el' : 'ella', // Or broad, we'll let the listener capture it
        type: 'new_message',
        title: '📸 Foto Instantánea Compartida',
        message: `¡${user.displayName} ha compartido una foto al instante! Solo durará 24 horas. ¡Mírala ahora! 🥰`,
        isRead: false,
        timestamp: now.toISOString()
      });

      // Clear states
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption('');
    } catch (err) {
      console.error("Error sharing photo:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('¿Quieres eliminar esta foto instantánea?')) return;
    try {
      await deleteDoc(doc(db, 'instant_photos', photoId));
    } catch (err) {
      console.error("Error deleting photo:", err);
    }
  };

  // Calculates remaining time in a friendly, reactive format
  const getRemainingTimeStr = (expiresAtStr: string) => {
    const diff = new Date(expiresAtStr).getTime() - currentTime.getTime();
    if (diff <= 0) return 'Expirado';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours === 0) return `${minutes} min`;
    return `${hours}h ${minutes}m`;
  };

  return (
    <div id="instant-photos-container" className="space-y-6">
      
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5" style={{ color: accentColor }} />
          <h2 className="text-xl font-display font-black text-[#2C2523]">Fotos Instantáneas</h2>
        </div>
        <span className="text-xs font-bold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-full flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" /> 24 Horas
        </span>
      </div>

      <p className="text-xs text-[#6E6461] leading-relaxed -mt-4">
        Comparte fotos de tu momento actual con tu pareja. Las fotos se muestran en un formato Polaroid especial y se eliminan automáticamente tras 24 horas de haber sido subidas.
      </p>

      {/* Share Section Card */}
      <div className="bg-white border border-[#E8DFFF] rounded-3xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-[#2C2523] flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-yellow-500" /> Compartir un momento ahora
        </h3>

        <form onSubmit={handleUploadPhoto} className="space-y-4">
          {/* Upload Drop Zone / Input */}
          <div 
            id="drag-and-drop-zone"
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[140px] ${
              dragActive 
                ? 'border-[#FFB399] bg-[#FFF2EE]' 
                : previewUrl 
                  ? 'border-[#E8DFFF] bg-white' 
                  : 'border-gray-200 hover:border-gray-300 bg-[#FDFBF7]'
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              capture="environment" // On mobile this directly launches the camera!
              onChange={handleFileInputChange}
              className="hidden" 
            />

            {previewUrl ? (
              <div className="relative w-full max-w-[200px] aspect-square rounded-lg overflow-hidden border border-[#E8DFFF] shadow-xs">
                <img 
                  src={previewUrl} 
                  alt="Vista previa" 
                  className="w-full h-full object-cover" 
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="absolute top-1 right-1 bg-black/70 hover:bg-black/90 text-white p-1 rounded-full transition"
                  title="Quitar foto"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-2 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#6E6461] border border-gray-100 shadow-xs">
                  <Upload className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#2C2523]">Toma una foto o súbela</p>
                  <p className="text-[10px] text-[#9c8e8a] mt-0.5">Arrastra y suelta aquí, o haz clic para buscar</p>
                </div>
              </div>
            )}
          </div>

          {/* Optional Caption */}
          {previewUrl && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="space-y-1.5"
            >
              <label className="block text-[11px] font-bold text-[#6E6461] uppercase tracking-wider">Un mensaje corto:</label>
              <input 
                id="photo-caption-input"
                type="text"
                placeholder="ej: Pensando en ti... 💕"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={45}
                className="w-full px-4 py-2.5 border border-[#E8DFFF] rounded-xl focus:outline-none focus:ring-1 focus:ring-rose-200 text-sm bg-[#FDFBF7]"
              />
            </motion.div>
          )}

          {/* Submit Button */}
          {previewUrl && (
            <button
              id="submit-photo-btn"
              type="submit"
              disabled={uploading}
              className="w-full py-3 rounded-2xl font-bold text-white transition shadow-sm cursor-pointer flex items-center justify-center gap-2 text-sm"
              style={{ backgroundColor: accentColor }}
            >
              <Camera className="w-4 h-4" />
              {uploading ? 'Compartiendo foto...' : 'Compartir Foto Instantánea 📸'}
            </button>
          )}
        </form>
      </div>

      {/* Gallery of active temporary photos */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-[#6E6461] uppercase tracking-wider">
          Muro de Momentos ({photos.length})
        </h3>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-dashed rounded-full animate-spin mx-auto" style={{ borderColor: accentColor }} />
            <p className="text-xs text-[#9c8e8a] mt-2">Cargando momentos...</p>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-10 bg-white/50 border border-dashed border-[#E8DFFF] rounded-3xl p-6">
            <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-[#2C2523]">No hay fotos compartidas aún</p>
            <p className="text-[11px] text-[#9c8e8a] mt-1">¡Toma una foto instantánea para sorprender a tu pareja!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <AnimatePresence>
              {photos.map((photo) => {
                const timeLeft = getRemainingTimeStr(photo.expiresAt);
                const isOwn = photo.senderId === user.id;

                return (
                  <motion.div
                    key={photo.id}
                    id={`photo-card-${photo.id}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="bg-white p-4 pb-6 rounded-xs shadow-md border border-[#E8DFFF] relative transform rotate-1 hover:rotate-0 transition-transform duration-300"
                    style={{ fontFamily: '"Inter", sans-serif' }}
                  >
                    {/* Expiration overlay sticker */}
                    <div className="absolute top-2 right-2 bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1 z-10">
                      <Clock className="w-3 h-3" /> {timeLeft}
                    </div>

                    {/* Image Area */}
                    <div className="aspect-square bg-gray-100 rounded-sm overflow-hidden mb-4 border border-gray-100">
                      <img 
                        src={photo.imageUrl} 
                        alt="Momento" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Polaroid Handwritten Caption / Meta */}
                    <div className="space-y-2 px-1">
                      {photo.caption ? (
                        <p className="text-sm font-semibold text-[#2C2523] italic leading-tight text-center break-words">
                          "{photo.caption}"
                        </p>
                      ) : (
                        <p className="text-xs text-[#9c8e8a] italic text-center">Sin descripción</p>
                      )}

                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-[#6E6461]">
                        <span className="font-bold flex items-center gap-1">
                          <Heart className="w-3 h-3 fill-current text-rose-400" />
                          De: {photo.senderName}
                        </span>
                        
                        {isOwn && (
                          <button
                            id={`delete-photo-btn-${photo.id}`}
                            onClick={() => handleDeletePhoto(photo.id)}
                            className="text-rose-500 hover:text-rose-700 p-1 rounded-full hover:bg-rose-50 transition cursor-pointer"
                            title="Eliminar foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
