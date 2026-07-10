import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  doc, 
  updateDoc, 
  collection, 
  onSnapshot, 
  setDoc,
  query,
  where,
  orderBy,
  addDoc
} from 'firebase/firestore';
import { 
  Heart, 
  Calendar, 
  Gift, 
  Sparkles, 
  MessageSquare, 
  Smile, 
  Activity, 
  Send,
  Plus,
  Clock,
  BookOpen,
  PlusCircle,
  HelpCircle,
  LogOut,
  ChevronRight,
  UserCheck,
  Camera
} from 'lucide-react';
import { UserProfile, Couple, Coupon } from '../types';
import { calculateCycleStats, CycleStats } from '../utils/cycle';
import { COUPON_PRESETS } from '../constants';
import InstantPhotos from './InstantPhotos';

interface ElDashboardProps {
  user: UserProfile;
  coupleId: string;
  onLogout: () => void;
}

export default function ElDashboard({ user, coupleId, onLogout }: ElDashboardProps) {
  // Real-time states
  const [couple, setCouple] = useState<Couple | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [messagesHistory, setMessagesHistory] = useState<{ id: string; text: string; timestamp: string }[]>([]);

  // Local state
  const [activeTab, setActiveTab] = useState<'monitor' | 'coupons' | 'messages' | 'photos'>('monitor');
  const [newSweetMessage, setNewSweetMessage] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [msgSuccess, setMsgSuccess] = useState(false);

  // New coupon creation state
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [customCouponTitle, setCustomCouponTitle] = useState('');
  const [customCouponDesc, setCustomCouponDesc] = useState('');
  const [isCreatingCoupon, setIsCreatingCoupon] = useState(false);

  // 1. Listen to Couple document
  useEffect(() => {
    if (!coupleId) return;
    const coupleRef = doc(db, 'couples', coupleId);
    const unsubscribe = onSnapshot(coupleRef, (docSnap) => {
      if (docSnap.exists()) {
        setCouple(docSnap.data() as Couple);
      }
    });
    return () => unsubscribe();
  }, [coupleId]);

  // 2. Listen to Coupons
  useEffect(() => {
    if (!coupleId) return;
    const couponsRef = collection(db, 'coupons');
    const q = query(couponsRef, where('coupleId', '==', coupleId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Coupon[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Coupon);
      });
      // Sort coupons: redeemed first (to make it easy to see what she wants), then active, then created date
      list.sort((a, b) => {
        if (a.isRedeemed && !b.isRedeemed) return -1;
        if (!a.isRedeemed && b.isRedeemed) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setCoupons(list);
    });
    return () => unsubscribe();
  }, [coupleId]);

  // 3. Listen to messages history
  useEffect(() => {
    if (!coupleId) return;
    const alertsRef = collection(db, 'alerts');
    const q = query(
      alertsRef,
      where('coupleId', '==', coupleId),
      where('type', '==', 'new_message'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: { id: string; text: string; timestamp: string }[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          text: data.message.replace(/^"|"$/g, ''), // Clean quotes
          timestamp: data.timestamp
        });
      });
      setMessagesHistory(msgs);
    });
    return () => unsubscribe();
  }, [coupleId]);

  if (!couple) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4 text-center p-6">
          <Heart className="w-10 h-10 text-[#FFB399] animate-pulse" />
          <p className="text-sm text-[#6E6461]">Cargando rincón secreto de {user.displayName}...</p>
        </div>
      </div>
    );
  }

  // Calculate cycle stats of her
  const cycleStats: CycleStats = calculateCycleStats(
    couple.lastPeriodDate,
    couple.cycleLength,
    couple.periodLength
  );

  // Send sweet message of the day
  const handleSendSweetMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMsg = newSweetMessage.trim();
    if (!cleanMsg) return;

    setIsSendingMsg(true);

    try {
      const coupleRef = doc(db, 'couples', couple.id);
      
      // Update couple's sweet message
      await updateDoc(coupleRef, {
        sweetMessage: cleanMsg,
        sweetMessageTime: new Date().toISOString()
      });

      // Write alert for her
      const alertId = 'alert_' + Math.random().toString(36).substring(2, 15);
      await setDoc(doc(db, 'alerts', alertId), {
        id: alertId,
        coupleId: couple.id,
        senderId: user.id,
        recipientId: couple.ellaId,
        type: 'new_message',
        title: '💌 Mensaje Bonito',
        message: `"${cleanMsg}"`, // wrap in quote
        isRead: false,
        timestamp: new Date().toISOString()
      });

      setNewSweetMessage('');
      setMsgSuccess(true);
      setTimeout(() => setMsgSuccess(false), 4000);
    } catch (e) {
      console.error("Error sending sweet message:", e);
    } finally {
      setIsSendingMsg(false);
    }
  };

  // Create a new coupon
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = customCouponTitle.trim();
    const desc = customCouponDesc.trim();

    if (!title || !desc) return;
    setIsCreatingCoupon(true);

    try {
      const couponId = 'coupon_' + Math.random().toString(36).substring(2, 15);
      
      await setDoc(doc(db, 'coupons', couponId), {
        id: couponId,
        coupleId: couple.id,
        title: title,
        description: desc,
        isRedeemed: false,
        createdAt: new Date().toISOString()
      });

      // Write notification for her
      const alertId = 'alert_' + Math.random().toString(36).substring(2, 15);
      await setDoc(doc(db, 'alerts', alertId), {
        id: alertId,
        coupleId: couple.id,
        senderId: user.id,
        recipientId: couple.ellaId,
        type: 'coupon_redeem',
        title: '🎟️ ¡Nuevo Cupón de Amor!',
        message: `¡${user.displayName} ha añadido un nuevo vale a tu cuponera: "${title}"!`,
        isRead: false,
        timestamp: new Date().toISOString()
      });

      setCustomCouponTitle('');
      setCustomCouponDesc('');
      setShowCouponModal(false);
    } catch (e) {
      console.error("Error creating coupon:", e);
    } finally {
      setIsCreatingCoupon(false);
    }
  };

  // Load a preset coupon details into input
  const loadPreset = (preset: { title: string; description: string }) => {
    setCustomCouponTitle(preset.title);
    setCustomCouponDesc(preset.description);
  };

  return (
    <div className="min-h-screen bg-transparent pb-24">
      {/* Top Header */}
      <header className="sticky top-0 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-[#E8DFFF] px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#F6F3FF] flex items-center justify-center">
            <Heart className="w-4 h-4 text-[#9176EB] fill-[#9176EB]" />
          </div>
          <span className="font-display font-bold text-lg text-[#2C2523]">Phadiscon LOVE</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="logout-btn"
            onClick={onLogout}
            className="p-2.5 hover:bg-rose-50 text-rose-500 rounded-full transition flex items-center gap-1 text-sm font-medium"
            title="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl mx-auto px-4 pt-6 space-y-6">

        {/* 1. MONITOR TAB */}
        {activeTab === 'monitor' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Welcome message */}
            <div className="flex items-center gap-3">
              <span className="text-3xl">🤵</span>
              <div>
                <h1 className="text-2xl font-display font-extrabold text-[#2C2523]">Hola, {user.displayName}</h1>
                <p className="text-xs text-[#6E6461]">Monitoreo de tu pareja en tiempo real.</p>
              </div>
            </div>

            {/* Dedicatoria Especial */}
            <div className="bg-gradient-to-r from-[#FFF0F2] to-[#FFF5F6] border-2 border-[#FFD5D9] p-5 rounded-3xl shadow-xs text-center relative overflow-hidden flex flex-col items-center gap-2">
              <span className="absolute -top-3 -right-3 text-4xl opacity-15 select-none rotate-12">💖</span>
              <span className="absolute -bottom-3 -left-3 text-4xl opacity-15 select-none -rotate-12">❤️</span>
              <div className="w-8 h-8 rounded-full bg-[#FFE5EC] flex items-center justify-center animate-pulse">
                <Heart className="w-4 h-4 text-[#FF8A9B] fill-[#FF8A9B]" />
              </div>
              <h2 className="font-display text-lg font-extrabold text-[#7D323E] leading-snug">
                Te amo por siempre Antonia, espero que te guste la app &lt;3
              </h2>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* Cycle Card */}
              <div className="bg-white border border-[#E8DFFF] p-5 rounded-3xl shadow-sm text-center relative overflow-hidden flex flex-col justify-between">
                <div 
                  className="absolute top-0 left-0 right-0 h-1" 
                  style={{ backgroundColor: cycleStats.phaseInfo.color }}
                />
                <div>
                  <span className="text-[10px] font-bold text-[#9c8e8a] uppercase tracking-wider block mb-1">
                    Fase de {couple.ellaName}
                  </span>
                  <h4 
                    className="text-lg font-display font-extrabold tracking-tight"
                    style={{ color: cycleStats.phaseInfo.color }}
                  >
                    {cycleStats.phase}
                  </h4>
                </div>

                <div className="my-3">
                  <span className="text-4xl font-display font-extrabold text-[#2C2523] block leading-none">
                    Día {cycleStats.currentDay}
                  </span>
                  <span className="text-[10px] font-medium text-[#6E6461] uppercase tracking-wide">
                    Del ciclo de {couple.cycleLength} d
                  </span>
                </div>

                <div className="text-[10px] font-bold text-gray-500 flex items-center justify-center gap-1 mt-1 bg-gray-50 py-1.5 rounded-xl">
                  <Clock className="w-3.5 h-3.5 text-[#FFB399]" />
                  Regla en: {cycleStats.daysUntilNextPeriod} días
                </div>
              </div>

              {/* Mood Card */}
              <div className="bg-white border border-[#E8DFFF] p-5 rounded-3xl shadow-sm text-center relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-300" />
                <div>
                  <span className="text-[10px] font-bold text-[#9c8e8a] uppercase tracking-wider block mb-1">
                    Humor de {couple.ellaName}
                  </span>
                  <h4 className="text-lg font-display font-extrabold text-indigo-700 tracking-tight">
                    {couple.currentMoodLabel || 'Feliz'}
                  </h4>
                </div>

                <div className="my-2 text-5xl select-none animate-bounce">
                  {couple.currentMood || '😊'}
                </div>

                <div className="text-[9px] text-[#9c8e8a] flex items-center justify-center gap-1 mt-1 bg-gray-50 py-1.5 rounded-xl">
                  <Clock className="w-3 h-3" />
                  Sincronizado: {couple.currentMoodDate ? 'Hoy' : 'Recientemente'}
                </div>
              </div>

            </div>

            {/* Survival Manual (Dynamic automated tips depending on her phase) */}
            <div 
              className="border p-6 rounded-3xl shadow-sm space-y-4 relative overflow-hidden"
              style={{ 
                backgroundColor: cycleStats.phaseInfo.bgLight, 
                borderColor: cycleStats.phaseInfo.borderAccent 
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-extrabold text-base text-[#2C2523] flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-[#9176EB]" /> Manual de Supervivencia: Fase {cycleStats.phase}
                </h3>
                <span className="text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full text-white bg-[#2C2523] shadow-xs">
                  Consejos Clave
                </span>
              </div>

              <p className="text-xs text-[#2C2523] leading-relaxed font-medium bg-white/70 p-3 rounded-2xl border border-dashed border-gray-100">
                Como {couple.ellaName} está en su **Fase {cycleStats.phase}**, su cuerpo experimenta cambios biológicos. Sigue estos tips empáticos de apoyo para hacerla sentir amada:
              </p>

              <ul className="space-y-3 pl-1">
                {cycleStats.phaseInfo.tipsForHim.map((tip: string, i: number) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-[#6E6461] leading-relaxed font-medium">
                    <span className="text-[#9176EB] text-base leading-none">🧸</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Form to leave the sweet message */}
            <div className="bg-white border border-[#E8DFFF] p-6 rounded-3xl shadow-sm">
              <h3 className="font-display font-bold text-base text-[#2C2523] mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-5 h-5 text-[#FFB399]" /> Envía el "Mensaje Bonito del Día"
              </h3>
              <p className="text-xs text-[#6E6461] mb-4">
                Redacta un mensaje tierno. Aparecerá en letras gigantes en la pantalla de inicio de {couple.ellaName} de forma instantánea.
              </p>

              <form onSubmit={handleSendSweetMessage} className="space-y-3">
                <div className="relative">
                  <textarea
                    id="sweet-message-textarea"
                    rows={3}
                    maxLength={180}
                    placeholder="Escribe algo dulce (ej: ¡Buenos días princesa! Recuerda que te amo con todo mi ser y hoy te consentiré... 💝)"
                    value={newSweetMessage}
                    onChange={(e) => setNewSweetMessage(e.target.value)}
                    className="w-full px-4 py-3 border border-[#E8DFFF] rounded-2xl focus:border-[#9176EB] focus:outline-none text-sm text-[#2C2523] bg-[#FDFBF7] pr-10 resize-none"
                  />
                  <span className="absolute bottom-2.5 right-3 text-[10px] text-gray-400 font-bold">
                    {newSweetMessage.length}/180
                  </span>
                </div>

                {msgSuccess && (
                  <p id="msg-success-alert" className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    ✓ ¡Mensaje bonito enviado y sincronizado con éxito! 💌
                  </p>
                )}

                <button
                  id="send-msg-btn"
                  type="submit"
                  disabled={isSendingMsg || !newSweetMessage.trim()}
                  className="w-full py-3.5 bg-[#9176EB] hover:bg-[#7a5ce0] text-white font-bold text-sm rounded-2xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSendingMsg ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Enviar Mensaje de Amor
                    </>
                  )}
                </button>
              </form>
            </div>

          </div>
        )}


        {/* 2. COUPONS TAB */}
        {activeTab === 'coupons' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-display font-extrabold text-[#2C2523]">Vales & Cupones</h1>
              <button
                id="open-create-coupon-btn"
                onClick={() => setShowCouponModal(true)}
                className="bg-[#9176EB] hover:bg-[#7a5ce0] text-white text-xs font-bold px-4 py-2.5 rounded-2xl transition flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" /> Crear Nuevo Vale
              </button>
            </div>

            <p className="text-xs text-[#6E6461] -mt-2">
              Aquí puedes ver todos los vales de amor que {couple.ellaName} tiene activos y cuáles ha canjeado recientemente para que los cumplas.
            </p>

            <div className="space-y-4">
              {coupons.length === 0 ? (
                <p className="text-xs text-[#9c8e8a] italic text-center py-8">No hay cupones creados aún.</p>
              ) : (
                coupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className={`relative border p-5 rounded-3xl transition overflow-hidden ${
                      coupon.isRedeemed
                        ? 'bg-[#FFF2EE] border-[#FFB399] ring-1 ring-[#FFD5C6]'
                        : 'bg-white border-[#E8DFFF]'
                    }`}
                  >
                    {/* Ticket cutouts */}
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#FDFBF7] rounded-full border-r border-gray-200"></div>
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#FDFBF7] rounded-full border-l border-gray-200"></div>

                    <div className="pl-4 pr-4 flex items-start justify-between">
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2">
                          <h4 className="font-display font-bold text-base text-[#2C2523]">
                            {coupon.title}
                          </h4>
                          {coupon.isRedeemed && (
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                              ¡CANJEADO!
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#6E6461] leading-relaxed">{coupon.description}</p>
                        
                        {coupon.isRedeemed ? (
                          <div className="text-[10px] text-rose-700 font-extrabold flex items-center gap-1 mt-2.5">
                            <Clock className="w-3.5 h-3.5 text-rose-400" />
                            Canjeado el: {coupon.redeemedAt ? new Date(coupon.redeemedAt).toLocaleDateString() : 'hoy'}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full mt-2.5 border border-emerald-100">
                            Activo en su cuponera
                          </span>
                        )}
                      </div>

                      <div className="flex-shrink-0">
                        {coupon.isRedeemed ? (
                          <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center border border-rose-200 text-rose-500">
                            ❤️
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200 text-gray-400">
                            🎟️
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>
        )}


        {/* 3. MESSAGES HISTORY TAB */}
        {activeTab === 'messages' && (
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-display font-extrabold text-[#2C2523]">Historial de Mensajes</h1>
            <p className="text-xs text-[#6E6461] -mt-2">
              Aquí puedes ver un registro cronológico de todos los mensajes tiernos que le has enviado a {couple.ellaName}.
            </p>

            <div className="bg-white border border-[#E8DFFF] p-5 rounded-3xl shadow-sm">
              {messagesHistory.length === 0 ? (
                <p className="text-xs text-[#9c8e8a] italic text-center py-8">Aún no has enviado mensajes.</p>
              ) : (
                <div className="space-y-3">
                  {messagesHistory.map((msg) => (
                    <div key={msg.id} className="bg-[#FDFBF7] p-4 rounded-2xl border border-gray-100 text-xs relative">
                      <p className="text-[#2C2523] italic font-medium">"{msg.text}"</p>
                      <div className="text-[10px] text-gray-500 mt-2 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        {new Date(msg.timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}, {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="animate-fade-in">
            <InstantPhotos user={user} coupleId={coupleId} accentColor="#9176EB" />
          </div>
        )}

      </main>

      {/* CREATE NEW COUPON MODAL */}
      {showCouponModal && (
        <div className="fixed inset-0 z-50 bg-[#2C2523]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8DFFF] p-6 rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fade-in space-y-4">
            <h3 className="font-display font-extrabold text-xl text-[#2C2523] flex items-center gap-2">
              🎟️ Crear un nuevo Vale de Amor
            </h3>
            
            <p className="text-xs text-[#6E6461]">
              Puedes redactar un cupón personalizado o elegir uno de los preajustes de abajo para rellenar los datos rápidamente.
            </p>

            {/* Presets Grid */}
            <div>
              <span className="block text-[10px] font-bold text-[#6E6461] uppercase tracking-wider mb-2">Sugerencias rápidas</span>
              <div className="flex flex-wrap gap-2">
                {COUPON_PRESETS.map((preset) => (
                  <button
                    id={`coupon-preset-${preset.title}`}
                    key={preset.title}
                    type="button"
                    onClick={() => loadPreset(preset)}
                    className="text-[10px] font-bold text-indigo-700 bg-[#F6F3FF] border border-[#E8DFFF] px-2.5 py-1.5 rounded-full hover:bg-[#E8DFFF] transition cursor-pointer"
                  >
                    + {preset.title}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-[#6E6461] uppercase tracking-wider mb-1">
                  Título del cupón
                </label>
                <input
                  id="new-coupon-title-input"
                  type="text"
                  placeholder="ej: Vale por una cena romántica"
                  value={customCouponTitle}
                  onChange={(e) => setCustomCouponTitle(e.target.value)}
                  maxLength={40}
                  className="w-full px-4 py-3 border border-[#E8DFFF] rounded-2xl focus:border-[#9176EB] focus:outline-none text-sm text-[#2C2523] bg-[#FDFBF7]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#6E6461] uppercase tracking-wider mb-1">
                  Descripción / Reglas del vale
                </label>
                <textarea
                  id="new-coupon-desc-textarea"
                  rows={3}
                  placeholder="ej: El portador de este vale tiene derecho a elegir su cena favorita preparada por él, con postre incluido."
                  value={customCouponDesc}
                  onChange={(e) => setCustomCouponDesc(e.target.value)}
                  maxLength={150}
                  className="w-full px-4 py-3 border border-[#E8DFFF] rounded-2xl focus:border-[#9176EB] focus:outline-none text-sm text-[#2C2523] bg-[#FDFBF7] resize-none"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  id="close-coupon-modal-btn"
                  type="button"
                  onClick={() => setShowCouponModal(false)}
                  className="flex-1 py-3 text-sm font-semibold border border-[#E8DFFF] text-[#6E6461] rounded-2xl hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="save-coupon-modal-btn"
                  type="submit"
                  disabled={isCreatingCoupon || !customCouponTitle.trim() || !customCouponDesc.trim()}
                  className="flex-1 py-3 text-sm font-bold bg-[#9176EB] hover:bg-[#7a5ce0] text-white rounded-2xl transition shadow-xs cursor-pointer flex justify-center items-center"
                >
                  {isCreatingCoupon ? 'Creando...' : 'Regalar Vale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav id="bottom-navigation" className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8DFFF] py-3 px-6 flex items-center justify-around z-30 shadow-md">
        <button
          id="nav-monitor-btn"
          onClick={() => setActiveTab('monitor')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'monitor' ? 'text-[#9176EB] font-extrabold scale-105' : 'text-[#9c8e8a] hover:text-[#2C2523]'}`}
        >
          <Activity className="w-6 h-6" />
          <span className="text-[10px]">Monitoreo</span>
        </button>
        <button
          id="nav-coupons-btn"
          onClick={() => setActiveTab('coupons')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'coupons' ? 'text-[#9176EB] font-extrabold scale-105' : 'text-[#9c8e8a] hover:text-[#2C2523]'}`}
        >
          <Gift className="w-6 h-6" />
          <span className="text-[10px]">Vales Regalo</span>
        </button>
        <button
          id="nav-messages-btn"
          onClick={() => setActiveTab('messages')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'messages' ? 'text-[#9176EB] font-extrabold scale-105' : 'text-[#9c8e8a] hover:text-[#2C2523]'}`}
        >
          <MessageSquare className="w-6 h-6" />
          <span className="text-[10px]">Mensajes</span>
        </button>
        <button
          id="nav-photos-btn"
          onClick={() => setActiveTab('photos')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'photos' ? 'text-[#9176EB] font-extrabold scale-105' : 'text-[#9c8e8a] hover:text-[#2C2523]'}`}
        >
          <Camera className="w-6 h-6" />
          <span className="text-[10px]">Fotos 24h</span>
        </button>
      </nav>
    </div>
  );
}
