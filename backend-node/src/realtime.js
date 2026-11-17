const admin = require('./config/firebaseAdmin');
const pool = require('./config/db');

// Socket.io authentication. Every client must send a Firebase ID token:
//   io(URL, { auth: { token } })
// Doctors and admins join "clinicians" and receive full case details.
// Other staff join "staff" and only get a signal that the queue changed.
const attachSocketAuth = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('unauthorized'));
      const decoded = await admin.auth().verifyIdToken(token);
      const result = await pool.query('SELECT id, role FROM users WHERE firebase_uid = $1', [decoded.uid]);
      if (result.rowCount === 0) return next(new Error('unauthorized'));
      socket.data.role = result.rows[0].role;
      next();
    } catch (err) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const room = ['doctor', 'admin'].includes(socket.data.role) ? 'clinicians' : 'staff';
    socket.join(room);
  });
};

// Patient details only ever go to clinicians
const broadcastQueueUpdate = (io, update) => {
  if (!io) return;
  io.to('clinicians').emit('queue_update', update);
  io.to('staff').emit('queue_update', { type: update.type, id: update.id });
};

module.exports = { attachSocketAuth, broadcastQueueUpdate };
