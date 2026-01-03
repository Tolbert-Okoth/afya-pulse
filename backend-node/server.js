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

// 1. Create HTTP Server
const server = http.createServer(app);

// 🛡️ SECURITY: Allowed Origins
const ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://afya-pulse.vercel.app",
    "https://afya-pulse-dashboard.vercel.app"
];

// 2. Initialize Socket.io with enhanced Production settings
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true
  },
  // Adding transport settings helps with Render "Transport Error" disconnects
  transports: ['websocket', 'polling'] 
});

// 3. Middleware
app.use(cors({
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

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

// Health Check
app.get('/', (req, res) => res.status(200).send('Afya-Pulse Backend is Online 🟢'));

// 4. Routes
app.use('/api/triage', triageRoutes);
app.use('/api/users', userRoutes);

// 5. Global Error Handler (Crucial for debugging 403/500 errors on Render)
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