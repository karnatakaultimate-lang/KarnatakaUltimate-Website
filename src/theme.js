import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#d32f2f', // Classic Red
    },
    secondary: {
      main: '#212121', // Dark Gray
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 },
    h2: { fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.25 },
    h3: { fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.3 },
    h4: { fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.35 },
    h5: { fontWeight: 600, lineHeight: 1.4 },
    h6: { fontWeight: 600, lineHeight: 1.4 },
    body1: { lineHeight: 1.65 },
    body2: { lineHeight: 1.6 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
  },
});

export default theme;
