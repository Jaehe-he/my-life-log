import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

const theme = localStorage.getItem('ml:theme');
if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;

createRoot(document.getElementById('root')!).render(
  <HashRouter>
    <App />
  </HashRouter>,
);
