import type { IconName } from '@/components/Icon/Icon';

export type Stat = {
  value: string;
  label: string;
};

export type Benefit = {
  icon: IconName;
  text: string;
};

export const stats: readonly Stat[] = [
  { value: '30 хв', label: 'тривалість заняття' },
  { value: '2 год', label: 'еквівалент навантаження' },
  { value: '90%', label: 'м’язів активуються' },
  { value: '1:1', label: 'персональний тренер' },
];

export const benefits: readonly Benefit[] = [
  { icon: 'zap', text: '30 хвилин EMS дорівнюють 2 годинам у звичайному залі' },
  {
    icon: 'shield-check',
    text: 'Мінімальне навантаження на суглоби завдяки електростимуляції м’язів',
  },
  {
    icon: 'trending-up',
    text: 'Ідеально поєднується зі звичайним залом і пришвидшує результат',
  },
  {
    icon: 'user-check',
    text: 'Кожне заняття — індивідуально з персональним тренером під ваші цілі',
  },
];
