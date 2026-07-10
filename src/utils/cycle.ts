import { CyclePhase, PhaseInfo } from '../types';

export const PHASES_CONFIG: Record<CyclePhase, PhaseInfo> = {
  'Menstruación': {
    phase: 'Menstruación',
    color: '#FFB399', // Peach
    bgLight: '#FFF2EE',
    borderAccent: '#FF9575',
    description: 'Tu cuerpo se está depurando y renovando. Es tiempo de descansar, reconectar y bajar el ritmo.',
    tips: [
      'Mantente abrigada, especialmente la zona lumbar y el vientre.',
      'Toma infusiones calientes (manzanilla, jengibre o canela) para aliviar los cólicos.',
      'Realiza estiramientos suaves o yoga restaurativo en lugar de ejercicios intensos.',
      'Prioriza el sueño de calidad y no te exijas de más hoy.'
    ],
    // Consejos de supervivencia para él
    tipsForHim: [
      'Hoy es un gran día para prepararle un té caliente o colocarle una mantita.',
      'Evita proponer planes estresantes o que requieran mucho esfuerzo físico.',
      'Ofrécele un masaje suave en la espalda baja o en los pies.',
      'Muestra empatía adicional; los cólicos pueden ser agotadores y dolorosos.'
    ]
  } as any,
  'Folicular': {
    phase: 'Folicular',
    color: '#D4E0D1', // Sage Green
    bgLight: '#F3F7F2',
    borderAccent: '#B9CCB5',
    description: 'Tus niveles de estrógeno están subiendo. Sientes más energía, optimismo y claridad mental.',
    tips: [
      'Es un gran momento para iniciar nuevos proyectos o aprender algo nuevo.',
      'Aprovecha el aumento de energía física para realizar entrenamientos activos.',
      'Disfruta de tu facilidad para socializar y organizar planes.',
      'Aliméntate con comidas frescas y ricas en nutrientes.'
    ],
    tipsForHim: [
      'Su energía va en aumento; es el momento ideal para proponer una salida divertida.',
      'Sorpréndela planeando una cita al aire libre o una actividad nueva juntos.',
      'Su mente está muy activa, comparte conversaciones interesantes y escúchala.',
      'Acompaña su entusiasmo y apoya sus ideas o nuevos proyectos.'
    ]
  } as any,
  'Ovulatoria': {
    phase: 'Ovulatoria',
    color: '#FDE4C3', // Warm yellow/cream soft
    bgLight: '#FEF8F0',
    borderAccent: '#F9CE99',
    description: 'Estás en tu pico de estrógeno y testosterona. Tu brillo, confianza, magnetismo y libido están al máximo.',
    tips: [
      'Aprovecha para tener conversaciones importantes; tu comunicación es excelente.',
      'Es tu momento de máxima confianza para lucirte en presentaciones o reuniones.',
      'Date un capricho, siéntete hermosa y disfruta de tu propio magnetismo.',
      'Ideal para planes románticos y noches de cita.'
    ],
    tipsForHim: [
      'Está en su momento de mayor brillo y magnetismo. ¡Dile lo hermosa que se ve hoy!',
      'Planifica una cena romántica especial o un detalle tierno.',
      'La comunicación fluye de maravilla; es un gran momento para conectar profundamente.',
      'Hazle saber lo mucho que la admiras y celebra su energía radiante.'
    ]
  } as any,
  'Lútea': {
    phase: 'Lútea',
    color: '#E8DFFF', // Lavender
    bgLight: '#F6F3FF',
    borderAccent: '#D2C4FF',
    description: 'La progesterona domina. Tu cuerpo se prepara para bajar el ritmo. Puedes sentirte más sensible, introspectiva o antojadiza.',
    tips: [
      'No luches contra la necesidad de quedarte en casa y relajarte (anidación).',
      'Es normal sentir antojo de carbohidratos complejos o chocolate negro.',
      'Escribe en un diario; es un periodo muy intuitivo y creativo.',
      'Realiza ejercicios moderados como caminatas o pilates suave.'
    ],
    tipsForHim: [
      'Su cuerpo le pide desacelerar; es posible que prefiera quedarse en casa arrullada.',
      'Prepárate para llevarle su dulce favorito o un postre sin que lo pida.',
      'Evita discusiones o temas tensos; su sensibilidad emocional está más alta.',
      'Ofrécele un abrazo largo y hazla sentir segura y escuchada.'
    ]
  } as any
};

export interface CycleStats {
  currentDay: number;
  phase: CyclePhase;
  daysUntilNextPeriod: number;
  progressPercent: number;
  phaseInfo: {
    phase: CyclePhase;
    color: string;
    bgLight: string;
    borderAccent: string;
    description: string;
    tips: string[];
    tipsForHim: string[];
  };
}

/**
 * Calculates current cycle day, phase, and metadata
 */
export function calculateCycleStats(
  lastPeriodDateStr: string,
  cycleLength: number = 28,
  periodLength: number = 5
): CycleStats {
  if (!lastPeriodDateStr) {
    // Return sensible defaults if no date set
    return {
      currentDay: 1,
      phase: 'Menstruación',
      daysUntilNextPeriod: 27,
      progressPercent: 3.5,
      phaseInfo: PHASES_CONFIG['Menstruación'] as any
    };
  }

  // Parse today at midnight local time
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Parse lastPeriodDate at midnight local time
  const [year, month, day] = lastPeriodDateStr.split('-').map(Number);
  const lastPeriod = new Date(year, month - 1, day);
  lastPeriod.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - lastPeriod.getTime();
  let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    // If set in future, adjust to start at day 1
    diffDays = 0;
  }

  // Calculate current day within the cycle (1-based)
  const currentDay = (diffDays % cycleLength) + 1;

  // Calculate phase
  let phase: CyclePhase = 'Menstruación';
  
  // Custom formulas based on cycle lengths
  const ovulationDay = cycleLength - 14; // e.g. 14 for a 28-day cycle

  if (currentDay >= 1 && currentDay <= periodLength) {
    phase = 'Menstruación';
  } else if (currentDay > periodLength && currentDay < ovulationDay - 1) {
    phase = 'Folicular';
  } else if (currentDay >= ovulationDay - 1 && currentDay <= ovulationDay + 1) {
    phase = 'Ovulatoria';
  } else {
    phase = 'Lútea';
  }

  // Calculate days until next period
  const daysSinceCycleStart = currentDay - 1;
  const daysUntilNextPeriod = cycleLength - daysSinceCycleStart;

  // Progress percentage (for circle arc drawing)
  const progressPercent = (currentDay / cycleLength) * 100;

  return {
    currentDay,
    phase,
    daysUntilNextPeriod,
    progressPercent,
    phaseInfo: PHASES_CONFIG[phase] as any
  };
}
