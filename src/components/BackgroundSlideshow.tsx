import React from 'react';
import { motion } from 'motion/react';
import { Heart } from 'lucide-react';

export default function BackgroundSlideshow() {
  // Generate beautiful soft floating decorative hearts
  const floatingHearts = [
    { id: 1, left: '10%', top: '20%', size: 24, duration: 12, delay: 0 },
    { id: 2, left: '85%', top: '15%', size: 32, duration: 15, delay: 1 },
    { id: 3, left: '75%', top: '75%', size: 20, duration: 10, delay: 3 },
    { id: 4, left: '15%', top: '80%', size: 28, duration: 14, delay: 2 },
    { id: 5, left: '50%', top: '85%', size: 16, duration: 8, delay: 4 },
  ];

  return (
    <div className="fixed inset-0 -z-10 w-full h-full overflow-hidden bg-gradient-to-tr from-[#FFE5EC] via-[#FFF0F2] to-[#FFF9F2]">
      {/* Dynamic floating hearts */}
      {floatingHearts.map((heart) => (
        <motion.div
          key={heart.id}
          className="absolute text-[#FF8A9B]/20 pointer-events-none select-none"
          style={{
            left: heart.left,
            top: heart.top,
          }}
          animate={{
            y: [0, -40, 0],
            scale: [1, 1.15, 1],
            rotate: [0, 10, -10, 0],
          }}
          transition={{
            duration: heart.duration,
            repeat: Infinity,
            delay: heart.delay,
            ease: 'easeInOut',
          }}
        >
          <Heart size={heart.size} fill="currentColor" />
        </motion.div>
      ))}

      {/* Elegant repeating background details for texture */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffccd5_1px,transparent_1px)] [background-size:32px_32px] opacity-20 pointer-events-none" />

      {/* Highlighted Romantic Message Container - Perfectly integrated with the theme */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 select-none">
        <div className="max-w-xl text-center space-y-4 bg-white/40 backdrop-blur-xs p-8 rounded-3xl border border-[#FFF0F2] shadow-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="flex flex-col items-center gap-3"
          >
            <div className="w-12 h-12 rounded-full bg-[#FFE5EC] flex items-center justify-center animate-bounce">
              <Heart className="w-6 h-6 text-[#FF8A9B] fill-[#FF8A9B]" />
            </div>
            
            <h1 className="font-display text-3xl md:text-4xl font-extrabold text-[#7D323E] leading-tight tracking-tight">
              Te amo por siempre Antonia,
            </h1>
            
            <p className="font-sans text-sm md:text-base font-bold text-[#A3525F]">
              espero que te guste la app &lt;3
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
