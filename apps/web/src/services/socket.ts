import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  public connect(token?: string): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const socketUrl = window.location.origin;

    this.socket = io(socketUrl, {
      auth: { token: token || localStorage.getItem('token') },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to real-time grid stream');
    });

    this.socket.on('connect_error', err => {
      console.warn('[Socket] Stream connection error:', err.message);
    });

    return this.socket;
  }

  public getSocket(): Socket | null {
    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public subscribeJob(jobId: string): void {
    if (this.socket) {
      this.socket.emit('subscribe:job', jobId);
    }
  }

  public unsubscribeJob(jobId: string): void {
    if (this.socket) {
      this.socket.emit('unsubscribe:job', jobId);
    }
  }
}

export const socketService = new SocketService();
