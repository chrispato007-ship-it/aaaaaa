export interface MoodOption {
  emoji: string;
  label: string;
  color: string;
  textColor: string;
}

export const MOODS: MoodOption[] = [
  { emoji: '😊', label: 'Feliz', color: 'bg-amber-100 hover:bg-amber-200', textColor: 'text-amber-800' },
  { emoji: '😴', label: 'Cansada', color: 'bg-blue-100 hover:bg-blue-200', textColor: 'text-blue-800' },
  { emoji: '🥺', label: 'Sensible', color: 'bg-indigo-100 hover:bg-indigo-200', textColor: 'text-indigo-800' },
  { emoji: '😟', label: 'Ansiosa', color: 'bg-purple-100 hover:bg-purple-200', textColor: 'text-purple-800' },
  { emoji: '⚡', label: 'Con Energía', color: 'bg-emerald-100 hover:bg-emerald-200', textColor: 'text-emerald-800' },
  { emoji: '🤕', label: 'Con Cólicos', color: 'bg-rose-100 hover:bg-rose-200', textColor: 'text-rose-800' },
  { emoji: '🧘‍♀️', label: 'Relajada', color: 'bg-teal-100 hover:bg-teal-200', textColor: 'text-teal-800' }
];

export const CRAMPS_OPTIONS = [
  { value: 'none', label: 'Ninguno' },
  { value: 'mild', label: 'Leve ▫️' },
  { value: 'moderate', label: 'Moderado ▪️' },
  { value: 'severe', label: 'Fuerte 🔥' }
];

export const FLOW_OPTIONS = [
  { value: 'none', label: 'Ninguno' },
  { value: 'light', label: 'Ligero 💧' },
  { value: 'medium', label: 'Medio 💧💧' },
  { value: 'heavy', label: 'Abundante 💧💧💧' }
];

export const ENERGY_OPTIONS = [
  { value: 'low', label: 'Baja 🔋' },
  { value: 'medium', label: 'Media 🔋🔋' },
  { value: 'high', label: 'Alta 🔋🔋🔋' }
];

export interface DefaultCouponPreset {
  title: string;
  description: string;
}

export const COUPON_PRESETS: DefaultCouponPreset[] = [
  { title: 'Vale por un masaje', description: 'Masaje de espalda de 30 minutos sin quejas ni interrupciones.' },
  { title: 'Vale por cena romántica', description: 'Él prepara o pide tu comida favorita y se encarga de limpiar todo.' },
  { title: 'Vale por una peli y mimos', description: 'Tarde entera abrazados viendo las películas que tú quieras.' },
  { title: 'Vale por un capricho dulce', description: 'Un chocolate, helado o tarta entregado directamente en tus manos.' },
  { title: 'Vale por un día de flojera', description: 'Un día libre de tareas del hogar, él se encarga de absolutamente todo.' }
];
