const express = require('express');
const cors = require('cors');
const path = require('path');
// Load .env from backend/ regardless of cwd (works when run from repo root or backend/)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Validate environment variables before starting
require('./config/env');

const app = express();
const PORT = process.env.PORT || 8000;

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Health check (before CORS so Docker healthcheck with no Origin succeeds)
app.get('/api/healthz', (req, res) => {
  res.json({ status: 'OK', message: 'Restaurant Cost Control API is running', timestamp: new Date().toISOString() });
});

// CORS Configuration - Secure by default
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests without Origin (same-origin, Postman, curl, server-to-server)
    if (!origin) return callback(null, true);
    
    // Get allowed origins from environment
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : [
          'http://localhost:8000',
          'http://127.0.0.1:8000',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:8080'
        ];
    
    // In development, allow localhost origins
    if (process.env.NODE_ENV === 'development') {
      allowedOrigins.push(
        'http://localhost:8000',
        'http://127.0.0.1:8000',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:8080'
      );
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
app.use(require('compression')());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// /uploads no longer served as public static; use GET /api/files/download/:fileId with auth

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

// Root route - redirect to app (frontend is also served from this server)
app.get('/', (req, res) => {
  res.redirect('/core/index.html');
});

// Serve frontend (fila) so one server does both — open http://localhost:8000/core/index.html
const filaPath = path.join(__dirname, '../../fila');
app.use(express.static(filaPath, { index: false }));
app.get('/core', (req, res) => res.redirect('/core/index.html'));

// Error handling middleware (must be last)
const { errorHandler } = require('./utils/errorHandler');
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 API Health: http://localhost:${PORT}/api/healthz`);
});
