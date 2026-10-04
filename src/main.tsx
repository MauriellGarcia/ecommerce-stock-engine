import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './components/Toast';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* BrowserRouter: habilita el routing en toda la app */}
    <BrowserRouter>
      {/* AuthProvider: gestiona la sesión de Supabase Auth */}
      <AuthProvider>
        {/* CartProvider: estado global del carrito (requiere AuthProvider) */}
        <CartProvider>
          {/* ToastProvider: sistema de notificaciones via portal */}
          <ToastProvider>
            <App />
          </ToastProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
