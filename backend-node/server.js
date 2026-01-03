const express = require('express');
const http = require('http'); // 1. Import HTTP
const { Server } = require('socket.io'); // 2. Import Socket.io
const cors = require('cors');
const dotenv = require('dotenv');

// Routes
const triageRoutes = require('./src/routes/triageRoutes');
const userRoutes = require('./src/routes/userRoutes');

dotenv.config();
const app = express();

// 3. Create HTTP Server & Wrap Express
const server = http.createServer(app);

// 4. Initialize Socket.io with CORS (Critical for Frontend connection)
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Your Frontend URL
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Middleware
app.use(cors());
app.use(express.json()); // Parses JSON
app.use(express.urlencoded({ extended: true })); // 🆕 PARSES USSD FORM DATA

// 5. Attach 'io' to every request so Controllers can use it
app.use((req, res, next) => {
  req.io = io; 
  next();
});

// Routes
app.use('/api/triage', triageRoutes);
app.use('/api/users', userRoutes);

// Socket Connection Logic (Optional: Just for testing connection)
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