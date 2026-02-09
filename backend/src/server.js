const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Validate environment variables before starting
require('./config/env');

const app = express();
const PORT = process.env.PORT || 8000;

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// CORS Configuration - Secure by default
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }
    
    // Get allowed origins from environment
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000'];
    
    // In development, allow localhost origins
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push('http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:3000');
    }
    
    // Check if origin is allowed
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request timeout middleware
const timeoutMiddleware = require('./middleware/timeout');
app.use(timeoutMiddleware);

// Security middleware
const { securityHeaders, sanitizeInput, validateRequestSize, auditLog } = require('./middleware/security');
app.use(securityHeaders);
app.use(sanitizeInput);
app.use(validateRequestSize);
app.use(auditLog);

// Routes
const posRoutes = require('./routes/posRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const wasteRoutes = require('./routes/wasteRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const squareRoutes = require('./routes/squareRoutes');
const seedRoutes = require('./routes/seedRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const recipesRoutes = require('./routes/recipesRoutes');
const authRoutes = require('./routes/authRoutes');
const todoRoutes = require('./routes/todoRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const contactRoutes = require('./routes/contactRoutes');
const chatRoutes = require('./routes/chatRoutes');
const emailRoutes = require('./routes/emailRoutes');
const kanbanRoutes = require('./routes/kanbanRoutes');
const fileManagerRoutes = require('./routes/fileManagerRoutes');
const ecommerceRoutes = require('./routes/ecommerceRoutes');
const crmRoutes = require('./routes/crmRoutes');
const projectManagementRoutes = require('./routes/projectManagementRoutes');
const lmsRoutes = require('./routes/lmsRoutes');
const helpdeskRoutes = require('./routes/helpdeskRoutes');
const hrRoutes = require('./routes/hrRoutes');
const eventsRoutes = require('./routes/eventsRoutes');
const socialRoutes = require('./routes/socialRoutes');
const userRoutes = require('./routes/userRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const hospitalRoutes = require('./routes/hospitalRoutes');
const performanceRoutes = require('./routes/performanceRoutes');

// Metrics middleware (before routes)
const { metricsMiddleware } = require('./middleware/metrics');
app.use(metricsMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/hospital', hospitalRoutes);
app.use('/api/waste', wasteRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/square', squareRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/recipes', recipesRoutes);
app.use('/api/todos', todoRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/kanban', kanbanRoutes);
app.use('/api/files', fileManagerRoutes);
app.use('/api/ecommerce', ecommerceRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/projects', projectManagementRoutes);
app.use('/api/lms', lmsRoutes);
app.use('/api/helpdesk', helpdeskRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/performance', performanceRoutes);

// Root route - API information
app.get('/', (req, res) => {
  res.json({
    message: 'Restaurant Cost Control Platform API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/healthz',
      auth: '/api/auth',
      api: '/api/*'
    },
    note: 'This is the backend API server. Frontend should be accessed via the frontend server (port 3000) or open HTML files directly.'
  });
});

// Health check
const db = require('./config/database');
app.get('/api/healthz', async (req, res) => {
  const detailed = req.query.detailed === '1' || req.query.detailed === 'true';
  const base = { status: 'OK', message: 'Restaurant Cost Control API is running', timestamp: new Date().toISOString() };
  if (!detailed) {
    return res.json(base);
  }
  let database = 'unknown';
  try {
    await db.getAsync('SELECT 1');
    database = 'connected';
  } catch (e) {
    database = 'error';
    base.status = 'degraded';
  }
  const health = {
    ...base,
    database,
    uptimeSeconds: Math.floor(process.uptime()),
    memory: process.memoryUsage()
  };
  res.json(health);
});

// Error handling middleware (must be last)
const { errorHandler } = require('./utils/errorHandler');
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API Health: http://localhost:${PORT}/api/healthz`);
});
