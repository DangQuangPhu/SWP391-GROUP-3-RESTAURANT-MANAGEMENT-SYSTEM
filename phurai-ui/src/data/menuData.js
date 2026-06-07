import { menuImages } from './menuAssets';

export const menuCategories = [
  {
    id: 'sushi-sashimi',
    name: 'Sushi & Sashimi',
    subtitle: 'FRESH DAILY SELECTION',
    iconKey: 'sushiSashimi',
    iconClass: 'icon-18',
    items: [
      {
        id: 'yellowtail-jalapeno',
        name: 'YELLOWTAIL JALAPEÑO',
        price: 168000,
        description: 'thinly sliced yellowtail, yuzu soy sauce, garlic puree, jalapeño',
        image: menuImages.yellowtailJalapeno,
      },
      {
        id: 'toro-tartare',
        name: 'TORO TARTARE WITH CAVIAR',
        price: 428000,
        description: 'finely chopped fatty tuna with wasabi soy and oscietra caviar',
        image: menuImages.toroTartare,
      },
      {
        id: 'fluke-sashimi',
        name: 'FLUKE SASHIMI DRY MISO',
        price: 188000,
        description: 'yuzu juice, extra virgin olive oil, dry miso, chives',
        image: menuImages.flukeSashimi,
      },
      {
        id: 'new-style-sashimi',
        name: 'NEW STYLE SASHIMI',
        price: 228000,
        description: 'seared sashimi with sesame seeds, chives, ginger, and garlic soy',
        image: menuImages.newStyleSashimi,
      },
      {
        id: 'salmon-new-style',
        name: 'SALMON NEW STYLE',
        price: 168000,
        description: 'atlantic salmon, thinly sliced, seared with hot olive oil',
        image: menuImages.salmonNewStyle,
      },
    ],
  },
  {
    id: 'noodle-rice',
    name: 'Noodle & Rice',
    subtitle: 'TRADITIONAL COMFORT',
    iconKey: 'noodleRice',
    iconClass: 'icon-20',
    items: [
      {
        id: 'seafood-udon',
        name: 'SEAFOOD UDON',
        price: 148000,
        description: 'thick wheat noodles with assorted seafood in a rich dashi broth',
        image: menuImages.seafoodUdon,
      },
      {
        id: 'wagyu-fried-rice',
        name: 'WAGYU FRIED RICE',
        price: 188000,
        description: 'wok-charred rice with premium wagyu beef and seasonal vegetables',
        image: menuImages.wagyuFriedRice,
      },
      {
        id: 'lobster-fried-rice',
        name: 'LOBSTER FRIED RICE',
        price: 260000,
        description: 'delicate jasmine rice with butter-poached lobster and garlic',
        image: menuImages.lobsterFriedRice,
      },
    ],
  },
  {
    id: 'signature-dish',
    name: 'Signature Dish',
    subtitle: 'THE KAISEKI ESSENCE',
    iconKey: 'signatureDish',
    iconClass: 'icon-20',
    items: [
      {
        id: 'black-cod-miso',
        name: 'BLACK COD WITH MISO',
        price: 420000,
        description: 'tender black cod marinated for three days in a sweet miso glaze',
        image: menuImages.blackCodMiso,
      },
      {
        id: 'rock-shrimp-tempura',
        name: 'ROCK SHRIMP TEMPURA',
        price: 690000,
        description: 'served with either creamy spicy sauce or butter ponzu',
        image: menuImages.rockShrimpTempura,
      },
    ],
  },
  {
    id: 'seafood',
    name: 'Seafood',
    subtitle: 'COASTAL TREASURES',
    iconKey: 'seafood',
    iconClass: 'icon-seafood',
    items: [
      {
        id: 'lobster-wasabi-pepper',
        name: 'LOBSTER WASABI PEPPER',
        price: 690000,
        description: 'whole lobster sautéed with black pepper, wasabi, and seasonal greens',
        image: menuImages.lobsterWasabiPepper,
      },
      {
        id: 'grilled-salmon',
        name: 'GRILLED SALMON',
        price: 248000,
        description: 'anticucho or teriyaki glaze, served with crispy baby bok choy',
        image: menuImages.grilledSalmon,
      },
    ],
  },
  {
    id: 'barbecue-grill',
    name: 'Barbecue & Grill',
    subtitle: 'THE ART OF FIRE',
    iconKey: 'barbecueGrill',
    iconClass: 'icon-grill',
    multiline: true,
    items: [
      {
        id: 'japanese-a5-wagyu',
        name: 'JAPANESE A5 WAGYU',
        price: 890000,
        description: 'the pinnacle of beef quality, flame-grilled over binchotan charcoal',
        image: menuImages.japaneseA5Wagyu,
        badge: 'LIMITED',
      },
      {
        id: 'grilled-lamb-chops',
        name: 'GRILLED LAMB CHOPS',
        price: 360000,
        description: 'marinated in rosemary and garlic, served with rosemary-miso sauce',
        image: menuImages.grilledLambChops,
      },
    ],
  },
  {
    id: 'desserts',
    name: 'Desserts',
    subtitle: 'SWEET REFINEMENT',
    iconKey: 'desserts',
    iconClass: 'icon-desserts',
    items: [
      {
        id: 'bento-chocolate-cake',
        name: 'BENTO BOX CHOCOLATE CAKE',
        price: 98000,
        description: 'warm chocolate fondant with green tea matcha ice cream',
        image: menuImages.bentoChocolateCake,
      },
      {
        id: 'miso-cappuccino',
        name: 'MISO CAPPUCCINO',
        price: 118000,
        description: 'coffee soil, miso foam, salted caramel ice cream',
        image: menuImages.misoCappuccino,
      },
    ],
  },
  {
    id: 'beverages',
    name: 'Beverages',
    subtitle: 'LIQUID ARTISTRY',
    iconKey: 'beverages',
    iconClass: 'icon-18',
    items: [
      {
        id: 'hokusetsu-junmai',
        name: 'HOKUSETSU JUNMAI',
        price: 89000,
        description: 'premium house sake, clean and dry profile',
        image: menuImages.hokusetsuJunmai,
      },
      {
        id: 'lychee-martini',
        name: 'LYCHEE MARTINI',
        price: 89000,
        description: 'vodka, lychee liqueur, fresh lychee juice',
        image: menuImages.lycheeMartini,
      },
    ],
  },
  {
    id: 'chefs-set-menu',
    name: "Chef's Set Menu",
    subtitle: 'THE ULTIMATE EXPERIENCE',
    iconKey: 'chefsSetMenu',
    iconClass: 'icon-chef',
    titleDark: true,
    variant: 'set-cards',
    items: [
      {
        id: 'omakase-experience',
        name: 'OMAKASE EXPERIENCE',
        price: 1290000,
        description:
          "a personalized multi-course journey designed by our head chef to showcase the season's best.",
        image: menuImages.hero,
        setCard: {
          label: 'RECOMMENDED',
          labelMuted: false,
          titleLines: ['OMAKASE', 'EXPERIENCE'],
        },
      },
      {
        id: 'signature-tasting',
        name: 'SIGNATURE TASTING',
        price: 990000,
        description:
          'a curated seven-course menu featuring our world-renowned signature dishes.',
        image: menuImages.hero,
        setCard: {
          label: 'TRADITION',
          labelMuted: true,
          titleLines: ['SIGNATURE', 'TASTING'],
          alt: true,
        },
      },
    ],
  },
];

export function flattenMenuDishes(categories = menuCategories) {
  return categories.flatMap((category) =>
    category.items.map((item) => ({
      ...item,
      categoryId: category.id,
      categoryName: category.name,
    }))
  );
}
