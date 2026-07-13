import pool from '../db.js';
import fs from 'node:fs';
import path from 'node:path';
const DISH_CATEGORIES = [
  'Sushi & Sashimi',
  'Noodle & Rice',
  'Signature Dish',
  'Seafood',
  'Barbecue & Grill',
  'Desserts',
  'Beverages',
  "Chef's Set Menu"
];

// Reusing the exact data from temp-sync.js
const MENU_DATA = [
  {
    category: 'Sushi & Sashimi',
    items: [
      {
        tag: 'New',
        name: 'YELLOWTAIL JALAPEÑO',
        price: 380000,
        description: 'Thinly sliced yellowtail paired with fresh jalapeño and cilantro, drizzled with yuzu soy sauce.',
      },
      {
        tag: 'Signature',
        name: 'TORO TARTARE WITH CAVIAR',
        price: 850000,
        description: 'Finely minced fatty tuna topped with Osetra caviar and a delicate wasabi soy sauce.',
      },
      {
        name: 'FLUKE SASHIMI DRY MISO',
        price: 320000,
        description: 'Fresh fluke sprinkled with dry red miso, yuzu juice, and extra virgin olive oil.',
      },
      {
        name: 'NEW STYLE SASHIMI',
        price: 450000,
        description: 'Lightly seared whitefish sashimi finished with hot sesame and olive oil, topped with ginger and garlic.',
      },
      {
        name: 'SALMON NEW STYLE',
        price: 420000,
        description: 'A twist on our classic, featuring premium salmon lightly seared with a hot oil blend.',
      },
    ],
  },
  {
    category: 'Noodle & Rice',
    items: [
      {
        name: 'SEAFOOD UDON',
        price: 290000,
        description: 'Thick udon noodles served in a savory dashi broth with shrimp, scallops, and fresh seasonal vegetables.',
      },
      {
        name: 'WAGYU FRIED RICE',
        price: 450000,
        description: 'Japanese A5 Wagyu beef stir-fried with premium Koshihikari rice, garlic, and scallions.',
      },
      {
        name: 'LOBSTER FRIED RICE',
        price: 520000,
        description: 'Luxurious fried rice featuring tender lobster chunks, egg, and a hint of truffle oil.',
      },
    ],
  },
  {
    category: 'Signature Dish',
    items: [
      {
        tag: 'Must Try',
        name: 'BLACK COD WITH MISO',
        price: 950000,
        description: 'Our iconic dish: tender black cod marinated for 72 hours in a sweet den miso glaze.',
      },
      {
        name: 'ROCK SHRIMP TEMPURA',
        price: 480000,
        description: 'Bite-sized shrimp tempura tossed in a creamy, spicy ponzu sauce.',
      },
    ],
  },
  {
    category: 'Seafood',
    items: [
      {
        name: 'LOBSTER WASABI PEPPER',
        price: 1250000,
        description: 'Whole lobster sautéed with a vibrant and zesty wasabi pepper sauce.',
      },
      {
        name: 'GRILLED SALMON',
        price: 550000,
        description: 'Perfectly grilled salmon fillet served with your choice of teriyaki or anti-cucho sauce.',
      },
    ],
  },
  {
    category: 'Barbecue & Grill',
    items: [
      {
        name: 'JAPANESE A5 WAGYU',
        price: 2500000,
        description: 'Premium A5 grade Wagyu beef, cooked on a hot stone at your table for an unforgettable experience.',
      },
      {
        name: 'GRILLED LAMB CHOPS',
        price: 850000,
        description: 'Tender lamb chops grilled to perfection with a spicy anticucho sauce.',
      },
    ],
  },
  {
    category: 'Desserts',
    items: [
      {
        name: 'BENTO BOX CHOCOLATE CAKE',
        price: 220000,
        description: 'A warm, melting chocolate fondant cake served with a refreshing scoop of green tea ice cream.',
      },
      {
        name: 'MISO CAPPUCCINO',
        price: 180000,
        description: 'A delicate layered dessert featuring miso-infused cream, coffee sponge, and caramelized pecans.',
      },
    ],
  },
  {
    category: 'Beverages',
    items: [
      {
        tag: 'Sake',
        name: 'HOKUSETSU JUNMAI',
        price: 1200000,
        description: 'A smooth, full-bodied premium sake, brewed exclusively for our restaurant.',
      },
      {
        name: 'LYCHEE MARTINI',
        price: 250000,
        description: 'A refreshing and sweet cocktail made with premium vodka and fresh lychee juice.',
      },
      {
        tag: 'By the Glass',
        name: 'PHŪRAI HOUSE WINE',
        price: 180000,
        description: 'Our carefully selected house wine, available in red or white to complement your meal.',
      },
      {
        tag: 'Bottle',
        name: 'PREMIUM RED WINE',
        price: 1850000,
        description: 'A robust and elegant red wine, perfect for pairing with our Wagyu and grilled dishes.',
      },
      {
        tag: 'Bottle',
        name: 'SIGNATURE WHITE WINE',
        price: 1600000,
        description: 'A crisp, refreshing white wine that beautifully highlights our seafood and sashimi selections.',
      },
      {
        tag: 'Fresh',
        name: 'FRESH ORANGE JUICE',
        price: 90000,
        description: 'Freshly squeezed orange juice, served chilled.',
      },
    ],
  },
  {
    category: "Chef's Set Menu",
    items: [
      {
        tag: "Chef's Set",
        courses: 2,
        name: 'CHEF\'S SET — 2 COURSES',
        price: 590000,
        description: 'A succinct culinary journey featuring an appetizer and a main dish handpicked by our chef.',
      },
      {
        tag: "Chef's Set",
        courses: 4,
        name: 'CHEF\'S SET — 4 COURSES',
        price: 1190000,
        description: 'A balanced experience of appetizers, sashimi, main course, and a delicate dessert.',
      },
      {
        tag: "Chef's Set",
        courses: 6,
        name: 'CHEF\'S SET — 6 COURSES',
        price: 1890000,
        description: 'An extended tasting menu offering a deep dive into our signature flavors and seasonal specialties.',
      },
      {
        tag: "Chef's Set",
        courses: 8,
        name: 'CHEF\'S SET — 8 COURSES',
        price: 2890000,
        description: 'A grand tasting feast crafted for sharing, pairing, and premium dining moments.',
      },
    ],
  },
];

