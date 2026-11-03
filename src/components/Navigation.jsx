import React, { useState } from 'react';
import {
  AppBar, Box, Toolbar, IconButton, Typography, Menu,
  Container, Avatar, Button, Tooltip, MenuItem, Drawer,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import EventIcon from '@mui/icons-material/Event';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CampaignIcon from '@mui/icons-material/Campaign';
import GroupsIcon from '@mui/icons-material/Groups';
import GavelIcon from '@mui/icons-material/Gavel';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useNavigate, useLocation } from 'react-router-dom';
import kupaLogo from '../assets/KUPA.svg';
import { useAuth } from '../contexts/AuthContext';
import { useSiteConfig } from '../contexts/SiteConfigContext';

const ALL_PAGES = [
  { title: 'Calendar', path: '/events', icon: <EventIcon /> },
  { title: 'Teams', path: '/teams', icon: <GroupsIcon />, configKey: 'is_teams_enabled' },
  { title: 'Task Board', path: '/tasks', icon: <TaskAltIcon />, configKey: 'is_taskboard_enabled' },
  { title: 'Announcements', path: '/announcements', icon: <CampaignIcon /> },
];

// Shown in the site footer (sitemap area) instead of the top nav bar
const FOOTER_PAGES = [
  { title: 'Merchandise', path: '/merchandise', icon: <StorefrontIcon />, configKey: 'is_store_enabled' },
  { title: 'Grievances', path: '/grievances', icon: <GavelIcon /> },
];

