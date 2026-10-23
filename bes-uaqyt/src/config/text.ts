// All on-screen copy and type settings. Sizes are px at 1080 × 1920.

export const FONT_FAMILY = 'NotoSansKZ';
export const FONT_FILE = 'fonts/NotoSans.ttf'; // Noto Sans variable (wght 100–900), OFL

export const TITLES: Record<string, string> = {
  tan: 'ТАҢ',
  besin: 'БЕСІН',
  ekinti: 'ЕКІНТІ',
  aqsham: 'АҚШАМ',
  quptan: 'ҚҰПТАН',
};

/** Stones in release order (one per prayer). */
export const STONES = ['Өкініш', 'Уайым', 'Реніш', 'Жаман әдет', 'Өткеннің жүгі'];

export const FINAL_LINES = [
  {text: 'Бәрін жалғыз көтеруің міндет емес.', size: 45, weight: 460, tracking: 0.005, y: 610},
  {text: 'Жүгіңді түсір.', size: 86, weight: 600, tracking: -0.01, y: 724},
  {text: 'Күніне бес рет.', size: 52, weight: 460, tracking: 0.02, y: 826},
];

export const TYPE = {
  title: {size: 44, weight: 520, tracking: 0.34, y: 352},
  stone: {size: 38, weight: 500, tracking: 0.02},
  color: '#f3f1ec',
};
