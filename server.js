// server.js (Backend)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } }); // Allow frontend connections

const activeUsers = {}; // In-memory store for anonymity (no DB)

io.on('connection', (socket) => {
  const userId = uuidv4();
  socket.emit('userId', userId); // Send temp ID to client

  socket.on('join', (data) => { // Data: { type: 'Buyer/Seller', lat, lng, delivers?, price, name, img }
    if (Object.values(activeUsers).some(u => u.name === data.name)) {
      socket.emit('nameTaken');
      return;
    }
    activeUsers[userId] = { ...data, id: userId, socketId: socket.id };
    io.emit('userUpdate', Object.values(activeUsers)); // Broadcast all active users (clients filter locally)
    socket.emit('joinSuccess');
  });

  socket.on('updateLocation', (location) => {
    if (activeUsers[userId]) {
      activeUsers[userId] = { ...activeUsers[userId], ...location };
      io.emit('userUpdate', Object.values(activeUsers));
    }
  });

  socket.on('startChat', (targetId) => { // Initiate P2P chat signaling
    const targetSocket = activeUsers[targetId]?.socketId;
    if (targetSocket) {
      io.to(targetSocket).emit('chatRequest', { from: userId });
    }
  });

  socket.on('chatMessage', ({ to, message }) => {
    const targetSocket = activeUsers[to]?.socketId;
    if (targetSocket) {
      io.to(targetSocket).emit('chatMessage', { from: userId, message });
    }
  });

  socket.on('disconnectUser', () => {
    delete activeUsers[userId];
    io.emit('userUpdate', Object.values(activeUsers));
  });

  socket.on('disconnect', () => {
    delete activeUsers[userId];
    io.emit('userUpdate', Object.values(activeUsers));
  });
});

// Serve static files (frontend)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(4000, () => console.log('Server running on port 4000'));
