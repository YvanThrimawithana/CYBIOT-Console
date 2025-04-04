import Dashboard from '../pages/DashBoard';
import DeviceConsole from '../pages/DeviceConsole';
import TrafficLogs from '../pages/TrafficLogs';
import Login from '../pages/Login';
import FirmwareManagement from '../pages/FirmwareManagement';

export const routes = [
    {
        path: '/dashboard',
        component: Dashboard,
        protected: true,
        title: 'Dashboard'
    },
    {
        path: '/devices',
        component: DeviceConsole,
        protected: true,
        title: 'Device Management'
    },
    {
        path: '/traffic/:ip',
        component: TrafficLogs,
        protected: true,
        title: 'Traffic Monitoring'
    },
    {
        path: '/login',
        component: Login,
        protected: false,
        title: 'Login'
    },
    {
        path: '/firmware-management',
        component: FirmwareManagement,
        protected: true,
        title: 'Firmware Management'
    }
];
