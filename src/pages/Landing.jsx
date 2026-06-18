import React from 'react';
import { Box, Grid } from '@mui/material';
import HeroCarousel from '../components/HeroCarousel';
import HomeCalendar from '../components/HomeCalendar';
import HomeAnnouncements from '../components/HomeAnnouncements';
import HomeTaskBoard from '../components/HomeTaskBoard';
import StorePreview from '../components/StorePreview';
import SponsorsSection from '../components/SponsorsSection';

function Landing() {
  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>
      <HeroCarousel />

      <Box sx={{ px: { xs: 1.5, md: 4 }, py: { xs: 2, md: 4 } }}>
        {/* Three-panel row: Notice Board → Calendar → Task Board */}
        <Grid container spacing={{ xs: 2, md: 4 }} alignItems="stretch">
          <Grid size={{ xs: 12, md: 4 }}>
            <HomeAnnouncements />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <HomeCalendar />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <HomeTaskBoard />
          </Grid>
        </Grid>

        {/* Store preview — spaced below the panel row */}
        <Box sx={{ mt: { xs: 2, md: 4 } }}>
          <StorePreview />
        </Box>
      </Box>

      <SponsorsSection />
    </Box>
  );
}

export default Landing;