export async function runAutoSeed() {
  try {
    // Check for filesystem lock from manual database initialization script
    const lockFile = path.join(process.cwd(), ".db-sync-lock");
    if (fs.existsSync(lockFile)) {
      console.log("[Seeder] Database initialization lock active. Skipping auto-seed.");
      return;
    }

    // Skip auto-seeding if the database already has seeded user accounts (e.g. from System_Restaurant.sql)
    // to prevent concurrent race conditions during manual database initialization.
    const [userRows] = await pool.query('SELECT COUNT(*) as count FROM dbo.UserAccounts');
    if (userRows[0].count > 4) {
      return;
    }

    const [rows] = await pool.query('SELECT COUNT(*) as count FROM dbo.Dishes');
    if (rows[0].count > 0) {
      return; // Already seeded
    }

    console.log("Auto-seeding database because dbo.Dishes is empty...");

    for (const cat of MENU_DATA) {
      let [existingCat] = await pool.query(
        'SELECT category_id FROM dbo.MenuCategories WHERE category_name = ?',
        [cat.category]
      );
      
      let categoryId;
      if (existingCat.length > 0) {
        categoryId = existingCat[0].category_id;
      } else {
        const [insertedCat] = await pool.query(
          'INSERT INTO dbo.MenuCategories (category_name, display_order) OUTPUT INSERTED.category_id VALUES (?, ?)',
          [cat.category, DISH_CATEGORIES.indexOf(cat.category)]
        );
        categoryId = insertedCat[0].category_id;
      }

      for (const item of cat.items) {
        await pool.query(
          `INSERT INTO dbo.Dishes (category_id, dish_name, description, price, spicy_level, prep_time_min, is_available, is_recommended, is_preorderable)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, 1)`,
          [
            categoryId,
            item.name,
            item.description || "",
            item.price || 0,
            item.spicy || 0,
            item.prep_minutes || 15,
            item.recommended ? 1 : 0
          ]
        );
      }
    }
    console.log("Auto-seeding completed successfully.");
  } catch (err) {
    console.error("Auto-seeding failed:", err);
  }
}
