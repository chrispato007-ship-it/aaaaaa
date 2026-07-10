import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { Bell, Heart, Gift, MessageCircle, AlertCircle, X, CheckCheck } from 'lucide-react';
import { CoupleAlert } from '../types';

interface NotificationsProps {
  coupleId: string;
  userId: string;
}

export default function Notifications({ coupleId, userId }: NotificationsProps) {
  const [activeAlerts, setActiveAlerts] = useState<CoupleAlert[]>([]);
  const [showToasts, setShowToasts] = useState<CoupleAlert[]>([]);

  useEffect(() => {
    if (!coupleId || !userId) return;

    // Listen for unread alerts for this recipient
    const alertsRef = collection(db, 'alerts');
    const q = query(
      alertsRef,
      where('coupleId', '==', coupleId),
      where('isRead', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: CoupleAlert[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Check if the current user is the target recipient
        if (data.recipientId === userId || data.recipientId === 'both') {
          list.push({
            id: doc.id,
            coupleId: data.coupleId,
            senderId: data.senderId,
            recipientId: data.recipientId,
            type: data.type,
            title: data.title,
            message: data.message,
            isRead: data.isRead,
            timestamp: data.timestamp
          });
        }
      });

      // Sort by timestamp descending
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // If we got new alerts, we can trigger toast popups
      // Compare with previous state to find genuinely new ones
      const newToasts: CoupleAlert[] = [];
      list.forEach(alert => {
        const isAlreadyKnown = activeAlerts.some(a => a.id === alert.id);
        if (!isAlreadyKnown && alert.senderId !== userId) {
          // Play a soft bell or trigger alert vibration/sound if possible
          try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            oscillator.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.15); // G5
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.4);
          } catch (e) {
            // Ignore if browser block audio context before user interaction
          }
          newToasts.push(alert);
        }
      });

      if (newToasts.length > 0) {
        setShowToasts(prev => [...newToasts, ...prev].slice(0, 3)); // Max 3 toasts at a time
      }

      setActiveAlerts(list);
    });

    return () => unsubscribe();
  }, [coupleId, userId, activeAlerts]);

  // Automatically dismiss toast after 6 seconds
  useEffect(() => {
    if (showToasts.length > 0) {
      const timer = setTimeout(() => {
        setShowToasts(prev => prev.slice(0, -1));
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [showToasts]);

  const handleDismissToast = (id: string) => {
    setShowToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'alerts', id), { isRead: true });
      setShowToasts(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error("Error marking alert as read:", e);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      for (const alert of activeAlerts) {
        await updateDoc(doc(db, 'alerts', alert.id), { isRead: true });
      }
      setShowToasts([]);
    } catch (e) {
      console.error("Error marking all read:", e);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'sos':
        return <Heart className="w-5 h-5 text-rose-500 fill-current animate-pulse" />;
      case 'coupon_redeem':
        return <Gift className="w-5 h-5 text-amber-500" />;
      case 'new_message':
        return <MessageCircle className="w-5 h-5 text-indigo-500" />;
      default:
        return <Bell className="w-5 h-5 text-emerald-500" />;
    }
  };

  return (
    <>
      {/* Floating In-App Toasts */}
      <div id="toast-wrapper" className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4">
        {showToasts.map((toast) => (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className="flex items-start bg-white border border-[#E8DFFF] p-4 rounded-2xl shadow-lg animate-slide-in relative overflow-hidden"
          >
            {/* Color Accent Indicator */}
            <div 
              className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                toast.type === 'sos' ? 'bg-rose-500' :
                toast.type === 'coupon_redeem' ? 'bg-amber-400' :
                toast.type === 'new_message' ? 'bg-indigo-400' : 'bg-emerald-400'
              }`}
            />
            
            <div className="flex-shrink-0 ml-1 mr-3 mt-0.5">
              {getIcon(toast.type)}
            </div>
            
            <div className="flex-grow pr-6">
              <h4 className="font-display font-bold text-sm text-[#2C2523]">{toast.title}</h4>
              <p className="text-xs text-[#6E6461] mt-0.5">{toast.message}</p>
              <button
                id={`toast-read-btn-${toast.id}`}
                onClick={() => handleMarkAsRead(toast.id)}
                className="mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wide flex items-center gap-1 cursor-pointer"
              >
                Entendido ✓
              </button>
            </div>

            <button
              id={`toast-close-btn-${toast.id}`}
              onClick={() => handleDismissToast(toast.id)}
              className="absolute top-2 right-2 text-[#9c8e8a] hover:text-[#2C2523] p-1 rounded-full hover:bg-gray-100 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Embedded Alert Drawer / List toggle header if there are active alerts */}
      {activeAlerts.length > 0 && (
        <div id="alerts-indicator-banner" className="bg-[#FFF2EE] border-b border-[#FFB399] py-2 px-4 text-center relative flex items-center justify-between">
          <div className="flex items-center gap-2 justify-center w-full">
            <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            <span className="text-xs font-semibold text-rose-800">
              Tienes {activeAlerts.length} notificación{activeAlerts.length > 1 ? 'es' : ''} de tu amor sin leer
            </span>
            <button
              id="alerts-mark-all-btn"
              onClick={handleMarkAllRead}
              className="text-xs font-bold text-rose-700 hover:text-rose-900 underline ml-2 cursor-pointer flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como leídas
            </button>
          </div>
        </div>
      )}
    </>
  );
}
