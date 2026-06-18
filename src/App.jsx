import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import theme from './theme';
import { SiteConfigProvider, useSiteConfig } from './contexts/SiteConfigContext';
import { AuthProvider } from './contexts/AuthContext';

import Navigation from './components/Navigation';
import Landing from './pages/Landing';
import Announcements from './pages/Announcements';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import EventDetails from './pages/EventDetails';
import TaskBoard from './pages/TaskBoard';
import Merchandise from './pages/Merchandise';
import AdminPanel from './pages/AdminPanel';
import AnnouncementDetail from './pages/AnnouncementDetail';
import Teams from './pages/Teams';
import TeamDetails from './pages/TeamDetails';
import Grievances from './pages/Grievances';
import GrievanceDetail from './pages/GrievanceDetail';
import ComingSoon from './pages/ComingSoon';

// Renders the element only if the site_config key is not explicitly false.
// Falls back to ComingSoon for disabled modules without a full page redirect.
function ModuleRoute({ configKey, element }) {
  const { config, loading } = useSiteConfig();
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }
  return config[configKey] === false ? <Navigate to="/coming-soon" replace /> : element;
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <SiteConfigProvider>
        <AuthProvider>
          <Router>
            <Navigation>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/announcements/:id" element={<AnnouncementDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/events" element={<Events />} />
                <Route path="/events/:id" element={<EventDetails />} />
                <Route
                  path="/tasks"
                  element={<ModuleRoute configKey="is_taskboard_enabled" element={<TaskBoard />} />}
                />
                <Route
                  path="/merchandise"
                  element={<ModuleRoute configKey="is_store_enabled" element={<Merchandise />} />}
                />
                <Route
                  path="/teams"
                  element={<ModuleRoute configKey="is_teams_enabled" element={<Teams />} />}
                />
                <Route
                  path="/teams/:id"
                  element={<ModuleRoute configKey="is_teams_enabled" element={<TeamDetails />} />}
                />
                <Route path="/grievances" element={<Grievances />} />
                <Route path="/grievances/:id" element={<GrievanceDetail />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/coming-soon" element={<ComingSoon />} />
              </Routes>
            </Navigation>
          </Router>
        </AuthProvider>
      </SiteConfigProvider>
    </ThemeProvider>
  );
}

export default App;
