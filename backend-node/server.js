const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');

// Routes
const triageRoutes = require('./src/routes/triageRoutes');
const userRoutes = require('./src/routes/userRoutes');

dotenv.config();
const app = express();

const server = http.createServer(app);

// 🛡️ SECURITY: Allowed Origins
const ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://afya-pulse.vercel.app",
    "https://afya-pulse-dashboard.vercel.app"
];

// 1. UNIFIED CORS CONFIGURATION
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        const isAllowed = ALLOWED_ORIGINS.indexOf(origin) !== -1;
        const isVercel = origin.includes('vercel.app');

        if (isAllowed || isVercel) {
            callback(null, true);
        } else {
            console.warn(`🚫 CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Service-Key"]
};

// Apply CORS to Express
app.use(cors(corsOptions));

// 2. Initialize Socket.io with Shared CORS
const io = new Server(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
    allowEIO3: true 
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// FIX: Prevent double slashes and trailing slash issues
app.use((req, res, next) => {
    req.url = req.url.replace(/\/+/g, '/');
    next();
});

// Attach 'io' to every request
app.use((req, res, next) => {
    req.io = io; 
    next();
});

// 🏥 HEALTH CHECK ENDPOINT
// Resolves the 404 error in UptimeRobot
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'Afya-Pulse Backend is Online 🟢', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Root route fallback
app.get('/', (req, res) => res.status(200).send('Afya-Pulse Gateway Active'));

// 4. Routes
app.use('/api/triage', triageRoutes);
app.use('/api/users', userRoutes);

// 5. Global Error Handler
app.use((err, req, res, next) => {
    console.error("❌ Backend Error:", err.stack);
    res.status(err.status || 500).json({
        error: err.message || "Internal Server Error"
    });
});

// Socket Connection Logic
io.on('connection', (socket) => {
    console.log(`⚡ Client Connected: ${socket.id}`);
    
    socket.on('disconnect', () => {
        console.log(`🔌 Client Disconnected`);
    });
});

// Port Management for Render
const PORT = process.env.PORT || 4000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Afya-Pulse Gateway running on port ${PORT}`);
});