function Navigation({ children }) {
  const { user, signOut, isAdmin } = useAuth();
  const { config } = useSiteConfig();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorElUser, setAnchorElUser] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  // Hide nav links for modules the admin has disabled
  const pages = ALL_PAGES.filter(p => !p.configKey || config[p.configKey] !== false);
  const footerPages = FOOTER_PAGES.filter(p => !p.configKey || config[p.configKey] !== false);

  const handleDrawerToggle = () => setMobileOpen(prev => !prev);

  const handleNavigate = (path) => {
    navigate(path);
    setMobileOpen(false);
    setAnchorElUser(null);
  };

  const handleOpenUserMenu = (event) => setAnchorElUser(event.currentTarget);
  const handleCloseUserMenu = () => setAnchorElUser(null);

  const handleLogout = async () => {
    setAnchorElUser(null);
    setMobileOpen(false);
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const drawer = (
    <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ my: 2 }} onClick={handleDrawerToggle}>
        <img src={kupaLogo} alt="KUPA Logo" style={{ height: '40px', cursor: 'pointer' }} />
      </Box>
      <List sx={{ flexGrow: 1 }}>
        {pages.map((item) => (
          <ListItem key={item.title} disablePadding>
            <ListItemButton
              sx={{ textAlign: 'left', bgcolor: location.pathname.startsWith(item.path) ? 'action.selected' : 'transparent' }}
              onClick={() => handleNavigate(item.path)}
            >
              <ListItemIcon sx={{ color: location.pathname.startsWith(item.path) ? 'primary.main' : 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.title}
                sx={{ color: location.pathname.startsWith(item.path) ? 'primary.main' : 'inherit', fontWeight: 600 }}
              />
            </ListItemButton>
          </ListItem>
        ))}

        {/* Footer links in mobile drawer */}
        {footerPages.length > 0 && (
          <>
            <Divider sx={{ mx: 2 }} />
            {footerPages.map((item) => (
              <ListItem key={item.title} disablePadding>
                <ListItemButton
                  sx={{ textAlign: 'left', bgcolor: location.pathname.startsWith(item.path) ? 'action.selected' : 'transparent' }}
                  onClick={() => handleNavigate(item.path)}
                >
                  <ListItemIcon sx={{ color: location.pathname.startsWith(item.path) ? 'primary.main' : 'text.secondary' }}>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.title}
                    sx={{ color: location.pathname.startsWith(item.path) ? 'primary.main' : 'text.secondary' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </>
        )}

        <Divider sx={{ my: 2 }} />

        {user ? (
          <>
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleNavigate('/dashboard')}>
                <ListItemIcon><DashboardIcon color="primary" /></ListItemIcon>
                <ListItemText primary="Dashboard" sx={{ fontWeight: 'bold' }} />
              </ListItemButton>
            </ListItem>
            {isAdmin && (
              <ListItem disablePadding>
                <ListItemButton onClick={() => handleNavigate('/admin')}>
                  <ListItemIcon><AdminPanelSettingsIcon color="warning" /></ListItemIcon>
                  <ListItemText primary="Admin Panel" sx={{ color: 'warning.dark', fontWeight: 'bold' }} />
                </ListItemButton>
              </ListItem>
            )}
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout}>
                <ListItemIcon><LogoutIcon color="error" /></ListItemIcon>
                <ListItemText primary="Logout" sx={{ color: 'error.main', fontWeight: 'bold' }} />
              </ListItemButton>
            </ListItem>
          </>
        ) : (
          <ListItem disablePadding sx={{ mt: 2, px: 2 }}>
            <Button
              variant="contained"
              fullWidth
              onClick={() => handleNavigate('/login')}
              sx={{ fontWeight: 'bold' }}
            >
              Login
            </Button>
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky" sx={{ bgcolor: 'white', color: 'text.primary', boxShadow: 1 }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters>
            {/* Desktop Logo */}
            <Box
              sx={{ mr: 4, display: { xs: 'none', md: 'flex' }, cursor: 'pointer' }}
              onClick={() => handleNavigate('/')}
            >
              <img src={kupaLogo} alt="KUPA Logo" style={{ height: '40px' }} />
            </Box>

            {/* Mobile: Hamburger | Logo (truly centred) | Spacer */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, width: '100%', alignItems: 'center' }}>
              <IconButton size="large" onClick={handleDrawerToggle} color="inherit" sx={{ flexShrink: 0 }}>
                <MenuIcon />
              </IconButton>

              {/* Logo grows to fill remaining space and centres itself */}
              <Box
                sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', cursor: 'pointer' }}
                onClick={() => handleNavigate('/')}
              >
                <img src={kupaLogo} alt="KUPA Logo" style={{ height: '36px' }} />
              </Box>

              {/* Right-side spacer = same width as the hamburger so logo stays centred */}
              <Box sx={{ width: 48, flexShrink: 0 }} />
            </Box>

            {/* Desktop Navigation Links */}
            <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' }, justifyContent: 'flex-end', alignItems: 'center', mr: 2 }}>
              {pages.map((page) => (
                <Button
                  key={page.title}
                  onClick={() => handleNavigate(page.path)}
                  sx={{
                    my: 2,
                    color: location.pathname.startsWith(page.path) ? 'primary.main' : 'text.secondary',
                    display: 'block',
                    fontWeight: 600,
                    mx: 1,
                    textTransform: 'none',
                    fontSize: '1rem',
                  }}
                >
                  {page.title}
                </Button>
              ))}

              {user ? (
                <Box sx={{ flexGrow: 0, ml: 2 }}>
                  <Tooltip title="Open settings">
                    <Button
                      onClick={handleOpenUserMenu}
                      variant="contained"
                      sx={{ fontWeight: 'bold', textTransform: 'none', borderRadius: 2, px: 3 }}
                      endIcon={<AccountCircleIcon />}
                    >
                      myKUPA
                    </Button>
                  </Tooltip>
                  <Menu
                    sx={{ mt: '45px' }}
                    anchorEl={anchorElUser}
                    anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                    keepMounted
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    open={Boolean(anchorElUser)}
                    onClose={handleCloseUserMenu}
                  >
                    <MenuItem onClick={() => handleNavigate('/dashboard')}>
                      <ListItemIcon><DashboardIcon fontSize="small" color="primary" /></ListItemIcon>
                      <Typography fontWeight="bold">Dashboard</Typography>
                    </MenuItem>
                    {isAdmin && [
                      <Divider key="admin-divider" />,
                      <MenuItem key="admin-link" onClick={() => handleNavigate('/admin')}>
                        <ListItemIcon><AdminPanelSettingsIcon fontSize="small" color="warning" /></ListItemIcon>
                        <Typography fontWeight="bold" color="warning.dark">Admin Panel</Typography>
                      </MenuItem>,
                    ]}
                    <Divider />
                    <MenuItem onClick={handleLogout}>
                      <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                      <Typography color="error.main" fontWeight="bold">Logout</Typography>
                    </MenuItem>
                  </Menu>
                </Box>
              ) : (
                <Button
                  variant="contained"
                  onClick={() => handleNavigate('/login')}
                  sx={{ ml: 2, fontWeight: 'bold', textTransform: 'none', borderRadius: 2, px: 3 }}
                >
                  Login
                </Button>
              )}
            </Box>
          </Toolbar>
        </Container>
      </AppBar>

      <nav>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 280 },
          }}
        >
          {drawer}
        </Drawer>
      </nav>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 3, md: 4 }, bgcolor: 'background.default' }}>
        <Container maxWidth="xl" sx={{ height: '100%' }}>
          {children}
        </Container>
      </Box>

      {/* Site footer — sitemap links */}
      <Box
        component="footer"
        sx={{
          borderTop: '1px solid', borderColor: 'divider',
          bgcolor: 'background.paper',
          py: 2, px: { xs: 2, md: 4 },
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: 2,
        }}
      >
        <Typography variant="caption" color="text.disabled">
          © {new Date().getFullYear()} KUPA. All rights reserved.
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {footerPages.map((p) => (
            <Button
              key={p.title}
              size="small"
              onClick={() => handleNavigate(p.path)}
              startIcon={p.icon}
              sx={{
                color: location.pathname.startsWith(p.path) ? 'primary.main' : 'text.secondary',
                textTransform: 'none', fontSize: '0.8rem', fontWeight: 500,
              }}
            >
              {p.title}
            </Button>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

export default Navigation;
