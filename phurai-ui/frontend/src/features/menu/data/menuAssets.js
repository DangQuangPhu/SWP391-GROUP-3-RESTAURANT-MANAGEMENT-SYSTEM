import menuHero from '@/assets/images/menu/menu-hero.jpg';
import menuYellowtailJalapeno from '@/assets/images/menu/menu-yellowtail-jalapeno.jpg';
import menuToroTartare from '@/assets/images/menu/menu-toro-tartare.jpg';
import menuFlukeSashimi from '@/assets/images/menu/menu-fluke-sashimi.jpg';
import menuNewStyleSashimi from '@/assets/images/menu/menu-new-style-sashimi.jpg';
import menuSalmonNewStyle from '@/assets/images/menu/menu-salmon-new-style.jpg';
import menuSeafoodUdon from '@/assets/images/menu/menu-seafood-udon.jpg';
import menuWagyuFriedRice from '@/assets/images/menu/menu-wagyu-fried-rice.jpg';
import menuLobsterFriedRice from '@/assets/images/menu/menu-lobster-fried-rice.jpg';
import menuBlackCodMiso from '@/assets/images/menu/menu-black-cod-miso.jpg';
import menuRockShrimpTempura from '@/assets/images/menu/menu-rock-shrimp-tempura.jpg';
import menuLobsterWasabiPepper from '@/assets/images/menu/menu-lobster-wasabi-pepper.jpg';
import menuGrilledSalmon from '@/assets/images/menu/menu-grilled-salmon.jpg';
import menuJapaneseA5Wagyu from '@/assets/images/menu/menu-japanese-a5-wagyu.jpg';
import menuGrilledLambChops from '@/assets/images/menu/menu-grilled-lamb-chops.jpg';
import menuBentoChocolateCake from '@/assets/images/menu/menu-bento-chocolate-cake.jpg';
import menuMisoCappuccino from '@/assets/images/menu/menu-miso-cappuccino.jpg';
import menuHokusetsuJunmai from '@/assets/images/menu/menu-hokusetsu-junmai.jpg';
import menuLycheeMartini from '@/assets/images/menu/menu-lychee-martini.jpg';
import menuFooterBg from '@/assets/images/menu/menu-footer-bg.png';
import { menuCategoryIcons, utilityIcons } from '@/data/iconAssets.js';
import combo2 from '@/assets/images/menu/Combo2.jpg';
import combo4 from '@/assets/images/menu/Combo4.jpg';
import combo6 from '@/assets/images/menu/Combo6.jpg';
import combo8 from '@/assets/images/menu/Combo8.jpg';
import combo10 from '@/assets/images/menu/Combo10.jpg';
import scanImage from '@/assets/images/menu/Scan.jpg';
import wine from '@/assets/images/menu/Ruouvang1.jpg';
import wine2 from '@/assets/images/menu/Ruouvang2.jpg';
import wine3 from '@/assets/images/menu/Ruouvang3.jpg';
import orangejuice from '@/assets/images/menu/Nuoccam.jpg';

// Vite Eager Glob to bundle all downloaded dish images automatically
const globImages = import.meta.glob('@/assets/images/menu/*.jpg', { eager: true, import: 'default' });

