/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { SocketContext } from './context/SocketContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { Home } from './components/lobby/Home';
import { Room } from './components/lobby/Room';

// --- App ---

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(window.location.origin, { path: '/avalon/socket.io' });
    setSocket(newSocket);
    return () => {
      newSocket.close();
    };
  }, []);

  if (!socket) return null;

  return (
    <SocketContext.Provider value={socket}>
      <ToastProvider>
        <ConfirmProvider>
          <SettingsProvider>
            <Router basename="/avalon">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/room/:code" element={<Room />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </Router>
          </SettingsProvider>
        </ConfirmProvider>
      </ToastProvider>
    </SocketContext.Provider>
  );
}
