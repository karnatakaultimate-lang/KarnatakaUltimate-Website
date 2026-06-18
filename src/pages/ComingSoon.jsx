import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import ConstructionIcon from '@mui/icons-material/Construction';
import { useNavigate } from 'react-router-dom';

function ComingSoon() {
  const navigate = useNavigate();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 12, textAlign: 'center' }}>
      <ConstructionIcon sx={{ fontSize: 80, color: 'warning.main', mb: 3 }} />
      <Typography variant="h3" fontWeight="bold" gutterBottom>Coming Soon</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 400 }}>
        This module is currently disabled by the site admin. Check back later!
      </Typography>
      <Button variant="contained" onClick={() => navigate('/')}>Go Home</Button>
    </Box>
  );
}

export default ComingSoon;
