import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { version, validate } from 'uuid';

const ACTIONS = {
  JOIN: 'join',
  LEAVE: 'leave',
  SHARE_ROOMS: 'share-rooms',
  REMOVE_PEER: 'remove-peer',
  ADD_PEER: 'add-peer',
  RELAY_SDP: 'relay-sdp',
  RELAY_ICE: 'relay-ice',
  ICE_CANDIDATE: 'ice-candidate',
  SESSION_DESCRIPTION: 'session-description'
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useWebSocketAdapter(new IoAdapter(app));

  const server = app.getHttpServer();
  const socketIo = require('socket.io')(server);

  function getClientRooms() {
    const { rooms } = socketIo.sockets.adapter;
  
    return Array.from(rooms.keys()).filter((roomId: any) => validate(roomId) && version(roomId) === 4);
  }  

  function shareRoomsInfo() {
    socketIo.emit(ACTIONS.SHARE_ROOMS, {
      rooms: getClientRooms()
    });
  }

  socketIo.on('connection', socket => {
    shareRoomsInfo();
    console.log('socket connected');

    socket.on(ACTIONS.JOIN, config => {
      const { room: roomId } = config;
      const { rooms: joinedRooms } = socket;

      if (Array.from(joinedRooms).includes(roomId)) {
        socket.emit(ACTIONS.ADD_PEER, {
          peerId: socket.id,
          createOffer: true
        });

        console.warn('Already connected');
        return;
      }

      const clients = Array.from(socketIo.sockets.adapter.rooms.get(roomId) || []);

      clients.forEach(clientId => {
        socketIo.to(clientId).emit(ACTIONS.ADD_PEER, {
          peerId: socket.id,
          createOffer: false
        });

        socket.emit(ACTIONS.ADD_PEER, {
          peerId: clientId,
          createOffer: true
        });
      });

      socket.join(roomId);
      shareRoomsInfo();
    });

    function leaveRoom() {
      const { rooms } = socket;

      Array.from(rooms)
        .forEach(roomId => {
          const clients = Array.from(socketIo.sockets.adapter.rooms.get(roomId) || [])
          
          clients.forEach(clientId => {
            socketIo.to(clientId).emit(ACTIONS.REMOVE_PEER, {
              peerId: socket.id,
            });
          
            socket.emit(ACTIONS.REMOVE_PEER, {
              peerId: clientId,
            });
          });

          socket.leave(roomId);
        });
      shareRoomsInfo();
    }

    socket.on(ACTIONS.LEAVE, leaveRoom);
    socket.on('disconnecting', leaveRoom);

    socket.on(ACTIONS.RELAY_SDP, ({ peerId, sessionDescription }) => {
      socketIo.to(peerId).emit(ACTIONS.SESSION_DESCRIPTION, {
        peerId: socket.id,
        sessionDescription,
      });
    });

    socket.on(ACTIONS.RELAY_ICE, ({ peerId, iceCandidate }) => {
      socketIo.to(peerId).emit(ACTIONS.ICE_CANDIDATE, {
        peerId: socket.id,
        iceCandidate,
      });
    });
  });

  await app.listen(3000);
}

bootstrap();
