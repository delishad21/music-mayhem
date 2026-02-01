import express from 'express';
import { rooms } from '../services/socketService';

const router = express.Router();

router.get('/', (req, res) => {
  const activeRooms = Array.from(rooms.values())
    .filter(room => !room.isActive && !room.isPrivate)
    .map(room => ({
      code: room.code,
      gameMode: room.gameMode,
      playerCount: room.players.length,
      hostName: room.players.find(p => p.isHost)?.displayName || room.players.find(p => p.isHost)?.username,
    }));

  res.json({ rooms: activeRooms });
});

router.get('/:code', (req, res) => {
  const code = String(req.params.code || '').toUpperCase();
  const room = rooms.get(code);

  if (!room || room.isActive) {
    return res.status(404).json({ error: 'Room not found' });
  }

  res.json({
    room: {
      code: room.code,
      gameMode: room.gameMode,
      isPrivate: room.isPrivate === true,
      playerCount: room.players.length,
      hostName: room.players.find(p => p.isHost)?.displayName || room.players.find(p => p.isHost)?.username,
    },
  });
});

export default router;
