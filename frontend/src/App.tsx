import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';

/**
 * App — Root Application Component
 * Mounts the React Router foundation established in Phase 2.0.5.
 */
export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
