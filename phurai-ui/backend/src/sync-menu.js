import pool from "./db.js";
import { menuCategories, flattenMenuDishes } from "../../frontend/src/features/menu/data/menuData.js";

async function syncMenu() {
  try {
    console.log("Starting menu sync...");

    // Disable foreign key checks if necessary, or delete in order.
    // DishImages depends on Dishes. OrderItems might depend on Dishes (if any).
    // We will just clear Dishes and MenuCategories.
    console.log("Clearing existing menu data...");
    
    // Delete Dishes
    await pool.query('DELETE FROM dbo.Dishes');
    
    // Delete MenuCategories
    await pool.query('DELETE FROM dbo.MenuCategories');

    console.log("Existing data cleared.");

    // Insert categories
    for (let i = 0; i < menuCategories.length; i++) {
      const cat = menuCategories[i];
      console.log(`Inserting category: ${cat.name}`);
      const [insertCat] = await pool.query(
        `INSERT INTO dbo.MenuCategories (category_name, display_order) OUTPUT INSERTED.category_id VALUES (?, ?)`,
        [cat.name, i + 1]
      );
      const categoryId = insertCat[0].category_id;

      // Insert dishes for this category
      for (const item of cat.items) {
        // Find if it has an image in our mock
        // Wait, image is just an import object in the frontend, it's compiled to a URL. 
        // We will just leave image_url blank or put a placeholder, or we can just rely on the frontend to map it via ID.
        // The frontend already maps images using ID in menuAssets.js! 
        // So we just need the IDs to match or just use the frontend mapping.
        
        console.log(`Inserting dish: ${item.name}`);
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

    console.log("Sync complete!");
    process.exit(0);
  } catch (error) {
    console.error("Sync failed:", error);
    process.exit(1);
  }
}

syncMenu();
