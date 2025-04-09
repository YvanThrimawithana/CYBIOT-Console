import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { routes } from './routes/routes';
import FirmwareProfile from './pages/FirmwareProfile';

const App = () => {
    const isAuthenticated = localStorage.getItem('token');

    return (
        <BrowserRouter>
            {isAuthenticated && <Navbar />}
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                
                {routes.map(({ path, component: Component, protected: isProtected }) => (
                    <Route
                        key={path}
                        path={path}
                        element={
                            isProtected ? (
                                <ProtectedRoute>
                                    <Component />
                                </ProtectedRoute>
                            ) : (
                                <Component />
                            )
                        }
                    />
                ))}
                
                <Route path="/firmware/:id" element={<FirmwareProfile />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </BrowserRouter>
    );
};

export default App;
