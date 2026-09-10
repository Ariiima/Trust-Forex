import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../design-system/tokens.css';
import './admin.css';
import AdminApp from './AdminApp';
import { loadTz } from './data';

// The system clock, before the first table renders a stamp it formatted itself.
void loadTz();

createRoot(document.getElementById('admin-root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
