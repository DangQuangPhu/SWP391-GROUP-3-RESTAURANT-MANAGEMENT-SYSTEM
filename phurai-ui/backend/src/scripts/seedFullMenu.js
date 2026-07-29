import { getRawPool } from "../db.js";
import sql from "mssql";

const ALL_MENU_CATEGORIES = [
  {
    name: 'Sushi & Sashimi',
    display_order: 1,
    items: [
      { id: 'yellowtail-jalapeno', name: 'YELLOWTAIL JALAPEÑO', price: 168000, description: 'thinly sliced yellowtail, yuzu soy sauce, garlic puree, jalapeño', recommended: 1 },
      { id: 'toro-tartare', name: 'TORO TARTARE WITH CAVIAR', price: 428000, description: 'finely chopped fatty tuna with wasabi soy and oscietra caviar', recommended: 1 },
      { id: 'fluke-sashimi', name: 'FLUKE SASHIMI DRY MISO', price: 188000, description: 'yuzu juice, extra virgin olive oil, dry miso, chives', recommended: 0 },
      { id: 'new-style-sashimi', name: 'NEW STYLE SASHIMI', price: 228000, description: 'seared sashimi with sesame seeds, chives, ginger, and garlic soy', recommended: 0 },
      { id: 'salmon-new-style', name: 'SALMON NEW STYLE', price: 168000, description: 'atlantic salmon, thinly sliced, seared with hot olive oil', recommended: 0 },
      { id: 'bluefin-toro-nigiri', name: 'BLUEFIN TORO NIGIRI', price: 350000, description: 'prime bluefin tuna belly over seasoned akazu sushi rice', recommended: 1 },
      { id: 'salmon-belly-sashimi', name: 'SALMON BELLY SASHIMI', price: 195000, description: 'melt-in-your-mouth fatty salmon slices with fresh grated wasabi', recommended: 1 },
      { id: 'hamachi-carpaccio', name: 'HAMACHI CARPACCIO', price: 210000, description: 'yellowtail sashimi drizzled with white truffle oil and ponzu sauce', recommended: 0 },
      { id: 'uni-sea-urchin-nigiri', name: 'HOKKAIDO UNI NIGIRI', price: 480000, description: 'fresh sweet sea urchin from Hokkaido wrapped in crisp nori', recommended: 1 },
      { id: 'wagyu-beef-sashimi', name: 'WAGYU BEEF SASHIMI', price: 380000, description: 'thinly sliced A5 Wagyu lightly torched with ponzu and scallions', recommended: 1 },
      { id: 'sweet-shrimp-amaebi', name: 'AMAEBI SWEET SHRIMP', price: 240000, description: 'sweet Japanese spot prawns served with deep-fried prawn head', recommended: 0 },
      { id: 'unagi-kabayaki-roll', name: 'UNAGI DRAGON ROLL', price: 260000, description: 'freshwater eel, avocado, cucumber, unagi reduction glaze', recommended: 0 },
      { id: 'spicy-tuna-crunch-roll', name: 'SPICY TUNA CRUNCH ROLL', price: 185000, description: 'chopped yellowfin tuna, spicy mayo, cucumber, tempura flakes', recommended: 0 },
      { id: 'soft-shell-crab-roll', name: 'SPIDER SOFT SHELL CRAB ROLL', price: 290000, description: 'crispy soft-shell crab, tobiko, avocado, spicy aioli', recommended: 1 },
      { id: 'scallop-sashimi-yuzu', name: 'HOTATE SCALLOP SASHIMI', price: 230000, description: 'sweet Japanese sea scallops infused with yuzu salt and shiso leaf', recommended: 0 },
      { id: 'salmon-roe-ikura-gunkan', name: 'IKURA GUNKAN', price: 220000, description: 'marinated salmon roe bursting with flavor wrapped in nori seaweed', recommended: 0 },
      { id: 'octopus-tako-sashimi', name: 'TAKO OCTOPUS SASHIMI', price: 175000, description: 'tender poached octopus sliced thin with sweet mustard soy', recommended: 0 },
      { id: 'red-snapper-madai', name: 'MADAI RED SNAPPER', price: 205000, description: 'Japanese sea bream with sea salt, lemon juice, and shiso leaf', recommended: 0 },
      { id: 'spicy-california-roll', name: 'SPICY CALIFORNIA ROLL', price: 140000, description: 'Classic sushi roll with crab meat, avocado, tobiko, and a spicy mayo drizzle', recommended: 0 }
    ]
  },
  {
    name: 'Noodle & Rice',
    display_order: 2,
    items: [
      { id: 'seafood-udon', name: 'SEAFOOD UDON', price: 148000, description: 'thick wheat noodles with assorted seafood in a rich dashi broth', recommended: 0 },
      { id: 'wagyu-fried-rice', name: 'WAGYU FRIED RICE', price: 188000, description: 'wok-charred rice with premium wagyu beef and seasonal vegetables', recommended: 1 },
      { id: 'lobster-fried-rice', name: 'LOBSTER FRIED RICE', price: 260000, description: 'delicate jasmine rice with butter-poached lobster and garlic', recommended: 1 },
      { id: 'truffle-beef-ramen', name: 'TRUFFLE WAGYU RAMEN', price: 220000, description: 'rich tonkotsu broth, slow-cooked wagyu chashu, black truffle oil', recommended: 1 },
      { id: 'crab-meat-fried-rice', name: 'SNOW CRAB FRIED RICE', price: 195000, description: 'fragrant garlic fried rice tossed with fresh snow crab meat', recommended: 0 },
      { id: 'tempura-udon-soup', name: 'TEMPURA INANIWA UDON', price: 175000, description: 'smooth Akita noodles served with crispy shrimp and vegetable tempura', recommended: 0 },
      { id: 'unagi-donburi', name: 'UNAGI DONBURI BOWL', price: 280000, description: 'grilled freshwater eel glazed with sweet soy reduction over steamy rice', recommended: 1 },
      { id: 'spicy-miso-ramen', name: 'SPICY MISO SEAFOOD RAMEN', price: 185000, description: 'fermented spicy miso broth, prawns, squid, nitamago soft egg', recommended: 0 },
      { id: 'banh-mi-hoi-an', name: 'BÁNH MÌ HỘI AN', price: 30000, description: 'Vietnamese Banh Mi sandwich with pork pate, char siu, fresh herbs, cucumber and chilli', recommended: 1 },
      { id: 'pho-bo-hanoi', name: 'PHỞ BÒ TÁI LĂN HÀ THÀNH', price: 30000, description: 'Traditional Hanoi beef noodle soup with sliced beef, scallions, and fresh herbs in rich bone broth', recommended: 1 },
      { id: 'bun-cha-hanoi', name: 'BÚN CHẢ HÀ NỘI TRUYỀN THỐNG', price: 30000, description: 'Hanoi style grilled pork patties with rice vermicelli noodles and fresh herbs in sweet dipping sauce', recommended: 1 },
      { id: 'com-tam-saigon', name: 'CƠM TẤM SÀI GÒN SƯỜN BÌ CHẢ', price: 30000, description: 'Saigon broken rice with grilled pork chop, steamed egg loaf, and scallion oil', recommended: 1 },
      { id: 'seafood-paella', name: 'SPANISH SEAFOOD PAELLA', price: 250000, description: 'Traditional Spanish seafood paella in pan with saffron rice, prawns, mussels, squid', recommended: 1 }
    ]
  },
  {
    name: 'Signature Dish',
    display_order: 3,
    items: [
      { id: 'wagyu-beef-toban-yaki', name: 'WAGYU TOBAN-YAKI', price: 680000, description: 'A5 Wagyu steak roasted on ceramic hot plate with wild mushrooms', recommended: 1 },
      { id: 'duck-breast-orange-miso', name: 'DUCK BREAST ORANGE MISO', price: 360000, description: 'pan-seared duck breast with citrus yuzu miso reduction sauce', recommended: 0 },
      { id: 'banh-xeo-mien-tay', name: 'BÁNH XÈO MIỀN TÂY', price: 30000, description: 'Crispy Vietnamese crepe filled with shrimp, pork, bean sprouts, served with mustard leaves', recommended: 0 },
      { id: 'goi-cuon-tom-thit', name: 'GỎI CUỐN TÔM THỊT', price: 20000, description: 'Fresh spring rolls with poached prawns, pork belly, herbs and rich peanut dipping sauce', recommended: 0 },
      { id: 'tacos-al-pastor', name: 'TACOS AL PASTOR', price: 120000, description: 'Authentic Mexican street tacos with marinated pork, pineapple, cilantro and onion on corn tortillas', recommended: 1 },
      { id: 'birria-quesatacos', name: 'BEEF BIRRIA QUESATACOS', price: 150000, description: 'Crispy Mexican cheesy beef tacos served with rich red dipping consomme broth', recommended: 1 }
    ]
  },
  {
    name: 'Seafood',
    display_order: 4,
    items: [
      { id: 'black-cod-miso', name: 'BLACK COD WITH MISO', price: 450000, description: 'Saikyo miso-marinated Alaskan black cod, broiled to perfection with sweet ginger sprout', recommended: 1 },
      { id: 'chilean-sea-bass-miso', name: 'CHILEAN SEA BASS MISO', price: 480000, description: 'pan-seared Chilean sea bass in savory yuzu miso reduction', recommended: 1 },
      { id: 'rock-shrimp-tempura', name: 'ROCK SHRIMP TEMPURA', price: 290000, description: 'crispy rock shrimp tempura tossed in creamy spicy mayo or ponzu butter sauce', recommended: 0 },
      { id: 'alaskan-king-crab-leg', name: 'ALASKAN KING CRAB LEG', price: 620000, description: 'chargrilled Alaskan king crab leg brushed with garlic shiso butter', recommended: 1 },
      { id: 'lobster-wasabi-pepper', name: 'LOBSTER WASABI PEPPER', price: 680000, description: 'whole Maine lobster sautéed with shishito peppers and spicy wasabi sauce', recommended: 1 },
      { id: 'jumbo-prawns-garlic-butter', name: 'JUMBO PRAWNS GARLIC BUTTER', price: 320000, description: 'pan-roasted tiger prawns with crushed garlic, Japanese butter, and sea salt', recommended: 0 },
      { id: 'soft-shell-crab-ponzu', name: 'SOFT SHELL CRAB PONZU', price: 280000, description: 'crispy whole soft shell crab served with momiji oroshi and citrus ponzu', recommended: 0 },
      { id: 'scallop-toban-yaki', name: 'HOTATE SCALLOP TOBAN-YAKI', price: 340000, description: 'Hokkaido sea scallops roasted on ceramic hot plate with sake, butter, and wild enoki', recommended: 0 },
      { id: 'charcoal-squid-shio-yaki', name: 'CHARCOAL SQUID SHIO-YAKI', price: 220000, description: 'whole Japanese flying squid grilled over binchotan charcoal with sea salt and lemon', recommended: 0 },
      { id: 'gambas-al-ajillo', name: 'GAMBAS AL AJILLO', price: 190000, description: 'Spanish sizzling garlic butter prawns cooked in olive oil and served in a hot clay tapas dish', recommended: 0 }
    ]
  },
  {
    name: 'Barbecue & Grill',
    display_order: 5,
    items: [
      { id: 'kurobuta-pork-chops', name: 'KUROBUTA PORK CHOPS', price: 290000, description: 'grilled Berkshire pork chops served with spicy mustard ponzu', recommended: 0 },
      { id: 'yakitori-chicken-thigh', name: 'YAKITORI CHICKEN SKEWERS', price: 135000, description: 'binchotan grilled chicken thighs brushed with house tare sauce', recommended: 0 },
      { id: 'tsukune-chicken-meatball', name: 'TSUKUNE WITH EGG YOLK', price: 145000, description: 'minced chicken skewers served with sweet tare glaze and raw egg yolk', recommended: 0 },
      { id: 'eringi-mushroom-skewers', name: 'KING OYSTER MUSHROOM GRILL', price: 110000, description: 'thickly sliced king oyster mushrooms brushed with garlic butter soy', recommended: 0 },
      { id: 'chicken-wings-tebasaki', name: 'TEBASAKI CRISPY CHICKEN WINGS', price: 140000, description: 'crispy grilled chicken wings coated in sweet garlic pepper glaze', recommended: 0 },
      { id: 'garlic-butter-corn-grill', name: 'JAPANESE SWEET CORN GRILL', price: 85000, description: 'sweet corn cob roasted with soy sauce and Hokkaido butter', recommended: 0 },
      { id: 'texas-bbq-ribs', name: 'TEXAS SMOKED BBQ RIBS', price: 350000, description: 'Tender Texas-style smoked baby back pork ribs heavily glazed in a rich barbecue sauce', recommended: 1 },
      { id: 'grilled-salmon', name: 'GRILLED SALMON', price: 248000, description: 'fresh salmon fillet grilled over open flame with teriyaki glaze', recommended: 1 },
      { id: 'japanese-a5-wagyu', name: 'JAPANESE A5 WAGYU', price: 890000, description: 'prime A5 wagyu beef strip loin grilled on lava stone', recommended: 1 },
      { id: 'grilled-lamb-chops', name: 'GRILLED LAMB CHOPS', price: 360000, description: 'tender lamb chops crusted with herbs and served with sansho pepper sauce', recommended: 1 }
    ]
  },
  {
    name: 'Desserts',
    display_order: 6,
    items: [
      { id: 'bento-chocolate-cake', name: 'BENTO BOX CHOCOLATE CAKE', price: 98000, description: 'warm chocolate fondant with green tea matcha ice cream', recommended: 1 },
      { id: 'miso-cappuccino', name: 'MISO CAPPUCCINO', price: 118000, description: 'coffee soil, miso foam, salted caramel ice cream', recommended: 1 },
      { id: 'matcha-green-tea-parfait', name: 'MATCHA GREEN TEA PARFAIT', price: 125000, description: 'layers of matcha gelato, azuki red bean paste, and mochi balls', recommended: 0 },
      { id: 'yuzu-cheesecake', name: 'YUZU CITRUS CHEESECAKE', price: 110000, description: 'creamy Japanese cheesecake infused with fragrant yuzu citrus zest', recommended: 0 },
      { id: 'black-sesame-crème-brûlée', name: 'BLACK SESAME CRÈME BRÛLÉE', price: 105000, description: 'rich roasted black sesame custard topped with caramelized sugar', recommended: 0 },
      { id: 'tokyo-banana-tart', name: 'TOKYO BANANA CARAMEL TART', price: 115000, description: 'caramelized banana tart served with vanilla bean ice cream', recommended: 0 },
      { id: 'japanese-fluffy-pancakes', name: 'SOUFFLÉ FLUFFY PANCAKES', price: 135000, description: 'pillow-soft soufflé pancakes served with whipped butter and maple syrup', recommended: 0 },
      { id: 'che-ba-mau', name: 'CHÈ BA MÀU', price: 20000, description: 'Vietnamese three-color dessert in a glass with red beans, pandan jelly, and rich coconut milk', recommended: 0 },
      { id: 'banh-flan-ca-phe', name: 'BÁNH FLAN DỪA CÀ PHÊ', price: 20000, description: 'Silky Vietnamese caramel egg flan served with shaved ice and a drizzle of dark espresso', recommended: 0 },
      { id: 'churros-chocolate', name: 'CHURROS CON CHOCOLATE', price: 85000, description: 'Warm Mexican cinnamon sugar churros sticks served with a rich chocolate dipping sauce', recommended: 1 },
      { id: 'ny-strawberry-cheesecake', name: 'NEW YORK STRAWBERRY CHEESECAKE', price: 120000, description: 'Classic baked New York cheesecake slice topped with fresh strawberry compote', recommended: 0 }
    ]
  },
  {
    name: 'Beverages',
    display_order: 7,
    items: [
      { id: 'hokusetsu-junmai', name: 'HOKUSETSU JUNMAI SAKE', price: 89000, description: 'premium house sake, clean and dry profile', recommended: 1 },
      { id: 'phurai-house-wine', name: 'PHŪRAI HOUSE RED WINE', price: 168000, description: 'Smooth house wine with a balanced aroma, suitable for pairing with sushi & grill', recommended: 0 },
      { id: 'phurai-white-wine-chardonay', name: 'PHŪRAI WHITE CHARDONNAY', price: 175000, description: 'crisp white wine with notes of green apple, perfect for seafood', recommended: 0 },
      { id: 'phurai-rose-vintage', name: 'PHŪRAI ROSÉ VINTAGE WINE', price: 190000, description: 'elegant pink rosé wine with delicate floral aromas', recommended: 0 },
      { id: 'fresh-orange-juice', name: 'FRESH ORANGE JUICE', price: 79000, description: 'freshly squeezed orange juice served chilled, bright and refreshing', recommended: 0 },
      { id: 'yuzu-sparkling-mocktail', name: 'YUZU SPARKLING MOCKTAIL', price: 85000, description: 'fresh yuzu citrus juice, soda water, mint, and honey', recommended: 0 },
      { id: 'japanese-whisky-highball', name: 'HIBIKI JAPANESE HIGHBALL', price: 210000, description: 'Suntory Hibiki Japanese whisky with premium soda and lemon twist', recommended: 1 },
      { id: 'matcha-latte-iced', name: 'ICED KYOTO MATCHA LATTE', price: 75000, description: 'ceremonial grade Kyoto matcha whisked with fresh milk and ice', recommended: 0 },
      { id: 'asahi-super-dry-beer', name: 'ASAHI SUPER DRY DRAFT', price: 69000, description: 'crisp, dry Japanese draft beer served ice-cold', recommended: 0 },
      { id: 'sapporo-premium-draft', name: 'SAPPORO PREMIUM BEER', price: 69000, description: 'smooth amber lager with a refined malt flavor', recommended: 0 },
      { id: 'sencha-green-tea-pot', name: 'ORGANIC SENCHA GREEN TEA', price: 55000, description: 'steamed Japanese green tea served hot in a traditional clay teapot', recommended: 0 },
      { id: 'ca-phe-trung', name: 'CÀ PHÊ TRỨNG HÀ NỘI', price: 25000, description: 'Hanoi Egg Coffee with a thick creamy whipped egg yolk layer over dark Robusta espresso', recommended: 1 },
      { id: 'ca-phe-sua-da', name: 'CÀ PHÊ SỮA ĐÁ SÀI GÒN', price: 20000, description: 'Classic Saigon iced milk coffee with slow-drip dark coffee and sweetened condensed milk', recommended: 0 },
      { id: 'tra-dao-cam-sa', name: 'TRÀ ĐÀO CAM SẢ', price: 25000, description: 'Refreshing iced peach and lemongrass tea with fresh orange slices and peach chunks', recommended: 0 },
      { id: 'sangria-roja', name: 'SPANISH SANGRIA ROJA', price: 180000, description: 'Classic Spanish red wine sangria with fresh orange slices, apples, and a hint of cinnamon', recommended: 0 },
      { id: 'lychee-martini', name: 'LYCHEE MARTINI', price: 89000, description: 'refreshing martini with lychee juice, vodka, and orange liqueur', recommended: 1 }
    ]
  },
  {
    name: "Chef's Set Menu",
    display_order: 8,
    items: [
      { id: 'omakase-experience', name: 'OMAKASE EXPERIENCE', price: 1290000, description: '5-course set featuring Yellowtail Jalapeno, Toro Tartare, Black Cod, and Dessert', recommended: 1 },
      { id: 'signature-tasting', name: 'SIGNATURE TASTING', price: 990000, description: '7-course grand Kaiseki set featuring A5 Wagyu, Chilean Sea Bass, and Premium Sake pairing', recommended: 1 },
      { id: 'combo-2', name: 'OMAKASE EXPERIENCE SET A', price: 1290000, description: '5-course set featuring Yellowtail Jalapeno, Toro Tartare, Black Cod, and Dessert', recommended: 1 },
      { id: 'combo-4', name: 'SIGNATURE TASTING SET B', price: 1890000, description: '7-course grand Kaiseki set featuring A5 Wagyu, Chilean Sea Bass, and Premium Sake pairing', recommended: 1 },
      { id: 'combo-6', name: 'ROYAL KAISEKI COMBO 6', price: 2490000, description: '9-course luxury tasting menu with Hokkaido Uni, King Crab, and Toro Sashimi', recommended: 1 },
      { id: 'combo-8', name: 'EMPEROR OMAKASE COMBO 8', price: 3200000, description: '11-course master omakase curated live by Chef Phūrai with caviar & truffle', recommended: 1 },
      { id: 'combo-10', name: 'IMPERIAL KAISEKI COMBO 10', price: 4500000, description: '12-course grand feast for royalty including Miyazaki Wagyu, Lobster, and rare Sakes', recommended: 1 }
    ]
  }
];

