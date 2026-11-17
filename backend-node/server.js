const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
// Load .env before any module reads process.env
dotenv.config();
const helmet = require('helmet');

// Routes
const triageRoutes = require('./src/routes/triageRoutes');
const userRoutes = require('./src/routes/userRoutes');

const { attachSocketAuth } = require('./src/realtime');
const app = express();
app.set('trust proxy', 1);
app.use(helmet());

const server = http.createServer(app);

// SECURITY: exact allow-list of browser origins. Add more with ALLOWED_ORIGINS (comma-separated).
const ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://afya-pulse.vercel.app",
    "https://afya-pulse-dashboard.vercel.app",
    ...(process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
];

const corsOptions = {
    origin: function (origin, callback) {
        // Requests without an Origin header (server-to-server, USSD callbacks) are allowed;
        // they carry no browser credentials.
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        console.warn(`CORS blocked for origin: ${origin}`);
        const err = new Error('Not allowed by CORS');
        err.status = 403;
        callback(err);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
};

// Apply CORS to Express
app.use(cors(corsOptions));

// 2. Initialize Socket.io with Shared CORS
const io = new Server(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling']
});
attachSocketAuth(io);

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

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
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error("Backend error:", err.message);
    const status = err.status || 500;
    res.status(status).json({ error: status < 500 ? err.message : "Internal Server Error" });
});

// Port Management for Render
const PORT = process.env.PORT || 4000;

server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Afya-Pulse Gateway running on port ${PORT}`);
});