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

// 3. Create HTTP Server & Wrap Express
const server = http.createServer(app);

// 🛡️ SECURITY: Allowed Origins (Local + Production)
const ALLOWED_ORIGINS = [
    "http://localhost:5173",             // Local Frontend (Vite)
    "http://localhost:3000",             // Local Frontend (Alternative)
    "https://afya-pulse.vercel.app",             // Production Vercel App
    "https://afya-pulse-dashboard.vercel.app"    // Production Vercel Alias (if used)
];

// 4. Initialize Socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
  }
});

// Middleware
app.use(cors({
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));

app.use(express.json()); // Parses JSON
app.use(express.urlencoded({ extended: true })); // PARSES USSD FORM DATA

// 5. Attach 'io' to every request so Controllers can use it
app.use((req, res, next) => {
  req.io = io; 
  next();
});

// Health Check (Good for Render Logs)
app.get('/', (req, res) => res.send('Afya-Pulse Backend is Online 🟢'));

// Routes
app.use('/api/triage', triageRoutes);
app.use('/api/users', userRoutes);

// Socket Connection Logic
io.on('connection', (socket) => {
  console.log(`⚡ Client Connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`🔌 Client Disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 4000;

// 6. LISTEN using 'server', not 'app'
server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready for connections`);
});