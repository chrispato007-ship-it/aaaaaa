import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { Heart, Key, User, Plus, Check, LogIn, HeartHandshake } from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { COUPON_PRESETS } from '../constants';

interface AuthProps {
  onAuthSuccess: (user: UserProfile) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<UserRole>('ella');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Local active user (for pairing state)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [partnerCode, setPartnerCode] = useState('');
  const [myCode, setMyCode] = useState('');

  // Check if session exists in localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('sincro_amor_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser) as UserProfile;
      // Fetch latest profile state from firestore to check if coupled
      getLatestProfile(parsed.id);
    }
  }, []);

  const getLatestProfile = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data();
        const profile: UserProfile = {
          id: userId,
          username: data.username,
          displayName: data.displayName,
          role: data.role,
          coupleId: data.coupleId,
          createdAt: data.createdAt
        };
        localStorage.setItem('sincro_amor_user', JSON.stringify(profile));
        
        if (profile.coupleId) {
          onAuthSuccess(profile);
        } else {
          setCurrentUser(profile);
          setMyCode(data.pairingCode || '');
        }
      }
    } catch (e) {
      console.error("Error fetching user profile:", e);
    }
  };

  const generateCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password || !displayName) {
      setError('Por favor, completa todos los campos.');
      return;
    }

    setLoading(true);
    const cleanUsername = username.trim().toLowerCase();

    try {
      // Check if username already exists
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', cleanUsername));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        setError('El nombre de usuario ya está registrado.');
        setLoading(false);
        return;
      }

      // Generate credentials
      const userId = 'user_' + Math.random().toString(36).substring(2, 15);
      const pairingCode = generateCode();
      const profileData = {
        username: cleanUsername,
        password: password, // For simplicity of this private couple app, standard password string
        displayName: displayName.trim(),
        role: role,
        pairingCode: pairingCode,
        coupleId: '',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', userId), profileData);

      const userProfile: UserProfile = {
        id: userId,
        username: cleanUsername,
        displayName: displayName.trim(),
        role: role,
        coupleId: '',
        createdAt: profileData.createdAt
      };

      localStorage.setItem('sincro_amor_user', JSON.stringify(userProfile));
      setCurrentUser(userProfile);
      setMyCode(pairingCode);
    } catch (e: any) {
      console.error(e);
      setError('Error en el registro: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Por favor, ingresa tu usuario y contraseña.');
      return;
    }

    setLoading(true);
    const cleanUsername = username.trim().toLowerCase();

    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef, 
        where('username', '==', cleanUsername), 
        where('password', '==', password)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('Usuario o contraseña incorrectos.');
        setLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const data = userDoc.data();
      
      const userProfile: UserProfile = {
        id: userDoc.id,
        username: data.username,
        displayName: data.displayName,
        role: data.role,
        coupleId: data.coupleId || '',
        createdAt: data.createdAt
      };

      localStorage.setItem('sincro_amor_user', JSON.stringify(userProfile));

      if (userProfile.coupleId) {
        onAuthSuccess(userProfile);
      } else {
        setCurrentUser(userProfile);
        setMyCode(data.pairingCode || '');
      }
    } catch (e: any) {
      console.error(e);
      setError('Error al iniciar sesión: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePairing = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentUser) return;
    const codeToLink = partnerCode.trim().toUpperCase();

    if (!codeToLink) {
      setError('Por favor, introduce el código de tu pareja.');
      return;
    }

    if (codeToLink === myCode) {
      setError('No puedes vincularte contigo mismo.');
      return;
    }

    setLoading(true);

    try {
      // Find user with this pairing code
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('pairingCode', '==', codeToLink));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('No se encontró ninguna pareja con ese código.');
        setLoading(false);
        return;
      }

      const partnerDoc = querySnapshot.docs[0];
      const partnerData = partnerDoc.data();
      const partnerId = partnerDoc.id;

      if (partnerData.role === currentUser.role) {
        setError(`Tu pareja debe tener el rol opuesto. Ambos están configurados como "${currentUser.role === 'ella' ? 'Ella' : 'Él'}". Puedes registrarte de nuevo con el rol correcto.`);
        setLoading(false);
        return;
      }

      if (partnerData.coupleId) {
        setError('Esa pareja ya está vinculada a otra cuenta.');
        setLoading(false);
        return;
      }

      // Create Couple Document
      const coupleId = 'couple_' + Math.random().toString(36).substring(2, 15);
      const isCurrentElla = currentUser.role === 'ella';
      
      const ellaId = isCurrentElla ? currentUser.id : partnerId;
      const elId = isCurrentElla ? partnerId : currentUser.id;
      const ellaName = isCurrentElla ? currentUser.displayName : partnerData.displayName;
      const elName = isCurrentElla ? partnerData.displayName : currentUser.displayName;

      const todayStr = new Date().toISOString().split('T')[0];

      const coupleData = {
        id: coupleId,
        code: `${myCode}-${codeToLink}`,
        ellaId,
        elId,
        ellaName,
        elName,
        cycleLength: 28,
        periodLength: 5,
        lastPeriodDate: todayStr,
        currentMood: '😊',
        currentMoodLabel: 'Feliz',
        currentMoodDate: todayStr,
        sweetMessage: '¡Hola mi amor! Bienvenidos a nuestro rincón especial. 🥰',
        sweetMessageTime: new Date().toISOString()
      };

      // Create couple document in firestore
      await setDoc(doc(db, 'couples', coupleId), coupleData);

      // Update both users
      await updateDoc(doc(db, 'users', currentUser.id), { coupleId: coupleId });
      await updateDoc(doc(db, 'users', partnerId), { coupleId: coupleId });

      // Create couple default Coupons
      for (const preset of COUPON_PRESETS) {
        const couponId = 'coupon_' + Math.random().toString(36).substring(2, 15);
        await setDoc(doc(db, 'coupons', couponId), {
          id: couponId,
          coupleId: coupleId,
          title: preset.title,
          description: preset.description,
          isRedeemed: false,
          createdAt: new Date().toISOString()
        });
      }

      // Add default welcome Alert
      const alertId = 'alert_' + Math.random().toString(36).substring(2, 15);
      await setDoc(doc(db, 'alerts', alertId), {
        id: alertId,
        coupleId: coupleId,
        senderId: 'system',
        recipientId: 'both',
        type: 'cycle_update',
        title: '❤️ ¡Vinculados!',
        message: `¡${ellaName} y ${elName} han unido sus corazones! El amor está sincronizado en tiempo real.`,
        isRead: false,
        timestamp: new Date().toISOString()
      });

      // Update local state and finish auth
      const updatedUser: UserProfile = {
        ...currentUser,
        coupleId: coupleId
      };
      
      localStorage.setItem('sincro_amor_user', JSON.stringify(updatedUser));
      onAuthSuccess(updatedUser);
    } catch (e: any) {
      console.error(e);
      setError('Error al vincular parejas: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutLocal = () => {
    localStorage.removeItem('sincro_amor_user');
    setCurrentUser(null);
    setMyCode('');
    setUsername('');
    setPassword('');
    setDisplayName('');
    setIsLogin(true);
    setError('');
  };

  // Render Pairing screen if logged in but not coupled
  if (currentUser) {
    return (
      <div id="auth-container" className="min-h-screen flex items-center justify-center px-4 bg-transparent font-sans">
        <div id="pairing-card" className="w-full max-w-md bg-white border border-[#E8DFFF] p-8 rounded-3xl shadow-sm text-center">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-[#FFF2EE] rounded-full animate-bounce">
              <HeartHandshake className="w-12 h-12 text-[#FFB399]" />
            </div>
          </div>
          
          <h2 className="text-3xl font-display font-bold text-[#2C2523] mb-2">¡Hola, {currentUser.displayName}!</h2>
          <p className="text-[#6E6461] mb-6">
            Estás registrado como <span className="font-semibold text-[#FFB399] capitalize">{currentUser.role === 'ella' ? 'Ella' : 'Él'}</span>.
            Para comenzar, necesitas sincronizarte con tu pareja.
          </p>

          <div className="bg-[#FDFBF7] border border-[#E8DFFF] p-5 rounded-2xl mb-6 text-center">
            <span className="text-xs uppercase tracking-wider text-[#6E6461] block mb-1">Tu Código Único</span>
            <div className="text-2xl font-mono font-bold tracking-widest text-[#2C2523] select-all">
              {myCode}
            </div>
            <p className="text-xs text-[#9c8e8a] mt-2">
              Pídele a tu pareja que introduzca este código en su pantalla.
            </p>
          </div>

          <div className="relative flex py-2 items-center mb-6">
            <div className="flex-grow border-t border-[#E8DFFF]"></div>
            <span className="flex-shrink mx-4 text-xs text-[#9c8e8a] uppercase tracking-wider">o introduce el de ella/él</span>
            <div className="flex-grow border-t border-[#E8DFFF]"></div>
          </div>

          <form onSubmit={handlePairing} className="space-y-4">
            <div>
              <input
                id="partner-code-input"
                type="text"
                placeholder="Código de tu pareja (ej: X8Y3ZA)"
                value={partnerCode}
                onChange={(e) => setPartnerCode(e.target.value)}
                maxLength={6}
                className="w-full px-4 py-3 text-center border-2 border-[#E8DFFF] rounded-2xl focus:border-[#FFB399] focus:outline-none uppercase font-mono font-bold tracking-wider"
              />
            </div>

            {error && (
              <p id="pairing-error" className="text-sm text-rose-500 font-medium">
                ⚠️ {error}
              </p>
            )}

            <button
              id="pair-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#FFB399] hover:bg-[#ff9e7f] text-white font-medium rounded-2xl transition duration-200 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Heart className="w-5 h-5 fill-current text-white" />
                  Vincular Corazones
                </>
              )}
            </button>
          </form>

          <button
            id="pairing-logout-btn"
            onClick={handleLogoutLocal}
            className="mt-6 text-sm text-[#9c8e8a] hover:text-[#2C2523] underline"
          >
            Cerrar Sesión / Registrar otro rol
          </button>
        </div>
      </div>
    );
  }

  // Render Login/Register Form
  return (
    <div id="auth-container" className="min-h-screen flex items-center justify-center px-4 bg-transparent">
      <div id="auth-card" className="w-full max-w-md bg-white border border-[#E8DFFF] p-8 rounded-3xl shadow-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-[#FFF2EE] rounded-3xl mb-3">
            <Heart className="w-10 h-10 text-[#FFB399] fill-current animate-pulse" />
          </div>
          <h1 className="text-3xl font-display font-extrabold text-[#2C2523] tracking-tight">Phadiscon LOVE</h1>
          <p className="text-sm text-[#6E6461] mt-1">El rincón privado para conectar tu ciclo y amor</p>
        </div>

        <div className="flex bg-[#FDFBF7] p-1.5 rounded-2xl border border-[#E8DFFF] mb-6">
          <button
            id="toggle-login-btn"
            onClick={() => { setIsLogin(true); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition duration-200 ${
              isLogin 
                ? 'bg-[#FFB399] text-white shadow-sm' 
                : 'text-[#6E6461] hover:text-[#2C2523]'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            id="toggle-register-btn"
            onClick={() => { setIsLogin(false); setError(''); }}
            className={`flex-1 py-2.5 text-sm font-medium rounded-xl transition duration-200 ${
              !isLogin 
                ? 'bg-[#FFB399] text-white shadow-sm' 
                : 'text-[#6E6461] hover:text-[#2C2523]'
            }`}
          >
            Registrarse
          </button>
        </div>

        <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-[#6E6461] uppercase tracking-wider mb-1">Nombre para mostrar</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#9c8e8a]">
                  <User className="w-5 h-5" />
                </span>
                <input
                  id="display-name-input"
                  type="text"
                  placeholder="Tu apodo tierno (ej: Clari, Jose)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-[#E8DFFF] rounded-2xl focus:border-[#FFB399] focus:outline-none text-sm text-[#2C2523] placeholder-[#9c8e8a] bg-[#FDFBF7]"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#6E6461] uppercase tracking-wider mb-1">Usuario único</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#9c8e8a]">
                <User className="w-5 h-5" />
              </span>
              <input
                id="username-input"
                type="text"
                placeholder="Nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-[#E8DFFF] rounded-2xl focus:border-[#FFB399] focus:outline-none text-sm text-[#2C2523] placeholder-[#9c8e8a] bg-[#FDFBF7]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#6E6461] uppercase tracking-wider mb-1">Contraseña</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#9c8e8a]">
                <Key className="w-5 h-5" />
              </span>
              <input
                id="password-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-[#E8DFFF] rounded-2xl focus:border-[#FFB399] focus:outline-none text-sm text-[#2C2523] placeholder-[#9c8e8a] bg-[#FDFBF7]"
              />
            </div>
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-[#6E6461] uppercase tracking-wider mb-2">Tu Rol en la Pareja</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  id="role-ella-btn"
                  type="button"
                  onClick={() => setRole('ella')}
                  className={`py-3 px-4 border rounded-2xl text-sm font-medium transition duration-200 flex flex-col items-center gap-1 ${
                    role === 'ella'
                      ? 'border-[#FFB399] bg-[#FFF2EE] text-[#FFB399] font-bold'
                      : 'border-[#E8DFFF] text-[#6E6461] hover:border-[#FFB399]'
                  }`}
                >
                  <span className="text-xl">🌸</span>
                  <span>Ella</span>
                  <span className="text-[10px] font-normal text-gray-500">(Ciclo & Humor)</span>
                </button>
                <button
                  id="role-el-btn"
                  type="button"
                  onClick={() => setRole('el')}
                  className={`py-3 px-4 border rounded-2xl text-sm font-medium transition duration-200 flex flex-col items-center gap-1 ${
                    role === 'el'
                      ? 'border-[#E8DFFF] bg-[#F6F3FF] text-[#9176EB] font-bold'
                      : 'border-[#E8DFFF] text-[#6E6461] hover:border-[#E8DFFF]'
                  }`}
                >
                  <span className="text-xl">🤵</span>
                  <span>Él</span>
                  <span className="text-[10px] font-normal text-gray-500">(Soporte & Mimos)</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <p id="auth-error-msg" className="text-xs text-rose-500 font-medium text-center">
              ⚠️ {error}
            </p>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[#FFB399] hover:bg-[#ff9e7f] text-white font-medium rounded-2xl transition duration-200 shadow-sm flex items-center justify-center gap-2 text-sm disabled:opacity-50 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : isLogin ? (
              <>
                <LogIn className="w-4 h-4" /> Enlazar Amor
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" /> Crear Cuenta
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
