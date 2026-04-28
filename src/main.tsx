// main.tsx
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { HashRouter } from 'react-router-dom'; // تم تغيير النوع هنا
import App from './App';
import { AuthProvider } from './hooks/useAuth';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');

const root = createRoot(container);

root.render(
  <StrictMode>
    <HashRouter> {/* تم التغيير من BrowserRouter إلى HashRouter */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </StrictMode>
);