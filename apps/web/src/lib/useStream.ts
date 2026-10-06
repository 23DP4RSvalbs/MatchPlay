import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
export function usePublicStream() {
  const client = useQueryClient();
  useEffect(() => {
    let stopped = false;
    let socket: WebSocket;
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ['venues'] });
      void client.invalidateQueries({ queryKey: ['matches'] });
    };
    const connect = () => {
      socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/events`,
      );
      socket.onopen = () => {
        attempt = 0;
        refresh();
      };
      socket.onmessage = refresh;
      socket.onclose = () => {
        if (!stopped) timer = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 15000));
      };
      socket.onerror = () => socket.close();
    };
    timer = setTimeout(connect, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [client]);
}
export function useStream(id: string, enabled: boolean) {
  const client = useQueryClient();
  const [state, setState] = useState('Connecting');
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let socket: WebSocket;
    let timer: ReturnType<typeof setTimeout>;
    let attempt = 0;
    const connect = () => {
      socket = new WebSocket(
        `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/matches/${id}/stream`,
      );
      socket.onopen = () => {
        attempt = 0;
        setState('Live updates');
        void client.invalidateQueries({ queryKey: ['match', id] });
      };
      socket.onmessage = () => {
        void client.invalidateQueries({ queryKey: ['match', id] });
        void client.invalidateQueries({ queryKey: ['matches'] });
      };
      socket.onclose = (event) => {
        if (stopped) return;
        if (event.code === 1008) {
          setState('Access changed');
          void client.invalidateQueries({ queryKey: ['match', id] });
          return;
        }
        setState('Reconnecting');
        timer = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 15000));
      };
      socket.onerror = () => socket.close();
    };
    timer = setTimeout(connect, 0);
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
    };
  }, [id, enabled, client]);
  return enabled ? state : 'Join a team for live updates';
}
