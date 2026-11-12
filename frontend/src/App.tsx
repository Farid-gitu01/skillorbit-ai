import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/context';
import { AppRoutes } from './routes';

/**
 * App — Root Application Component
 * Mounts AuthProvider (session restoration & cookie auth) and AppRoutes.
 */
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
