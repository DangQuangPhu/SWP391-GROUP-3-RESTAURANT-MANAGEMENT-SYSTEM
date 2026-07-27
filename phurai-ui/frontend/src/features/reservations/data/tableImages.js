import winA from '@/assets/images/tables/win-a.jpg';
import winB from '@/assets/images/tables/win-b.jpg';
import winC from '@/assets/images/tables/win-c.jpg';
import winD from '@/assets/images/tables/win-d.jpg';
import vip1 from '@/assets/images/tables/vip-1.jpg';
import vip2 from '@/assets/images/tables/vip-2.jpg';
import vip3 from '@/assets/images/tables/vip-3.jpg';
import standardArea from '@/assets/images/tables/standard-area.jpg';
import premiumArea from '@/assets/images/tables/premium-area.jpg';
import kitchenViewArea from '@/assets/images/tables/kitchen-view-area.jpg';
import pr01 from '@/assets/images/tables/pr-01.jpg';
import pr02 from '@/assets/images/tables/pr-02.jpg';
import pr03 from '@/assets/images/tables/pr-03.jpg';
import pr04 from '@/assets/images/tables/pr-04.jpg';

export const TABLE_IMAGE_MAP = {
  'WIN-A': {
    image: winA,
    zone: 'Window Zone A',
    capacity: 2,
    table_code: 'WIN-A',
    description: 'Intimate dining table for two with panoramic floor-to-ceiling glass ocean views.'
  },
  'WIN-B': {
    image: winB,
    zone: 'Window Zone B',
    capacity: 4,
    table_code: 'WIN-B',
    description: 'Elegant window-side dining table for four with twilight coastal lighting.'
  },
  'WIN-C': {
    image: winC,
    zone: 'Window Zone C',
    capacity: 6,
    table_code: 'WIN-C',
    description: 'Spacious booth by panoramic glass window with spectacular sunset skyline views.'
  },
  'WIN-D': {
    image: winD,
    zone: 'Window Zone D',
    capacity: 8,
    table_code: 'WIN-D',
    description: 'Grand family dining table with dramatic night skyline window views and chandelier.'
  },
  'VIP-1': {
    image: vip1,
    zone: 'VIP Room 1',
    capacity: 6,
    table_code: 'VIP-1',
    description: 'Opulent private VIP room featuring crystal chandelier, mahogany walls, and private wine cellar view.'
  },
  'VIP-2': {
    image: vip2,
    zone: 'VIP Room 2',
    capacity: 6,
    table_code: 'VIP-2',
    description: 'Exclusive VIP room with modern Japanese minimalist aesthetic and golden backlit paper panels.'
  },
  'VIP-3': {
    image: vip3,
    zone: 'VIP Room 3',
    capacity: 6,
    table_code: 'VIP-3',
    description: 'Executive VIP private room with dark walnut wood paneling, cozy fireplace, and dedicated private bar.'
  },
  'PRE-01': { image: premiumArea, zone: 'Premium Area', capacity: 4, table_code: 'PRE-01', description: 'Central luxury dining table with velvet seating and ambient gold lighting.' },
  'PRE-02': { image: premiumArea, zone: 'Premium Area', capacity: 4, table_code: 'PRE-02', description: 'Central luxury dining table with velvet seating and ambient gold lighting.' },
  'PRE-03': { image: premiumArea, zone: 'Premium Area', capacity: 4, table_code: 'PRE-03', description: 'Central luxury dining table with velvet seating and ambient gold lighting.' },
  'PRE-04': { image: premiumArea, zone: 'Premium Area', capacity: 4, table_code: 'PRE-04', description: 'Central luxury dining table with velvet seating and ambient gold lighting.' },
  'K-01': { image: kitchenViewArea, zone: 'Kitchen View Area', capacity: 4, table_code: 'K-01', description: 'Interactive table with direct view of live Binchotan grill open kitchen.' },
  'K-02': { image: kitchenViewArea, zone: 'Kitchen View Area', capacity: 4, table_code: 'K-02', description: 'Interactive table with direct view of live Binchotan grill open kitchen.' },
  'K-03': { image: kitchenViewArea, zone: 'Kitchen View Area', capacity: 4, table_code: 'K-03', description: 'Interactive table with direct view of live Binchotan grill open kitchen.' },
  'K-04': { image: kitchenViewArea, zone: 'Kitchen View Area', capacity: 4, table_code: 'K-04', description: 'Interactive table with direct view of live Binchotan grill open kitchen.' },
  'PR-01': { image: pr01, zone: 'Private Room 1', capacity: 2, table_code: 'PR-01', description: 'Intimate Japanese shoji private dining room for two with traditional floor seating.' },
  'PR-02': { image: pr02, zone: 'Private Room 2', capacity: 4, table_code: 'PR-02', description: 'Contemporary private room with paper lantern light and sunken horigotatsu seating.' },
  'PR-03': { image: pr03, zone: 'Private Room 3', capacity: 6, table_code: 'PR-03', description: 'Sophisticated private room featuring natural stone feature wall and dark oak dining table.' },
  'PR-04': { image: pr04, zone: 'Private Room 4', capacity: 8, table_code: 'PR-04', description: 'Grand private room with exposed timber ceiling beams and expansive dining table.' }
};

// Generate standard area entries (S-01 to S-12)
for (let i = 1; i <= 12; i++) {
  const code = `S-${String(i).padStart(2, '0')}`;
  TABLE_IMAGE_MAP[code] = {
    image: standardArea,
    zone: 'Standard Dining Area',
    capacity: 4,
    table_code: code,
    description: 'Comfortable main dining hall table with warm ambient mood lighting.'
  };
}

export function getTableInfo(tableNumber, apiTable = null) {
  const mapped = TABLE_IMAGE_MAP[tableNumber];
  if (mapped) {
    return {
      ...mapped,
      table_id: apiTable?.table_id || tableNumber,
      capacity: apiTable?.capacity || mapped.capacity,
      label: apiTable?.display_label || mapped.zone
    };
  }

  // Fallback if unmapped
  return {
    image: standardArea,
    zone: apiTable?.zone_name || 'Dining Area',
    capacity: apiTable?.capacity || 4,
    table_code: tableNumber || 'TABLE',
    table_id: apiTable?.table_id || tableNumber,
    description: 'Fine dining seating with warm lighting and comfortable ambiance.'
  };
}
