// Simulated OCR Service - Replace with real OCR API (Google Vision, AWS Textract, etc.)
// Also integrated with Square API for real POS data

const squareService = require('./squareService');

class OCRService {
  /**
   * Extract data from POS Report image OR get from Square API
   */
  async extractPOSData(imageBuffer, filename) {
    // If no image provided, try to get from Square API
    if (!imageBuffer && !filename) {
      console.log('📡 Attempting to fetch POS data from Square API...');
      try {
        const squareData = await squareService.getTodaySales();
        if (squareData && squareData.items && squareData.items.length > 0) {
          console.log('✅ Successfully fetched data from Square API');
          return squareData;
        }
      } catch (error) {
        console.log('⚠️ Could not fetch from Square:', error.message);
        console.log('📝 Falling back to simulated data');
      }
    }

    // Fallback to simulated data or OCR if image provided
    console.log('🔍 Extracting POS data from:', filename || 'simulated data');
    
    // Simulated extraction - replace with real OCR
    await this.delay(2000); // Simulate processing time
    
    return {
      date: new Date().toISOString().split('T')[0],
      totalSales: 2456.78,
      totalTransactions: 127,
      averageTicket: 19.35,
      reportPeriod: 'daily',
      items: [
        { name: 'Grilled Chicken Plate', quantity: 23, unitPrice: 18.99 },
        { name: 'Caesar Salad', quantity: 18, unitPrice: 12.99 },
        { name: 'Pasta Carbonara', quantity: 15, unitPrice: 16.99 },
        { name: 'Burger Deluxe', quantity: 12, unitPrice: 14.99 }
      ]
    };
  }

  /**
   * Extract data from Invoice image
   */
  async extractInvoiceData(imageBuffer, filename) {
    console.log('🔍 Extracting Invoice data from:', filename);
    
    await this.delay(2000);
    
    return {
      vendor: 'ABC Food Supplier',
      date: new Date().toISOString().split('T')[0],
      invoiceNumber: 'INV-' + Math.floor(Math.random() * 10000),
      totalAmount: 1245.00,
      items: [
        { 
          name: 'Chicken Breast', 
          quantity: 50, 
          unitPrice: 8.99,
          totalPrice: 449.50,
          category: 'Meat',
          expiryDate: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]
        },
        { 
          name: 'Lettuce', 
          quantity: 20, 
          unitPrice: 2.99,
          totalPrice: 59.80,
          category: 'Produce',
          expiryDate: new Date(Date.now() + 5*24*60*60*1000).toISOString().split('T')[0]
        },
        { 
          name: 'Tomatoes', 
          quantity: 30, 
          unitPrice: 3.49,
          totalPrice: 104.70,
          category: 'Produce',
          expiryDate: new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]
        }
      ]
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new OCRService();
