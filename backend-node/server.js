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
// This function handles both standard domains and dynamic Vercel branch/preview URLs
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
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
    allowedHeaders: ["Content-Type", "Authorization"]
};

// Apply CORS to Express
app.use(cors(corsOptions));

// 2. Initialize Socket.io with the SAME CORS settings
const io = new Server(server, {
    cors: corsOptions, // Shared configuration fixes the handshake error
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

// Attach 'io' to every request so controllers can emit events
app.use((req, res, next) => {
    req.io = io; 
    next();
});

// Health Check
app.get('/', (req, res) => res.status(200).send('Afya-Pulse Backend is Online 🟢'));

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

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});