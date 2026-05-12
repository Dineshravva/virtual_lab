import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

// Server URL - in dev defaults to localhost:5000.
// Set REACT_APP_SERVER_URL when deploying elsewhere.
const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

// Connects to the server and joins the given room.
// Returns the socket as a state value so children re-render once it's ready
// (this is important because child useEffects run before parent useEffects,
// so a ref-based version would let listeners attach to a null socket).
export default function useSocket(roomName, onNotify) {
  const [socket, setSocket] = useState(null);

  // Mirror onNotify into a ref so the effect only depends on roomName.
  // Without this, a non-stable parent callback would tear down and rebuild
  // the socket on every render.
  const notifyRef = useRef(onNotify);
  useEffect(() => {
    notifyRef.current = onNotify;
  }, [onNotify]);

  useEffect(() => {
    if (!roomName) return undefined;

    let isClosing = false;
    let hasConnected = false;
    let reconnecting = false;
    let connectionErrorNotified = false;

    const s = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000
    });

    const notify = (message, type = 'error') => {
      if (notifyRef.current) notifyRef.current(message, type);
    };

    s.on('connect', () => {
      console.log('[socket] connected as', s.id, '-> joining room', roomName);
      s.emit('join-room', roomName);

      if (hasConnected && reconnecting) {
        notify('Reconnected to the lab room.', 'success');
      }

      hasConnected = true;
      reconnecting = false;
      connectionErrorNotified = false;
    });

    s.on('disconnect', (reason) => {
      console.log('[socket] disconnected', reason);
      reconnecting = !isClosing;

      if (!isClosing) {
        notify('Connection lost. Reconnecting to the lab room...');
      }

      if (!isClosing && reason === 'io server disconnect') {
        s.connect();
      }
    });

    s.on('connect_error', (err) => {
      console.error('[socket] connection error', err);
      if (!connectionErrorNotified) {
        notify('Could not connect to the realtime server.');
      }
      connectionErrorNotified = true;
    });

    s.on('error', (err) => {
      console.error('[socket] server error', err);
      notify('The realtime server reported an error.');
    });

    const onReconnectAttempt = (attempt) => {
      reconnecting = true;
      console.log('[socket] reconnect attempt', attempt);
    };

    const onReconnectFailed = () => {
      notify('Realtime reconnect failed. Please refresh the room.');
    };

    s.io.on('reconnect_attempt', onReconnectAttempt);
    s.io.on('reconnect_failed', onReconnectFailed);

    setSocket(s);

    return () => {
      isClosing = true;
      s.io.off('reconnect_attempt', onReconnectAttempt);
      s.io.off('reconnect_failed', onReconnectFailed);
      s.disconnect();
      setSocket(null);
    };
  }, [roomName]);

  return socket;
}

// Returns 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'.
// Used by the UI to render a small connection-status badge in the toolbar.
export function useSocketStatus(socket) {
  const [status, setStatus] = useState(() => {
    if (!socket) return 'idle';
    if (socket.connected) return 'connected';
    return 'connecting';
  });

  useEffect(() => {
    if (!socket) {
      setStatus('idle');
      return undefined;
    }

    setStatus(socket.connected ? 'connected' : 'connecting');

    const onConnect = () => setStatus('connected');
    const onDisconnect = () => setStatus('reconnecting');
    const onConnectError = () => setStatus('error');
    const onReconnectAttempt = () => setStatus('reconnecting');
    const onReconnectFailed = () => setStatus('error');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect_failed', onReconnectFailed);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect_failed', onReconnectFailed);
    };
  }, [socket]);

  return status;
}
