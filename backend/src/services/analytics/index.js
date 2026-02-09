/**
 * Analytics submodules (food cost, waste). Facade still lives in analyticsService.js.
 */

const foodCostService = require('./foodCostService');
const wasteAnalysisService = require('./wasteAnalysisService');

module.exports = {
  foodCostService,
  wasteAnalysisService,
  ...foodCostService,
  ...wasteAnalysisService
};