function removeVietnameseTones(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

export function resolveDishImage(imagePath, dishName = '') {
  if (typeof imagePath === 'object' && imagePath !== null) {
    dishName = imagePath.dish_name || imagePath.name || dishName;
    imagePath = imagePath.image_url || imagePath.image || '';
  }

  let cleanPath = String(imagePath || '').trim();
  // Filter out internal API route URLs so token scoring operates on dishName!
  if (cleanPath.startsWith('/api/dishes/') || cleanPath.endsWith('/image')) {
    cleanPath = '';
  }

  // 1. Direct http or base64 data URL
  if (cleanPath.startsWith('http') || cleanPath.startsWith('data:')) {
    return cleanPath;
  }

  // 2. Direct glob match if cleanPath is an exact asset path or filename
  if (cleanPath) {
    const filename = cleanPath.split('/').pop().toLowerCase();
    for (const [key, val] of Object.entries(globImages)) {
      const keyLower = key.toLowerCase();
      if (keyLower.endsWith(`/${filename}`) || keyLower.endsWith(filename)) {
        return val;
      }
    }
  }

  // 3. Smart Token Scoring match on dishName & cleanPath against all globImages
  const rawText = removeVietnameseTones(dishName || cleanPath || '').replace(/[^a-z0-9\s]/g, ' ');
  const tokens = rawText.split(/\s+/).filter(t => t.length >= 2 && t !== 'with' && t !== 'and');

  if (tokens.length > 0) {
    let bestMatch = null;
    let highestScore = 0;

    for (const [key, val] of Object.entries(globImages)) {
      const keyLower = key.toLowerCase();
      // Skip non-dish UI utility images
      if (keyLower.includes('menu-hero') || keyLower.includes('icon') || keyLower.includes('social') || keyLower.includes('footer') || keyLower.includes('nav')) {
        continue;
      }

      let score = 0;
      for (const token of tokens) {
        if (keyLower.includes(token)) {
          score += 1;
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = val;
      }
    }

    if (bestMatch && highestScore >= 1) {
      return bestMatch;
    }
  }

  // 4. Fallback map & default dish image
  if (cleanPath && imagePathMap[cleanPath]) return imagePathMap[cleanPath];

  return globImages['/src/assets/images/menu/dish-sushi-sashimi.jpg'] || menuHero;
}





export const menuIcons = {
  nav: [
    menuCategoryIcons.sushiSashimi,
    menuCategoryIcons.noodleRice,
    menuCategoryIcons.signatureDish,
    menuCategoryIcons.seafood,
    menuCategoryIcons.barbecueGrill,
    menuCategoryIcons.desserts,
    menuCategoryIcons.beverages,
    menuCategoryIcons.chefsSetMenu,
  ],
  accessibility: utilityIcons.accessibility,
  scrollTop: utilityIcons.scrollTop,
};

export const menuComboImages = {
  combo2,
  combo4,
  combo6,
  combo8,
  combo10,
};

export const menuImages = {
  combo2,
  combo4,
  combo6,
  combo8,
  combo10,
  scanImage,
  omakaseExperience: combo8,
  signatureTasting: combo6,
  hero: menuHero,
  yellowtailJalapeno: menuYellowtailJalapeno,
  toroTartare: menuToroTartare,
  flukeSashimi: menuFlukeSashimi,
  newStyleSashimi: menuNewStyleSashimi,
  salmonNewStyle: menuSalmonNewStyle,
  seafoodUdon: menuSeafoodUdon,
  wagyuFriedRice: menuWagyuFriedRice,
  lobsterFriedRice: menuLobsterFriedRice,
  blackCodMiso: menuBlackCodMiso,
  rockShrimpTempura: menuRockShrimpTempura,
  lobsterWasabiPepper: menuLobsterWasabiPepper,
  grilledSalmon: menuGrilledSalmon,
  japaneseA5Wagyu: menuJapaneseA5Wagyu,
  grilledLambChops: menuGrilledLambChops,
  bentoChocolateCake: menuBentoChocolateCake,
  misoCappuccino: menuMisoCappuccino,
  hokusetsuJunmai: menuHokusetsuJunmai,
  lycheeMartini: menuLycheeMartini,
  footerBg: menuFooterBg,
  scanImage: scanImage,
  wine: wine,
  wine2: wine2,
  wine3: wine3,
  orangejuice: orangejuice,
};

export const imagePathMap = {
  '/menu/menu-hero.jpg': menuHero,
  '/menu/yellowtail-jalapeno.jpg': menuYellowtailJalapeno,
  '/menu/toro-tartare.jpg': menuToroTartare,
  '/menu/fluke-sashimi.jpg': menuFlukeSashimi,
  '/menu/new-style-sashimi.jpg': menuNewStyleSashimi,
  '/menu/salmon-new-style.jpg': menuSalmonNewStyle,
  '/menu/seafood-udon.jpg': menuSeafoodUdon,
  '/menu/wagyu-fried-rice.jpg': menuWagyuFriedRice,
  '/menu/lobster-fried-rice.jpg': menuLobsterFriedRice,
  '/menu/black-cod-miso.jpg': menuBlackCodMiso,
  '/menu/rock-shrimp-tempura.jpg': menuRockShrimpTempura,
  '/menu/lobster-wasabi-pepper.jpg': menuLobsterWasabiPepper,
  '/menu/grilled-salmon.jpg': menuGrilledSalmon,
  '/menu/japanese-a5-wagyu.jpg': menuJapaneseA5Wagyu,
  '/menu/grilled-lamb-chops.jpg': menuGrilledLambChops,
  '/menu/bento-chocolate-cake.jpg': menuBentoChocolateCake,
  '/menu/miso-cappuccino.jpg': menuMisoCappuccino,
  '/menu/hokusetsu-junmai.jpg': menuHokusetsuJunmai,
  '/menu/lychee-martini.jpg': menuLycheeMartini,
  '/menu/menu-footer-bg.png': menuFooterBg,
  '/menu/Combo2.jpg': combo2,
  '/menu/Combo4.jpg': combo4,
  '/menu/Combo6.jpg': combo6,
  '/menu/Combo8.jpg': combo8,
  '/menu/Combo10.jpg': combo10,
  '/menu/Scan.jpg': scanImage,
  '/menu/Ruouvang1.jpg': wine,
  '/menu/Ruouvang2.jpg': wine2,
  '/menu/Ruouvang3.jpg': wine3,
  '/menu/Nuoccam.jpg': orangejuice,
};
