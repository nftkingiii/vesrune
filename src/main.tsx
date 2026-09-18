import React from 'react';
import ReactDOM from 'react-dom/client';
import { PollarProvider } from '@pollar/react';
import '@pollar/react/styles.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import App from './App';
import Landing from './Landing';
import './styles.css';
import './probe.css';
const pollarApiKey = import.meta.env.VITE_POLLAR_API_KEY?.trim();
function Root() {
  const [hash, setHash] = React.useState(location.hash);
  React.useEffect(() => { const update = () => setHash(location.hash); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  const inApp = ['overview', 'earn', 'work', 'routes', 'activity', 'rules', 'settings'].includes(hash.slice(1).toLowerCase());
  if (!inApp) return <Landing />;
  return pollarApiKey ? <PollarProvider client={{ apiKey: pollarApiKey, stellarNetwork: 'testnet' }}><App /></PollarProvider> : <App />;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Root /></React.StrictMode>);
