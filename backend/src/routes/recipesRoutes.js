const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

/**
 * GET /api/recipes - Get all recipes (BOM)
 */
router.get('/', (req, res) => {
  try {
    const recipesFilePath = path.join(__dirname, '../../data/recipes_bom.json');
    const recipesData = JSON.parse(fs.readFileSync(recipesFilePath, 'utf8'));
    
    res.json({
      success: true,
      data: recipesData.recipes
    });
  } catch (error) {
    console.error('Error loading recipes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/recipes/:menuItemId - Get recipe for a specific menu item
 */
router.get('/:menuItemId', (req, res) => {
  try {
    const recipesFilePath = path.join(__dirname, '../../data/recipes_bom.json');
    const recipesData = JSON.parse(fs.readFileSync(recipesFilePath, 'utf8'));
    
    const menuItemId = req.params.menuItemId;
    const recipe = recipesData.recipes.find(r => r.menu_item_id === menuItemId);
    
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found for this menu item'
      });
    }
    
    res.json({
      success: true,
      data: recipe
    });
  } catch (error) {
    console.error('Error loading recipe:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/recipes/:menuItemId/cost - Calculate cost breakdown for a recipe
 */
router.get('/:menuItemId/cost', (req, res) => {
  try {
    const recipesFilePath = path.join(__dirname, '../../data/recipes_bom.json');
    const recipesData = JSON.parse(fs.readFileSync(recipesFilePath, 'utf8'));
    
    const menuItemId = req.params.menuItemId;
    const recipe = recipesData.recipes.find(r => r.menu_item_id === menuItemId);
    
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found for this menu item'
      });
    }
    
    // Calculate detailed cost breakdown
    const costBreakdown = {
      recipe_name: recipe.recipe_name,
      menu_item_id: recipe.menu_item_id,
      ingredients: recipe.ingredients.map(ing => ({
        catalog_object_id: ing.catalog_object_id,
        quantity: ing.quantity,
        unit: ing.unit,
        cost_per_unit: ing.cost_per_unit,
        total_cost: parseFloat((parseFloat(ing.quantity) * ing.cost_per_unit).toFixed(2))
      })),
      summary: {
        total_ingredient_cost: recipe.total_cost,
        cost_per_serving: recipe.cost_per_serving,
        menu_price: recipe.menu_price,
        profit_per_serving: parseFloat((recipe.menu_price - recipe.cost_per_serving).toFixed(2)),
        profit_margin: recipe.profit_margin,
        yield_servings: recipe.servings
      }
    };
    
    res.json({
      success: true,
      data: costBreakdown
    });
  } catch (error) {
    console.error('Error calculating recipe cost:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
