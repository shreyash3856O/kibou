import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io('/', {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      // console.log('Socket connected:', socket.id);
    });

    socket.on('disconnect', () => {
      // console.log('Socket disconnected');
    });
  }
  return socket;
}
