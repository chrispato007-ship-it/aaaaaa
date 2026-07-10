import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  doc, 
  updateDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { 
  Heart, 
  Calendar as CalendarIcon, 
  Gift, 
  Sparkles, 
  MessageSquare, 
  Smile, 
  Activity, 
  Send,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Info,
  LogOut,
  Sliders,
  Settings,
  Camera
} from 'lucide-react';
import { UserProfile, Couple, Coupon, SymptomLog } from '../types';
import { calculateCycleStats, PHASES_CONFIG, CycleStats } from '../utils/cycle';
import { MOODS, CRAMPS_OPTIONS, FLOW_OPTIONS, ENERGY_OPTIONS } from '../constants';
import InstantPhotos from './InstantPhotos';

interface EllaDashboardProps {
  user: UserProfile;
  coupleId: string;
  onLogout: () => void;
}

export default function EllaDashboard({ user, coupleId, onLogout }: EllaDashboardProps) {
  // Real-time state
  const [couple, setCouple] = useState<Couple | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [symptoms, setSymptoms] = useState<SymptomLog[]>([]);
  
  // Local UI state
  const [activeTab, setActiveTab] = useState<'home' | 'calendar' | 'love' | 'photos'>('home');
  const [messageInput, setMessageInput] = useState('');
  const [sosSending, setSosSending] = useState(false);
  const [sosMessageSent, setSosMessageSent] = useState(false);
  
  // Menstrual Settings / Editing
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [tempCycleLength, setTempCycleLength] = useState(28);
  const [tempPeriodLength, setTempPeriodLength] = useState(5);
  const [tempLastPeriod, setTempLastPeriod] = useState('');

  // Calendar logic state
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [selectedDayLog, setSelectedDayLog] = useState<Partial<SymptomLog> | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [isSavingSymptom, setIsSavingSymptom] = useState(false);

  // Message history list for "Rincón de Amor"
  const [messagesHistory, setMessagesHistory] = useState<{ id: string; text: string; timestamp: string }[]>([]);

  // 1. Listen to Couple document
  useEffect(() => {
    if (!coupleId) return;
    const coupleRef = doc(db, 'couples', coupleId);
    const unsubscribe = onSnapshot(coupleRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Couple;
        setCouple(data);
        // Sync defaults to settings
        setTempCycleLength(data.cycleLength || 28);
        setTempPeriodLength(data.periodLength || 5);
        setTempLastPeriod(data.lastPeriodDate || '');
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
      // Sort coupons: active first, then redeemed, then by title
      list.sort((a, b) => {
        if (a.isRedeemed && !b.isRedeemed) return 1;
        if (!a.isRedeemed && b.isRedeemed) return -1;
        return a.title.localeCompare(b.title);
      });
      setCoupons(list);
    });
    return () => unsubscribe();
  }, [coupleId]);

  // 3. Listen to Symptoms History for current couple
  useEffect(() => {
    if (!coupleId) return;
    const symptomsRef = collection(db, 'symptoms');
    const q = query(symptomsRef, where('coupleId', '==', coupleId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: SymptomLog[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as SymptomLog);
      });
      setSymptoms(list);
    });
    return () => unsubscribe();
  }, [coupleId]);

  // 4. Fetch message history
  useEffect(() => {
    if (!coupleId) return;
    const alertsRef = collection(db, 'alerts');
    // We can also treat messages_history directly or fetch sweet message alerts
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
          text: data.message.replace(/^"|"$/g, ''), // Clean wrapper quotes
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
          <p className="text-sm text-[#6E6461]">Cargando tu rincón secreto...</p>
        </div>
      </div>
    );
  }

  // Compute menstrual stats
  const cycleStats: CycleStats = calculateCycleStats(
    couple.lastPeriodDate,
    couple.cycleLength,
    couple.periodLength
  );

  // Update Mood Bubble
  const handleMoodSelect = async (emoji: string, label: string) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const coupleRef = doc(db, 'couples', couple.id);
      
      // Update couple's mood state
      await updateDoc(coupleRef, {
        currentMood: emoji,
        currentMoodLabel: label,
        currentMoodDate: todayStr
      });

      // Insert an alert for him in Firestore
      const alertId = 'alert_' + Math.random().toString(36).substring(2, 15);
      await setDoc(doc(db, 'alerts', alertId), {
        id: alertId,
        coupleId: couple.id,
        senderId: user.id,
        recipientId: couple.elId,
        type: 'mood_change',
        title: '💓 Cambio de Ánimo',
        message: `${user.displayName} se siente "${label} ${emoji}" ahora mismo. ¡Envíale una palabra de aliento!`,
        isRead: false,
        timestamp: new Date().toISOString()
      });

      // Save as symptom entry for today if not already existing
      const symptomId = `symptom_${couple.id}_${todayStr}`;
      const existingDocRef = doc(db, 'symptoms', symptomId);
      await setDoc(existingDocRef, {
        id: symptomId,
        coupleId: couple.id,
        date: todayStr,
        mood: emoji,
        moodLabel: label,
        cramps: 'none',
        flow: 'none',
        energy: 'medium',
        notes: `Mood rápido actualizado en el inicio: ${label}`
      }, { merge: true });

    } catch (e) {
      console.error("Error saving mood:", e);
    }
  };

  // SOS button: "Necesito un abrazo"
  const handleSOS = async () => {
    if (sosSending) return;
    setSosSending(true);

    try {
      const alertId = 'alert_' + Math.random().toString(36).substring(2, 15);
      await setDoc(doc(db, 'alerts', alertId), {
        id: alertId,
        coupleId: couple.id,
        senderId: user.id,
        recipientId: couple.elId,
        type: 'sos',
        title: '🚨 ¡SOS de Amor!',
        message: `¡${user.displayName} ha presionado el botón "Necesito un abrazo"! Deja todo lo que estés haciendo y corre a mimarla o envíale amor infinito. ❤️🫂`,
        isRead: false,
        timestamp: new Date().toISOString()
      });

      setSosMessageSent(true);
      setTimeout(() => setSosMessageSent(false), 5000);
    } catch (e) {
      console.error("Error sending SOS:", e);
    } finally {
      setSosSending(false);
    }
  };

  // Redeem Coupon
  const handleRedeemCoupon = async (coupon: Coupon) => {
    try {
      // Update coupon in db
      await updateDoc(doc(db, 'coupons', coupon.id), {
        isRedeemed: true,
        redeemedAt: new Date().toISOString()
      });

      // Notify him
      const alertId = 'alert_' + Math.random().toString(36).substring(2, 15);
      await setDoc(doc(db, 'alerts', alertId), {
        id: alertId,
        coupleId: couple.id,
        senderId: user.id,
        recipientId: couple.elId,
        type: 'coupon_redeem',
        title: '🎟️ Cupón Canjeado',
        message: `¡${user.displayName} ha canjeado el cupón: "${coupon.title}"! Vale por: ${coupon.description}. ¡Te toca cumplirlo! 😉`,
        isRead: false,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error redeeming coupon:", e);
    }
  };

  // Save Cycle Settings
  const handleSaveSettings = async () => {
    try {
      const coupleRef = doc(db, 'couples', couple.id);
      await updateDoc(coupleRef, {
        cycleLength: Number(tempCycleLength),
        periodLength: Number(tempPeriodLength),
        lastPeriodDate: tempLastPeriod
      });

      // Alert him about the period/cycle update
      const alertId = 'alert_' + Math.random().toString(36).substring(2, 15);
      await setDoc(doc(db, 'alerts', alertId), {
        id: alertId,
        coupleId: couple.id,
        senderId: user.id,
        recipientId: couple.elId,
        type: 'cycle_update',
        title: '📅 Calendario Actualizado',
        message: `${user.displayName} ha actualizado las fechas de su ciclo menstrual. La fase actual ahora se recalcula en tiempo real.`,
        isRead: false,
        timestamp: new Date().toISOString()
      });

      setShowSettingsModal(false);
    } catch (e) {
      console.error("Error saving cycle settings:", e);
    }
  };

  // Calendar helper calculations
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    // 0 = Sunday, 1 = Monday, etc. Let's adjust so 1 = Monday, 6 = Saturday, 0 = Sunday
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust standard JS Sun=0 to Mon=0
  };

  const handleMonthChange = (direction: 'prev' | 'next') => {
    const nextDate = new Date(currentCalendarDate);
    if (direction === 'prev') {
      nextDate.setMonth(nextDate.getMonth() - 1);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    setCurrentCalendarDate(nextDate);
  };

  const openDayDialog = (dayNum: number) => {
    const yyyy = currentCalendarDate.getFullYear();
    const mm = String(currentCalendarDate.getMonth() + 1).padStart(2, '0');
    const dd = String(dayNum).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    setSelectedDateStr(dateStr);
    
    // Check if we already have a log for this day
    const existingLog = symptoms.find(s => s.date === dateStr);
    if (existingLog) {
      setSelectedDayLog(existingLog);
    } else {
      // Default template for logging
      setSelectedDayLog({
        date: dateStr,
        mood: '😊',
        moodLabel: 'Feliz',
        cramps: 'none',
        flow: 'none',
        energy: 'medium',
        notes: ''
      });
    }
  };

  const handleSaveDayLog = async () => {
    if (!selectedDateStr || !selectedDayLog || !couple) return;
    setIsSavingSymptom(true);

    try {
      const logId = `symptom_${couple.id}_${selectedDateStr}`;
      const logData = {
        ...selectedDayLog,
        id: logId,
        coupleId: couple.id,
        date: selectedDateStr
      };

      await setDoc(doc(db, 'symptoms', logId), logData);

      // Optionally, if they modified the mood for "Today", update current couple mood
      const todayStr = new Date().toISOString().split('T')[0];
      if (selectedDateStr === todayStr) {
        await updateDoc(doc(db, 'couples', couple.id), {
          currentMood: selectedDayLog.mood,
          currentMoodLabel: selectedDayLog.moodLabel,
          currentMoodDate: todayStr
        });
      }

      setSelectedDateStr(null);
      setSelectedDayLog(null);
    } catch (e) {
      console.error("Error saving symptom log:", e);
    } finally {
      setIsSavingSymptom(false);
    }
  };

  // Helper to check if a calendar day falls inside the estimated menstruation period
  const getDayStatusForCalendar = (dayNum: number) => {
    const yyyy = currentCalendarDate.getFullYear();
    const mm = String(currentCalendarDate.getMonth() + 1).padStart(2, '0');
    const dd = String(dayNum).padStart(2, '0');
    const cellDateStr = `${yyyy}-${mm}-${dd}`;

    // 1. Is there an active custom log for this day?
    const hasLog = symptoms.find(s => s.date === cellDateStr);

    // 2. Is this day inside the calculated menstruation phase?
    // Let's check using calculateCycleStats for that specific day
    const cellStats = calculateCycleStats(couple.lastPeriodDate, couple.cycleLength, couple.periodLength);
    
    // We can also calculate the specific difference between cell date and last period
    const cellDate = new Date(yyyy, currentCalendarDate.getMonth(), dayNum);
    cellDate.setHours(0,0,0,0);
    const [pYear, pMonth, pDay] = couple.lastPeriodDate.split('-').map(Number);
    const periodStart = new Date(pYear, pMonth - 1, pDay);
    periodStart.setHours(0,0,0,0);

    const diff = cellDate.getTime() - periodStart.getTime();
    const daysDiff = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    let isPeriod = false;
    let isEstimatedOvulation = false;

    if (daysDiff >= 0) {
      const dayOfCycle = (daysDiff % couple.cycleLength) + 1;
      isPeriod = dayOfCycle >= 1 && dayOfCycle <= couple.periodLength;
      isEstimatedOvulation = dayOfCycle === (couple.cycleLength - 14);
    }

    return {
      isPeriod,
      isEstimatedOvulation,
      hasLog: !!hasLog,
      logEmoji: hasLog?.mood || ''
    };
  };

  // Generate list of days to display in the calendar grid
  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentCalendarDate);
    const firstDayIndex = getFirstDayOfMonth(currentCalendarDate);
    const days = [];

    // Empty spaces for previous month's offset
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(<div key={`empty-${i}`} className="h-14"></div>);
    }

    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const { isPeriod, isEstimatedOvulation, hasLog, logEmoji } = getDayStatusForCalendar(d);
      
      let dayBg = 'bg-[#FDFBF7] hover:bg-[#FFF2EE]';
      let borderStyle = 'border border-gray-100';
      let textStyle = 'text-[#2C2523]';

      if (isPeriod) {
        dayBg = 'bg-[#FFF2EE] hover:bg-[#FFE5DC]';
        borderStyle = 'border-2 border-[#FFB399]';
        textStyle = 'text-[#FF8155] font-bold';
      } else if (isEstimatedOvulation) {
        dayBg = 'bg-[#FEF8F0] hover:bg-[#FDE4C3]';
        borderStyle = 'border-2 border-[#F9CE99]';
        textStyle = 'text-amber-700 font-medium';
      }

      // Check if selected day is today
      const today = new Date();
      const isToday = today.getDate() === d && 
                      today.getMonth() === currentCalendarDate.getMonth() && 
                      today.getFullYear() === currentCalendarDate.getFullYear();

      days.push(
        <button
          id={`cal-day-btn-${d}`}
          key={`day-${d}`}
          onClick={() => openDayDialog(d)}
          className={`h-14 rounded-2xl flex flex-col justify-between p-1.5 transition relative cursor-pointer ${dayBg} ${borderStyle} ${isToday ? 'ring-2 ring-[#D4E0D1]' : ''}`}
        >
          <span className={`text-xs ${textStyle} ${isToday ? 'underline decoration-2' : ''}`}>{d}</span>
          <div className="flex justify-center items-center h-5">
            {logEmoji ? (
              <span className="text-sm select-none">{logEmoji}</span>
            ) : isPeriod ? (
              <span className="text-[10px] text-red-500">🌸</span>
            ) : isEstimatedOvulation ? (
              <span className="text-[10px] text-yellow-600">✨</span>
            ) : null}
          </div>
          {hasLog && !logEmoji && (
            <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#D4E0D1] rounded-full"></div>
          )}
        </button>
      );
    }

    return days;
  };

  const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  return (
    <div className="min-h-screen bg-transparent pb-24">
      {/* Top Header */}
      <header className="sticky top-0 bg-[#FDFBF7]/90 backdrop-blur-md border-b border-[#E8DFFF] px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#FFF2EE] flex items-center justify-center">
            <Heart className="w-4 h-4 text-[#FFB399] fill-[#FFB399]" />
          </div>
          <span className="font-display font-bold text-lg text-[#2C2523]">Phadiscon LOVE</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="open-settings-btn"
            onClick={() => setShowSettingsModal(true)}
            className="p-2.5 hover:bg-[#F3F7F2] rounded-full transition text-[#6E6461] hover:text-[#2C2523]"
            title="Ajustes del Ciclo"
          >
            <Settings className="w-5 h-5" />
          </button>
          
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

        {/* 1. HOME TAB */}
        {activeTab === 'home' && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Mensaje de Bienvenida */}
            <div className="flex items-center gap-3">
              <span className="text-3xl">🌸</span>
              <div>
                <h1 className="text-2xl font-display font-extrabold text-[#2C2523]">Hola, {user.displayName}</h1>
                <p className="text-xs text-[#6E6461]">Tu rincón privado con {couple.elName} está listo.</p>
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

            {/* Ciclo Circular Visualizer */}
            <div className="bg-white border border-[#E8DFFF] p-6 rounded-3xl shadow-sm text-center relative overflow-hidden">
              <div 
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: cycleStats.phaseInfo.color }}
              />

              <span className="text-xs font-bold tracking-wider uppercase text-[#6E6461] block mb-1">
                Fase del Ciclo
              </span>
              <h2 
                className="text-2xl font-display font-extrabold mb-4"
                style={{ color: cycleStats.phaseInfo.color }}
              >
                {cycleStats.phase}
              </h2>

              {/* Progress Ring */}
              <div className="relative w-44 h-44 mx-auto my-6 flex items-center justify-center">
                {/* SVG Circle indicator */}
                <svg className="absolute w-full h-full transform -rotate-90">
                  {/* Background Circle */}
                  <circle
                    cx="88"
                    cy="88"
                    r="76"
                    className="stroke-[#FDFBF7]"
                    strokeWidth="12"
                    fill="transparent"
                  />
                  {/* Foreground Animated Circle */}
                  <circle
                    cx="88"
                    cy="88"
                    r="76"
                    stroke={cycleStats.phaseInfo.color}
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={477}
                    strokeDashoffset={477 - (477 * cycleStats.progressPercent) / 100}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>

                {/* Inner Content */}
                <div className="z-10 flex flex-col items-center">
                  <span className="text-5xl font-display font-extrabold text-[#2C2523]">
                    {cycleStats.currentDay}
                  </span>
                  <span className="text-xs font-medium text-[#6E6461] uppercase tracking-wide mt-1">
                    Día del ciclo
                  </span>
                </div>
              </div>

              {/* Phase summary description */}
              <p className="text-xs text-[#6E6461] max-w-sm mx-auto leading-relaxed mt-2 italic px-3 bg-[#FDFBF7] py-3 rounded-2xl border border-dashed border-[#E8DFFF]">
                "{cycleStats.phaseInfo.description}"
              </p>

              {/* Period prediction line */}
              <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-center gap-1.5 text-sm font-semibold text-[#2C2523]">
                <Clock className="w-4 h-4 text-[#FFB399]" />
                Faltan <span className="text-[#FFB399] font-extrabold text-base">{cycleStats.daysUntilNextPeriod} días</span> para tu siguiente periodo.
              </div>
            </div>

            {/* Sweet message of the day */}
            <div className="bg-[#FFF2EE] border border-[#FFD5C6] p-6 rounded-3xl shadow-sm relative overflow-hidden">
              <div className="absolute top-3 right-3 text-2xl opacity-25">💝</div>
              <h3 className="font-display font-bold text-sm text-[#FF8155] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" /> Mensaje Bonito de {couple.elName}
              </h3>
              <p className="text-base text-[#2C2523] font-medium leading-relaxed italic pr-4">
                "{couple.sweetMessage || '¡Hola mi amor! Aún no te he dejado ningún mensaje para hoy, pero te amo infinitamente.'}"
              </p>
              <div className="text-[10px] text-gray-500 mt-3 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                Actualizado: {couple.sweetMessageTime ? new Date(couple.sweetMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy'}
              </div>
            </div>

            {/* Mood Bubble selector */}
            <div className="bg-white border border-[#E8DFFF] p-6 rounded-3xl shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Smile className="w-5 h-5 text-indigo-500" />
                <h3 className="font-display font-bold text-base text-[#2C2523]">¿Cómo te sientes en este momento?</h3>
              </div>
              <p className="text-xs text-[#6E6461] mb-4">
                Presiona un emoji para actualizar tu estado de ánimo. Se sincronizará en el celular de {couple.elName} al instante.
              </p>

              <div className="flex flex-wrap justify-center gap-3">
                {MOODS.map((m) => {
                  const isCurrent = couple.currentMood === m.emoji;
                  return (
                    <button
                      id={`mood-bubble-${m.label}`}
                      key={m.label}
                      onClick={() => handleMoodSelect(m.emoji, m.label)}
                      className={`flex items-center gap-1.5 py-2.5 px-4 rounded-full text-xs font-semibold transition cursor-pointer ${
                        isCurrent 
                          ? 'ring-2 ring-[#FFB399] scale-105 shadow-sm bg-[#FFF2EE] text-[#FF8155] font-extrabold'
                          : `${m.color} ${m.textColor}`
                      }`}
                    >
                      <span className="text-base">{m.emoji}</span>
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {couple.currentMood && (
                <div className="mt-4 pt-4 border-t border-gray-50 text-center text-xs text-[#6E6461]">
                  Estado actual: <span className="font-bold text-[#2C2523]">{couple.currentMood} {couple.currentMoodLabel}</span>
                </div>
              )}
            </div>

            {/* Consejos del ciclo */}
            <div className="bg-white border border-[#E8DFFF] p-6 rounded-3xl shadow-sm">
              <h3 className="font-display font-bold text-base text-[#2C2523] mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" /> Autocuidado en Fase {cycleStats.phase}
              </h3>
              <ul className="space-y-2 text-xs text-[#6E6461] list-disc list-inside">
                {cycleStats.phaseInfo.tips.map((tip, i) => (
                  <li key={i} className="leading-relaxed">{tip}</li>
                ))}
              </ul>
            </div>

          </div>
        )}


        {/* 2. CALENDAR TAB */}
        {activeTab === 'calendar' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-display font-extrabold text-[#2C2523]">Calendario Menstrual</h1>
              <button
                id="reset-period-btn"
                onClick={() => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  setTempLastPeriod(todayStr);
                  setShowSettingsModal(true);
                }}
                className="text-xs bg-[#FFF2EE] text-[#FF8155] hover:bg-[#FFE5DC] px-3 py-1.5 rounded-full font-bold transition flex items-center gap-1"
              >
                🌸 Registrar Periodo Hoy
              </button>
            </div>

            {/* Almanac Grid */}
            <div className="bg-white border border-[#E8DFFF] p-5 rounded-3xl shadow-sm">
              
              {/* Header Navigation */}
              <div className="flex items-center justify-between mb-6">
                <button
                  id="calendar-prev-month-btn"
                  onClick={() => handleMonthChange('prev')}
                  className="p-2 hover:bg-gray-100 rounded-xl transition text-[#6E6461]"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="font-display font-extrabold text-base text-[#2C2523] tracking-tight">
                  {MONTH_NAMES[currentCalendarDate.getMonth()]} {currentCalendarDate.getFullYear()}
                </h3>
                <button
                  id="calendar-next-month-btn"
                  onClick={() => handleMonthChange('next')}
                  className="p-2 hover:bg-gray-100 rounded-xl transition text-[#6E6461]"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Days of the Week Headers */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#9c8e8a] uppercase tracking-wider mb-2">
                <span>Lun</span>
                <span>Mar</span>
                <span>Mié</span>
                <span>Jue</span>
                <span>Vie</span>
                <span>Sáb</span>
                <span>Dom</span>
              </div>

              {/* Calendar Grid Numbers */}
              <div className="grid grid-cols-7 gap-1.5">
                {renderCalendarDays()}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-[10px] text-[#6E6461] font-semibold text-center">
                <div className="flex items-center justify-center gap-1.5 bg-[#FFF2EE] py-2 rounded-xl border border-[#FFB399]">
                  <span className="text-red-500">🌸</span> Menstruación
                </div>
                <div className="flex items-center justify-center gap-1.5 bg-[#FEF8F0] py-2 rounded-xl border border-[#F9CE99]">
                  <span className="text-yellow-600">✨</span> Fertilidad/Ovulación
                </div>
                <div className="flex items-center justify-center gap-1.5 bg-[#FDFBF7] py-2 rounded-xl border border-gray-200">
                  <span>📝</span> Síntomas Guardados
                </div>
              </div>
            </div>

            {/* Quick stats / history */}
            <div className="bg-white border border-[#E8DFFF] p-5 rounded-3xl shadow-sm">
              <h3 className="font-display font-bold text-sm text-[#2C2523] mb-3 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#FFB399]" /> Historial de Síntomas Recientes
              </h3>
              {symptoms.length === 0 ? (
                <p className="text-xs text-[#9c8e8a] italic text-center py-4">No has registrado síntomas recientemente. ¡Haz clic en cualquier día del calendario para registrar cómo te sientes!</p>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {symptoms
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 5)
                    .map((log) => (
                      <div key={log.id} className="bg-[#FDFBF7] p-3 rounded-2xl border border-gray-100 flex items-start justify-between text-xs">
                        <div className="space-y-1">
                          <div className="font-bold text-[#2C2523]">
                            {new Date(log.date + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                          {log.notes && <p className="text-[#6E6461] italic">"{log.notes}"</p>}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <span className="bg-[#FFF2EE] text-[#FF8155] font-bold px-2 py-0.5 rounded-full text-[10px]">
                              Cólicos: {CRAMPS_OPTIONS.find(c => c.value === log.cramps)?.label.split(' ')[0]}
                            </span>
                            <span className="bg-[#F6F3FF] text-[#9176EB] font-bold px-2 py-0.5 rounded-full text-[10px]">
                              Flujo: {FLOW_OPTIONS.find(f => f.value === log.flow)?.label.split(' ')[0]}
                            </span>
                            <span className="bg-[#F3F7F2] text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">
                              Energía: {ENERGY_OPTIONS.find(e => e.value === log.energy)?.label.split(' ')[0]}
                            </span>
                          </div>
                        </div>
                        <span className="text-lg bg-white shadow-xs w-8 h-8 rounded-full flex items-center justify-center border border-gray-100">
                          {log.mood}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}


        {/* 3. LOVE TAB: "RINCÓN DE AMOR" */}
        {activeTab === 'love' && (
          <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-display font-extrabold text-[#2C2523]">Rincón de Amor</h1>
            
            {/* Coupons section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-base text-[#2C2523] flex items-center gap-1.5">
                  <Gift className="w-5 h-5 text-[#FFB399]" /> Cuponera Digital
                </h3>
                <span className="text-xs font-semibold text-[#6E6461] bg-[#F3F7F2] px-2.5 py-1 rounded-full border border-[#D4E0D1]">
                  {coupons.filter(c => !c.isRedeemed).length} Activos
                </span>
              </div>
              <p className="text-xs text-[#6E6461] -mt-2">
                Canjea un vale de regalo cuando quieras que {couple.elName} lo cumpla. Él recibirá una alerta al instante en su pantalla.
              </p>

              <div className="grid grid-cols-1 gap-4">
                {coupons.length === 0 ? (
                  <p className="text-xs text-[#9c8e8a] italic text-center py-6">Tu cuponera está vacía. ¡Dile a {couple.elName} que te recargue cupones de amor!</p>
                ) : (
                  coupons.map((coupon) => (
                    <div
                      key={coupon.id}
                      className={`relative border p-5 rounded-3xl transition overflow-hidden ${
                        coupon.isRedeemed
                          ? 'bg-gray-50 border-gray-200 opacity-65'
                          : 'bg-white border-[#E8DFFF] shadow-xs hover:border-[#FFB399]'
                      }`}
                    >
                      {/* Ticket cut-outs on sides to make it look like a real coupon ticket */}
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#FDFBF7] rounded-full border-r border-gray-200"></div>
                      <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-[#FDFBF7] rounded-full border-l border-gray-200"></div>

                      <div className="flex items-start justify-between pl-4 pr-4">
                        <div className="space-y-1">
                          <h4 className={`font-display font-bold text-base ${coupon.isRedeemed ? 'text-gray-400 line-through' : 'text-[#2C2523]'}`}>
                            {coupon.title}
                          </h4>
                          <p className="text-xs text-[#6E6461] leading-relaxed pr-6">{coupon.description}</p>
                          
                          {coupon.isRedeemed && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded-full mt-2">
                              <CheckCircle2 className="w-3 h-3 text-gray-400" /> Usado el {coupon.redeemedAt ? new Date(coupon.redeemedAt).toLocaleDateString() : 'hoy'}
                            </span>
                          )}
                        </div>

                        {!coupon.isRedeemed && (
                          <button
                            id={`redeem-coupon-btn-${coupon.id}`}
                            onClick={() => handleRedeemCoupon(coupon)}
                            className="bg-[#FFB399] hover:bg-[#ff9e7f] text-white font-bold text-xs px-4 py-2.5 rounded-2xl transition shadow-xs cursor-pointer"
                          >
                            Canjear
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Sweet Message History */}
            <div className="bg-white border border-[#E8DFFF] p-5 rounded-3xl shadow-sm">
              <h3 className="font-display font-bold text-sm text-[#2C2523] mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-indigo-500" /> Historial de Mensajes Bonitos
              </h3>
              {messagesHistory.length === 0 ? (
                <p className="text-xs text-[#9c8e8a] italic text-center py-4">Aún no hay mensajes anteriores registrados.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {messagesHistory.map((msg) => (
                    <div key={msg.id} className="bg-[#F6F3FF] p-3 rounded-2xl border border-[#E8DFFF] text-xs">
                      <p className="text-[#2C2523] italic">"{msg.text}"</p>
                      <span className="text-[9px] text-gray-500 block text-right mt-1.5">
                        {new Date(msg.timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}, {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {activeTab === 'photos' && (
          <div className="animate-fade-in">
            <InstantPhotos user={user} coupleId={coupleId} accentColor="#FFB399" />
          </div>
        )}

      </main>

      {/* Floating S.O.S Button - "Necesito un abrazo" */}
      <div className="fixed bottom-24 right-6 z-40">
        <button
          id="sos-heart-btn"
          onClick={handleSOS}
          disabled={sosSending}
          className="w-16 h-16 bg-rose-500 hover:bg-rose-600 rounded-full flex flex-col items-center justify-center shadow-lg hover:scale-105 transition cursor-pointer text-white border-2 border-white relative group"
        >
          <Heart className="w-7 h-7 fill-current text-white animate-pulse" />
          <span className="text-[8px] font-extrabold uppercase mt-0.5 tracking-tighter">Abrazo</span>

          {/* Quick status tooltip */}
          <span className="absolute right-20 bg-[#2C2523] text-white text-[10px] py-1.5 px-3 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
            Necesito un abrazo SOS ❤️
          </span>
        </button>
      </div>

      {/* SOS Success Banner */}
      {sosMessageSent && (
        <div id="sos-success-alert" className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#2C2523] text-white text-xs font-semibold px-6 py-3 rounded-full shadow-lg flex items-center gap-2 animate-bounce">
          <span>❤️ Alerta enviada a {couple.elName} con alta prioridad.</span>
        </div>
      )}

      {/* 4. SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-[#2C2523]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8DFFF] p-6 rounded-3xl shadow-xl w-full max-w-md animate-fade-in">
            <h3 className="font-display font-extrabold text-xl text-[#2C2523] mb-4 flex items-center gap-2">
              🌸 Ajustes de tu Ciclo Menstrual
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#6E6461] uppercase tracking-wider mb-1">
                  Primer día de tu último periodo
                </label>
                <input
                  id="settings-last-period-input"
                  type="date"
                  value={tempLastPeriod}
                  onChange={(e) => setTempLastPeriod(e.target.value)}
                  className="w-full px-4 py-3 border border-[#E8DFFF] rounded-2xl focus:border-[#FFB399] focus:outline-none text-sm text-[#2C2523] bg-[#FDFBF7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#6E6461] uppercase tracking-wider mb-1">
                    Duración del Ciclo (días)
                  </label>
                  <input
                    id="settings-cycle-len-input"
                    type="number"
                    min={21}
                    max={45}
                    value={tempCycleLength}
                    onChange={(e) => setTempCycleLength(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-[#E8DFFF] rounded-2xl focus:border-[#FFB399] focus:outline-none text-sm text-[#2C2523] bg-[#FDFBF7]"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">Promedio: 28-30 días</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#6E6461] uppercase tracking-wider mb-1">
                    Duración de Regla (días)
                  </label>
                  <input
                    id="settings-period-len-input"
                    type="number"
                    min={2}
                    max={10}
                    value={tempPeriodLength}
                    onChange={(e) => setTempPeriodLength(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-[#E8DFFF] rounded-2xl focus:border-[#FFB399] focus:outline-none text-sm text-[#2C2523] bg-[#FDFBF7]"
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">Promedio: 3-7 días</span>
                </div>
              </div>

              <div className="bg-[#FFF2EE] border border-[#FFD5C6] p-4 rounded-2xl flex items-start gap-2 text-xs text-[#FF8155]">
                <Info className="w-5 h-5 flex-shrink-0" />
                <p className="leading-relaxed font-medium">
                  Modificar estos valores recalculará instantáneamente la fase de tu ciclo, los días restantes y actualizará el manual de consejos de {couple.elName}.
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                id="close-settings-modal-btn"
                onClick={() => setShowSettingsModal(false)}
                className="flex-1 py-3 text-sm font-semibold border border-[#E8DFFF] text-[#6E6461] rounded-2xl hover:bg-gray-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="save-settings-modal-btn"
                onClick={handleSaveSettings}
                className="flex-1 py-3 text-sm font-bold bg-[#FFB399] hover:bg-[#ff9e7f] text-white rounded-2xl transition shadow-xs cursor-pointer"
              >
                Guardar Ajustes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. INDIVIDUAL DAY SYMPTOM LOG DIALOG */}
      {selectedDateStr && selectedDayLog && (
        <div className="fixed inset-0 z-50 bg-[#2C2523]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8DFFF] p-6 rounded-3xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-fade-in space-y-4">
            <h3 className="font-display font-extrabold text-lg text-[#2C2523] flex items-center justify-between">
              <span>📝 Registro de Síntomas</span>
              <span className="text-xs bg-[#F3F7F2] text-emerald-800 font-bold px-3 py-1 rounded-full border border-[#D4E0D1]">
                {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
              </span>
            </h3>

            {/* Custom Emoji Selector for this day */}
            <div>
              <label className="block text-xs font-bold text-[#6E6461] uppercase tracking-wider mb-2">Estado de Ánimo del día</label>
              <div className="grid grid-cols-4 gap-2">
                {MOODS.map((m) => {
                  const isCurrent = selectedDayLog.mood === m.emoji;
                  return (
                    <button
                      id={`day-log-mood-${m.label}`}
                      key={m.label}
                      type="button"
                      onClick={() => setSelectedDayLog({
                        ...selectedDayLog,
                        mood: m.emoji,
                        moodLabel: m.label
                      })}
                      className={`py-2 border rounded-xl text-xs flex flex-col items-center gap-0.5 transition cursor-pointer ${
                        isCurrent 
                          ? 'border-[#FFB399] bg-[#FFF2EE] text-[#FF8155] font-extrabold'
                          : 'border-gray-200 text-[#6E6461] hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-lg">{m.emoji}</span>
                      <span className="text-[9px] truncate w-full text-center px-1">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cramps select */}
            <div>
              <label className="block text-xs font-bold text-[#6E6461] uppercase tracking-wider mb-1.5">Nivel de Cólicos</label>
              <div className="grid grid-cols-4 gap-2">
                {CRAMPS_OPTIONS.map((opt) => {
                  const isCurrent = selectedDayLog.cramps === opt.value;
                  return (
                    <button
                      id={`day-log-cramps-${opt.value}`}
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedDayLog({
                        ...selectedDayLog,
                        cramps: opt.value as any
                      })}
                      className={`py-2 text-xs border rounded-xl transition font-medium cursor-pointer ${
                        isCurrent
                          ? 'border-[#FFB399] bg-[#FFF2EE] text-[#FF8155] font-bold'
                          : 'border-gray-200 text-[#6E6461] hover:bg-gray-50'
                      }`}
                    >
                      {opt.label.replace(' ▫️','').replace(' ▪️','').replace(' 🔥','')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Flow select */}
            <div>
              <label className="block text-xs font-bold text-[#6E6461] uppercase tracking-wider mb-1.5">Cantidad de Flujo</label>
              <div className="grid grid-cols-4 gap-2">
                {FLOW_OPTIONS.map((opt) => {
                  const isCurrent = selectedDayLog.flow === opt.value;
                  return (
                    <button
                      id={`day-log-flow-${opt.value}`}
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedDayLog({
                        ...selectedDayLog,
                        flow: opt.value as any
                      })}
                      className={`py-2 text-xs border rounded-xl transition font-medium cursor-pointer ${
                        isCurrent
                          ? 'border-[#FFB399] bg-[#FFF2EE] text-[#FF8155] font-bold'
                          : 'border-gray-200 text-[#6E6461] hover:bg-gray-50'
                      }`}
                    >
                      {opt.label.replace(' 💧','').replace(' 💧💧','').replace(' 💧💧💧','')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Energy select */}
            <div>
              <label className="block text-xs font-bold text-[#6E6461] uppercase tracking-wider mb-1.5">Nivel de Energía</label>
              <div className="grid grid-cols-3 gap-2">
                {ENERGY_OPTIONS.map((opt) => {
                  const isCurrent = selectedDayLog.energy === opt.value;
                  return (
                    <button
                      id={`day-log-energy-${opt.value}`}
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedDayLog({
                        ...selectedDayLog,
                        energy: opt.value as any
                      })}
                      className={`py-2 text-xs border rounded-xl transition font-medium cursor-pointer ${
                        isCurrent
                          ? 'border-[#FFB399] bg-[#FFF2EE] text-[#FF8155] font-bold'
                          : 'border-gray-200 text-[#6E6461] hover:bg-gray-50'
                      }`}
                    >
                      {opt.label.replace(' 🔋','').replace(' 🔋🔋','').replace(' 🔋🔋🔋','')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes text block */}
            <div>
              <label className="block text-xs font-bold text-[#6E6461] uppercase tracking-wider mb-1">Notas / Síntomas adicionales</label>
              <textarea
                id="day-log-notes-input"
                rows={3}
                placeholder="Dolor de cabeza, antojos de chocolate, humor sensible, etc..."
                value={selectedDayLog.notes || ''}
                onChange={(e) => setSelectedDayLog({ ...selectedDayLog, notes: e.target.value })}
                className="w-full px-4 py-3 border border-[#E8DFFF] rounded-2xl focus:border-[#FFB399] focus:outline-none text-sm text-[#2C2523] bg-[#FDFBF7]"
              />
            </div>

            <div className="pt-2 flex gap-3">
              <button
                id="close-day-log-modal-btn"
                onClick={() => { setSelectedDateStr(null); setSelectedDayLog(null); }}
                className="flex-1 py-3 text-sm font-semibold border border-[#E8DFFF] text-[#6E6461] rounded-2xl hover:bg-gray-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="save-day-log-modal-btn"
                onClick={handleSaveDayLog}
                disabled={isSavingSymptom}
                className="flex-1 py-3 text-sm font-bold bg-[#FFB399] hover:bg-[#ff9e7f] text-white rounded-2xl transition shadow-xs cursor-pointer flex justify-center items-center"
              >
                {isSavingSymptom ? 'Guardando...' : 'Guardar Log'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sticky Navigation */}
      <nav id="bottom-navigation" className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E8DFFF] py-3 px-6 flex items-center justify-around z-30 shadow-md">
        <button
          id="nav-home-btn"
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'home' ? 'text-[#FF8155] font-extrabold scale-105' : 'text-[#9c8e8a] hover:text-[#2C2523]'}`}
        >
          <Heart className={`w-6 h-6 ${activeTab === 'home' ? 'fill-current' : ''}`} />
          <span className="text-[10px]">Inicio</span>
        </button>
        <button
          id="nav-calendar-btn"
          onClick={() => setActiveTab('calendar')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'calendar' ? 'text-[#FF8155] font-extrabold scale-105' : 'text-[#9c8e8a] hover:text-[#2C2523]'}`}
        >
          <CalendarIcon className="w-6 h-6" />
          <span className="text-[10px]">Calendario</span>
        </button>
        <button
          id="nav-love-btn"
          onClick={() => setActiveTab('love')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'love' ? 'text-[#FF8155] font-extrabold scale-105' : 'text-[#9c8e8a] hover:text-[#2C2523]'}`}
        >
          <Gift className="w-6 h-6" />
          <span className="text-[10px]">Rincón Amor</span>
        </button>
        <button
          id="nav-photos-btn"
          onClick={() => setActiveTab('photos')}
          className={`flex flex-col items-center gap-1 transition ${activeTab === 'photos' ? 'text-[#FF8155] font-extrabold scale-105' : 'text-[#9c8e8a] hover:text-[#2C2523]'}`}
        >
          <Camera className="w-6 h-6" />
          <span className="text-[10px]">Fotos 24h</span>
        </button>
      </nav>
    </div>
  );
}
