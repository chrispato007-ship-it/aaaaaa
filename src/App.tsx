import React, { useState, useEffect } from 'react';
import { UserProfile } from './types';
import Auth from './components/Auth';
import EllaDashboard from './components/EllaDashboard';
import ElDashboard from './components/ElDashboard';
import Notifications from './components/Notifications';
import BackgroundSlideshow from './components/BackgroundSlideshow';
import { Heart } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Read session on startup
    const savedUser = localStorage.getItem('sincro_amor_user');
    if (savedUser) {
      const parsed = JSON.parse(savedUser) as UserProfile;
      setCurrentUser(parsed);
    }
    setLoading(false);
  }, []);

  const handleAuthSuccess = (profile: UserProfile) => {
    setCurrentUser(profile);
  };

  const handleLogout = () => {
    localStorage.removeItem('sincro_amor_user');
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div id="app-loading" className="min-h-screen flex items-center justify-center bg-[#FDFBF7]">
        <div className="text-center space-y-3">
          <Heart className="w-12 h-12 text-[#FFB399] fill-current animate-bounce mx-auto" />
          <p className="text-sm text-[#6E6461] font-medium font-sans">Sincronizando vuestro amor...</p>
        </div>
      </div>
    );
  }

  // If not logged in, or logged in but not linked to a partner, render Auth (which handles pairing)
  if (!currentUser || !currentUser.coupleId) {
    return (
      <>
        <BackgroundSlideshow />
        <Auth onAuthSuccess={handleAuthSuccess} />
      </>
    );
  }

  // User is fully authenticated and paired! Route to their corresponding role interface
  return (
    <div id="app-main-wrapper" className="min-h-screen bg-transparent relative z-10">
      <BackgroundSlideshow />
      {/* Real-time floating toasts / sound notification engine */}
      <Notifications coupleId={currentUser.coupleId} userId={currentUser.id} />

      {currentUser.role === 'ella' ? (
        <EllaDashboard 
          user={currentUser} 
          coupleId={currentUser.coupleId} 
          onLogout={handleLogout} 
        />
      ) : (
        <ElDashboard 
          user={currentUser} 
          coupleId={currentUser.coupleId} 
          onLogout={handleLogout} 
        />
      )}
    </div>
  );
}