export async function seedFullMenuDatabase() {
  try {
    const pool = await getRawPool();
    console.log("[MenuSeeder] Starting full database menu synchronization...");

    let insertedCount = 0;

    for (const cat of ALL_MENU_CATEGORIES) {
      let catResult = await pool.request()
        .input("catName", sql.NVarChar(100), cat.name)
        .query(`SELECT category_id FROM dbo.MenuCategories WHERE category_name = @catName`);

      let categoryId;
      if (catResult.recordset.length > 0) {
        categoryId = catResult.recordset[0].category_id;
      } else {
        const insResult = await pool.request()
          .input("catName", sql.NVarChar(100), cat.name)
          .input("order", sql.Int, cat.display_order)
          .query(`INSERT INTO dbo.MenuCategories (category_name, display_order, is_active) OUTPUT INSERTED.category_id VALUES (@catName, @order, 1)`);
        categoryId = insResult.recordset[0].category_id;
      }

      for (const item of cat.items) {
        const dishResult = await pool.request()
          .input("dishName", sql.NVarChar(150), item.name)
          .query(`SELECT dish_id FROM dbo.Dishes WHERE dish_name = @dishName`);

        if (dishResult.recordset.length > 0) {
          await pool.request()
            .input("dishId", sql.Int, dishResult.recordset[0].dish_id)
            .input("catId", sql.Int, categoryId)
            .input("price", sql.Decimal(12, 2), item.price)
            .input("desc", sql.NVarChar(sql.MAX), item.description || "")
            .input("rec", sql.Bit, item.recommended ? 1 : 0)
            .query(`
              UPDATE dbo.Dishes
              SET category_id = @catId,
                  price = @price,
                  description = @desc,
                  is_recommended = @rec,
                  is_available = 1,
                  is_preorderable = 1,
                  updated_at = SYSDATETIME()
              WHERE dish_id = @dishId
            `);
        } else {
          await pool.request()
            .input("catId", sql.Int, categoryId)
            .input("dishName", sql.NVarChar(150), item.name)
            .input("desc", sql.NVarChar(sql.MAX), item.description || "")
            .input("price", sql.Decimal(12, 2), item.price)
            .input("prep", sql.Int, 15)
            .input("rec", sql.Bit, item.recommended ? 1 : 0)
            .query(`
              INSERT INTO dbo.Dishes (category_id, dish_name, description, price, prep_time_min, is_available, is_recommended, is_preorderable, created_at)
              VALUES (@catId, @dishName, @desc, @price, @prep, 1, @rec, 1, SYSDATETIME())
            `);
          insertedCount++;
        }
      }
    }

    const totalQuery = await pool.request().query(`SELECT COUNT(*) AS total FROM dbo.Dishes`);
    console.log(`[MenuSeeder] Menu sync complete. Total dishes in database: ${totalQuery.recordset[0].total}`);
    return { success: true, total: totalQuery.recordset[0].total };
  } catch (err) {
    console.error("[MenuSeeder] Error seeding full menu:", err);
    throw err;
  }
}
