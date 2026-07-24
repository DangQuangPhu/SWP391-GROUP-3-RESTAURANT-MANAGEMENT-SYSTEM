import { getRawPool } from "./src/db.js";
import sql from "mssql";

const ALL_MENU_ITEMS = [
  // Sushi & Sashimi
  { name: 'YELLOWTAIL JALAPEÑO', price: 168000, category: 'Sushi & Sashimi' },
  { name: 'TORO TARTARE WITH CAVIAR', price: 428000, category: 'Sushi & Sashimi' },
  { name: 'FLUKE SASHIMI DRY MISO', price: 188000, category: 'Sushi & Sashimi' },
  { name: 'NEW STYLE SASHIMI', price: 228000, category: 'Sushi & Sashimi' },
  { name: 'SALMON NEW STYLE', price: 168000, category: 'Sushi & Sashimi' },
  { name: 'BLUEFIN TORO NIGIRI', price: 350000, category: 'Sushi & Sashimi' },
  { name: 'SALMON BELLY SASHIMI', price: 195000, category: 'Sushi & Sashimi' },
  { name: 'HAMACHI CARPACCIO', price: 210000, category: 'Sushi & Sashimi' },
  { name: 'HOKKAIDO UNI NIGIRI', price: 480000, category: 'Sushi & Sashimi' },
  { name: 'WAGYU BEEF SASHIMI', price: 380000, category: 'Sushi & Sashimi' },
  { name: 'AMAEBI SWEET SHRIMP', price: 240000, category: 'Sushi & Sashimi' },
  { name: 'UNAGI DRAGON ROLL', price: 260000, category: 'Sushi & Sashimi' },
  { name: 'SPICY TUNA CRUNCH ROLL', price: 185000, category: 'Sushi & Sashimi' },
  { name: 'SPIDER SOFT SHELL CRAB ROLL', price: 290000, category: 'Sushi & Sashimi' },
  { name: 'HOTATE SCALLOP SASHIMI', price: 230000, category: 'Sushi & Sashimi' },
  { name: 'IKURA GUNKAN', price: 220000, category: 'Sushi & Sashimi' },
  { name: 'BOTAN EBI SASHIMI', price: 310000, category: 'Sushi & Sashimi' },
  { name: 'TAKO OCTOPUS SASHIMI', price: 175000, category: 'Sushi & Sashimi' },
  { name: 'MADAI RED SNAPPER', price: 205000, category: 'Sushi & Sashimi' },
  { name: 'ORA KING SALMON NIGIRI', price: 220000, category: 'Sushi & Sashimi' },
  { name: 'ABURI TRUFFLE SALMON', price: 235000, category: 'Sushi & Sashimi' },
  { name: 'PHŪRAI RAINBOW ROLL', price: 280000, category: 'Sushi & Sashimi' },
  { name: 'CHEF SASHIMI SELECTION (15 PCS)', price: 850000, category: 'Sushi & Sashimi' },

  // Noodle & Rice
  { name: 'SEAFOOD UDON', price: 148000, category: 'Noodle & Rice' },
  { name: 'WAGYU FRIED RICE', price: 188000, category: 'Noodle & Rice' },
  { name: 'LOBSTER FRIED RICE', price: 260000, category: 'Noodle & Rice' },
  { name: 'TRUFFLE WAGYU RAMEN', price: 220000, category: 'Noodle & Rice' },
  { name: 'SNOW CRAB FRIED RICE', price: 195000, category: 'Noodle & Rice' },
  { name: 'TEMPURA INANIWA UDON', price: 175000, category: 'Noodle & Rice' },
  { name: 'UNAGI DONBURI BOWL', price: 280000, category: 'Noodle & Rice' },
  { name: 'SPICY MISO SEAFOOD RAMEN', price: 185000, category: 'Noodle & Rice' },

  // Signature Dish
  { name: 'BLACK COD WITH MISO', price: 499000, category: 'Signature Dish' },
  { name: 'ROCK SHRIMP TEMPURA', price: 690000, category: 'Signature Dish' },

  // Seafood
  { name: 'LOBSTER WASABI PEPPER', price: 690000, category: 'Seafood' },
  { name: 'GRILLED SALMON', price: 248000, category: 'Seafood' },

  // Barbecue & Grill
  { name: 'JAPANESE A5 WAGYU', price: 890000, category: 'Barbecue & Grill' },
  { name: 'GRILLED LAMB CHOPS', price: 360000, category: 'Barbecue & Grill' },

  // Desserts
  { name: 'BENTO BOX CHOCOLATE CAKE', price: 98000, category: 'Desserts' },
  { name: 'MISO CAPPUCCINO', price: 118000, category: 'Desserts' },

  // Beverages
  { name: 'HOKUSETSU JUNMAI', price: 89000, category: 'Beverages' },
  { name: 'LYCHEE MARTINI', price: 89000, category: 'Beverages' },
  { name: 'ASAHI SUPER DRY DRAFT', price: 69000, category: 'Beverages' },

  // Sets
  { name: 'OMAKASE EXPERIENCE', price: 1290000, category: "Chef's Set Menu" },
  { name: 'SIGNATURE TASTING', price: 990000, category: "Chef's Set Menu" },
];

async function seedAllDishes() {
  try {
    const pool = await getRawPool();
    console.log("Seeding all menu dishes into dbo.Dishes...");

    for (const item of ALL_MENU_ITEMS) {
      const checkRes = await pool.request()
        .input('name', sql.NVarChar(255), item.name)
        .query(`SELECT dish_id FROM dbo.Dishes WHERE LOWER(dish_name) = LOWER(@name)`);

      if (checkRes.recordset.length === 0) {
        const catRes = await pool.request()
          .input('catName', sql.NVarChar(255), item.category)
          .query(`SELECT category_id FROM dbo.MenuCategories WHERE category_name = @catName`);
        
        const categoryId = catRes.recordset[0]?.category_id || 1;

        await pool.request()
          .input('catId', sql.Int, categoryId)
          .input('name', sql.NVarChar(255), item.name)
          .input('price', sql.Decimal(12, 2), item.price)
          .query(`
            INSERT INTO dbo.Dishes (category_id, dish_name, description, price, is_available)
            VALUES (@catId, @name, N'Fresh daily selection', @price, 1)
          `);
        console.log(`[+] Seeded new dish: ${item.name} (${item.price} VND)`);
      } else {
        await pool.request()
          .input('dishId', sql.Int, checkRes.recordset[0].dish_id)
          .input('price', sql.Decimal(12, 2), item.price)
          .query(`UPDATE dbo.Dishes SET price = @price WHERE dish_id = @dishId`);
      }
    }

    console.log("All dishes successfully seeded!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
}

seedAllDishes();
