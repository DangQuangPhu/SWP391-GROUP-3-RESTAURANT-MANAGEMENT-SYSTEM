import pool from '../db.js';

export async function getMenu(req, res) {
  try {
    const [dishes] = await pool.query(`
      SELECT
        d.dish_id,
        d.dish_name as name,
        c.category_name as category,
        d.price,
        d.description,
        d.is_preorderable,
        d.spicy_level,
        d.prep_time_min as prep_time_minutes,
        d.is_available,
        d.is_recommended,
        img.image_url
      FROM dbo.Dishes d
      JOIN dbo.MenuCategories c ON d.category_id = c.category_id
      LEFT JOIN dbo.DishImages img ON d.dish_id = img.dish_id AND img.is_primary = 1
      ORDER BY c.display_order, d.dish_name
    `);

    res.json({ 
      success: true, 
      data: dishes.map(d => ({
        ...d,
        is_available: !!d.is_available,
        is_recommended: !!d.is_recommended,
        is_preorderable: !!d.is_preorderable
      })) 
    });
  } catch (error) {
    console.error("GET /api/menu Error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch menu" });
  }
}

export async function createDish(req, res) {
  try {
    const { name, category, price, description, image_url, spicy_level, prep_time_minutes, is_available, is_recommended, is_preorderable } = req.body;

    // Resolve category_id
    const [cats] = await pool.query(`SELECT category_id FROM dbo.MenuCategories WHERE category_name = ?`, [category]);
    let categoryId = cats.length ? cats[0].category_id : null;
    
    if (!categoryId) {
       const [insertCat] = await pool.query(`INSERT INTO dbo.MenuCategories (category_name) OUTPUT INSERTED.category_id VALUES (?)`, [category]);
       categoryId = insertCat[0].category_id;
    }

    const [dish] = await pool.query(`
      INSERT INTO dbo.Dishes (category_id, dish_name, description, price, spicy_level, prep_time_min, is_available, is_recommended, is_preorderable)
      OUTPUT INSERTED.dish_id
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [categoryId, name, description, price, spicy_level || 0, prep_time_minutes || null, is_available ? 1 : 0, is_recommended ? 1 : 0, is_preorderable ? 1 : 0]);

    const newDishId = dish[0].dish_id;

    if (image_url) {
      await pool.query(`
        INSERT INTO dbo.DishImages (dish_id, image_url, is_primary)
        VALUES (?, ?, 1)
      `, [newDishId, image_url]);
    }

    res.status(201).json({ success: true, message: "Dish created successfully", dish_id: newDishId });
  } catch (error) {
    console.error("POST /api/manager/menu Error:", error);
    res.status(500).json({ success: false, message: "Failed to create dish" });
  }
}

export async function updateDish(req, res) {
  try {
    const { id } = req.params;
    const { name, category, price, description, image_url, spicy_level, prep_time_minutes, is_available, is_recommended, is_preorderable } = req.body;

    // Resolve category_id
    const [cats] = await pool.query(`SELECT category_id FROM dbo.MenuCategories WHERE category_name = ?`, [category]);
    let categoryId = cats.length ? cats[0].category_id : null;
    
    if (!categoryId && category) {
       const [insertCat] = await pool.query(`INSERT INTO dbo.MenuCategories (category_name) OUTPUT INSERTED.category_id VALUES (?)`, [category]);
       categoryId = insertCat[0].category_id;
    }

    await pool.query(`
      UPDATE dbo.Dishes
      SET category_id = COALESCE(?, category_id),
          dish_name = COALESCE(?, dish_name),
          description = COALESCE(?, description),
          price = COALESCE(?, price),
          spicy_level = COALESCE(?, spicy_level),
          prep_time_min = COALESCE(?, prep_time_min),
          is_available = COALESCE(?, is_available),
          is_recommended = COALESCE(?, is_recommended),
          is_preorderable = COALESCE(?, is_preorderable),
          updated_at = SYSDATETIME()
      WHERE dish_id = ?
    `, [categoryId, name, description, price, spicy_level, prep_time_minutes, is_available ? 1 : 0, is_recommended ? 1 : 0, is_preorderable ? 1 : 0, id]);

    if (image_url !== undefined) {
      // Upsert the primary image
      await pool.query(`DELETE FROM dbo.DishImages WHERE dish_id = ?`, [id]);
      if (image_url) {
        await pool.query(`INSERT INTO dbo.DishImages (dish_id, image_url, is_primary) VALUES (?, ?, 1)`, [id, image_url]);
      }
    }

    res.json({ success: true, message: "Dish updated successfully" });
  } catch (error) {
    console.error("PUT /api/manager/menu/:id Error:", error);
    res.status(500).json({ success: false, message: "Failed to update dish" });
  }
}

export async function deleteDish(req, res) {
  try {
    const { id } = req.params;
    
    // First, verify dish exists
    const [dish] = await pool.query('SELECT dish_id FROM dbo.Dishes WHERE dish_id = ?', [id]);
    if (!dish.length) {
        return res.status(404).json({ success: false, message: 'Dish not found' });
    }

    await pool.query(`DELETE FROM dbo.Dishes WHERE dish_id = ?`, [id]);
    
    res.json({ success: true, message: "Dish deleted successfully" });
  } catch (error) {
    console.error("DELETE /api/manager/menu/:id Error:", error);
    
    // Handle foreign key constraint error specifically
    if (error.message.includes('FOREIGN KEY constraint')) {
        return res.status(400).json({ 
            success: false, 
            message: "Cannot delete this dish as it is part of existing orders or preorders." 
        });
    }

    res.status(500).json({ success: false, message: "Failed to delete dish" });
  }
}

export async function syncMenu(req, res) {
  try {
    const menuCategories = [
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
          },
          {
            id: 'toro-tartare',
            name: 'TORO TARTARE WITH CAVIAR',
            price: 428000,
            description: 'finely chopped fatty tuna with wasabi soy and oscietra caviar',
          },
          {
            id: 'fluke-sashimi',
            name: 'FLUKE SASHIMI DRY MISO',
            price: 188000,
            description: 'yuzu juice, extra virgin olive oil, dry miso, chives',
          },
          {
            id: 'new-style-sashimi',
            name: 'NEW STYLE SASHIMI',
            price: 228000,
            description: 'seared sashimi with sesame seeds, chives, ginger, and garlic soy',
          },
          {
            id: 'salmon-new-style',
            name: 'SALMON NEW STYLE',
            price: 168000,
            description: 'atlantic salmon, thinly sliced, seared with hot olive oil',
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
          },
          {
            id: 'wagyu-fried-rice',
            name: 'WAGYU FRIED RICE',
            price: 188000,
            description: 'wok-charred rice with premium wagyu beef and seasonal vegetables',
          },
          {
            id: 'lobster-fried-rice',
            name: 'LOBSTER FRIED RICE',
            price: 260000,
            description: 'delicate jasmine rice with butter-poached lobster and garlic',
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
            price: 499000,
            description: 'tender black cod marinated for three days in a sweet miso glaze',
          },
          {
            id: 'rock-shrimp-tempura',
            name: 'ROCK SHRIMP TEMPURA',
            price: 690000,
            description: 'served with either creamy spicy sauce or butter ponzu',
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
          },
          {
            id: 'grilled-salmon',
            name: 'GRILLED SALMON',
            price: 248000,
            description: 'anticucho or teriyaki glaze, served with crispy baby bok choy',
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
            badge: 'LIMITED',
          },
          {
            id: 'grilled-lamb-chops',
            name: 'GRILLED LAMB CHOPS',
            price: 360000,
            description: 'marinated in rosemary and garlic, served with rosemary-miso sauce',
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
          },
          {
            id: 'miso-cappuccino',
            name: 'MISO CAPPUCCINO',
            price: 118000,
            description: 'coffee soil, miso foam, salted caramel ice cream',
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
          },
          {
            id: 'lychee-martini',
            name: 'LYCHEE MARTINI',
            price: 89000,
            description: 'vodka, lychee liqueur, fresh lychee juice',
          },
          {
            id: 'phurai-house-wine',
            name: 'PHŪRAI HOUSE WINE',
            price: 168000,
            description: 'Smooth house wine with a balanced aroma, suitable for pairing with seafood, sushi, and grilled dishes.',
          },
          {
            id: 'premium-red-wine',
            name: 'PREMIUM RED WINE',
            price: 228000,
            description: 'Rich red wine with deep fruit notes and a smooth finish, recommended with wagyu, lamb chops, and signature dishes.',
          },
          {
            id: 'signature-white-wine',
            name: 'SIGNATURE WHITE WINE',
            price: 198000,
            description: 'Crisp and elegant wine with a refreshing profile, ideal for sashimi, seafood, and light appetizers.',
          },
          {
            id: 'fresh-orange-juice',
            name: 'FRESH ORANGE JUICE',
            price: 79000,
            description: 'Freshly squeezed orange juice served chilled, bright and refreshing for any meal.',
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
            id: 'chef-set-2',
            type: 'chef-set',
            tag: "Chef's Set",
            courses: 2,
            name: 'CHEF\'S SET — 2 COURSES',
            price: 890000,
            description: 'An intimate introduction to Phūrai with two chef-selected courses.',
          },
          {
            id: 'chef-set-4',
            type: 'chef-set',
            tag: "Chef's Set",
            courses: 4,
            name: 'CHEF\'S SET — 4 COURSES',
            price: 1490000,
            description: 'A balanced four-course progression through seasonal ingredients.',
          },
          {
            id: 'chef-set-6',
            type: 'chef-set',
            tag: "Chef's Set",
            courses: 6,
            name: 'CHEF\'S SET — 6 COURSES',
            price: 2190000,
            description: 'A celebratory six-course journey featuring seafood, grill, and signature pairings.',
          },
          {
            id: 'chef-set-8',
            type: 'chef-set',
            tag: "Chef's Set",
            courses: 8,
            name: 'CHEF\'S SET — 8 COURSES',
            price: 2890000,
            description: 'A grand tasting feast crafted for sharing, pairing, and premium dining moments.',
          },
        ],
      },
    ];

    await pool.query('DELETE FROM dbo.RecommendationLogs');
    await pool.query('DELETE FROM dbo.OrderItems');
    await pool.query('DELETE FROM dbo.PreorderItems');
    await pool.query('DELETE FROM dbo.KitchenTickets');
    await pool.query('DELETE FROM dbo.DishImages');
    await pool.query('DELETE FROM dbo.Dishes');
    await pool.query('DELETE FROM dbo.MenuCategories');

    for (let i = 0; i < menuCategories.length; i++) {
      const cat = menuCategories[i];
      const [insertCat] = await pool.query(
        `INSERT INTO dbo.MenuCategories (category_name, display_order) OUTPUT INSERTED.category_id VALUES (?, ?)`,
        [cat.name, i + 1]
      );
      const categoryId = insertCat[0].category_id;

      for (const item of cat.items) {
        await pool.query(
          `INSERT INTO dbo.Dishes (category_id, dish_name, description, price, spicy_level, prep_time_min, is_available, is_recommended)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
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

    res.json({ success: true, message: "Menu synchronized perfectly." });
  } catch (error) {
    console.error("Sync failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}
