import React, { useState, useEffect } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import HandshakeIcon from '@mui/icons-material/Handshake';
import { supabase } from '../supabaseClient';

function SponsorsSection() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPartners = async () => {
      try {
        const { data, error } = await supabase
          .from('partners')
          .select('id, name, type, logo_url')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });
        if (error) throw error;
        setPartners(data || []);
      } catch (err) {
        console.error('Error fetching partners:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPartners();
  }, []);

  if (loading || partners.length === 0) return null;

  const sponsors = partners.filter(p => p.type === 'Sponsor');
  const partnerList = partners.filter(p => p.type === 'Partner');

  const LogoRow = ({ items }) => (
    <Box sx={{
      display: 'flex', flexWrap: 'wrap',
      justifyContent: 'center', alignItems: 'center', gap: { xs: 3, md: 5 },
    }}>
      {items.map((p) => (
        <Tooltip key={p.id} title={p.name} placement="top" arrow>
          <Box
            component="img"
            src={p.logo_url}
            alt={p.name}
            sx={{
              height: { xs: 40, md: 56 },
              maxWidth: { xs: 100, md: 140 },
              objectFit: 'contain',
              filter: 'grayscale(100%)',
              opacity: 0.65,
              transition: 'filter 0.3s, opacity 0.3s, transform 0.3s',
              '&:hover': {
                filter: 'grayscale(0%)',
                opacity: 1,
                transform: 'scale(1.08)',
              },
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );

  const hasBoth = sponsors.length > 0 && partnerList.length > 0;

  return (
    <Box sx={{
      mt: 6, py: 5,
      borderTop: '1px solid', borderColor: 'divider',
      bgcolor: 'background.paper',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 4 }}>
        <HandshakeIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
        <Typography variant="overline" color="text.disabled" fontWeight="bold" letterSpacing={2}>
          Our Partners &amp; Sponsors
        </Typography>
      </Box>

      {hasBoth ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, px: { xs: 2, md: 6 } }}>
          {sponsors.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.disabled" fontWeight="bold"
                sx={{ display: 'block', textAlign: 'center', letterSpacing: 1.5, mb: 2, textTransform: 'uppercase' }}>
                Sponsors
              </Typography>
              <LogoRow items={sponsors} />
            </Box>
          )}
          {partnerList.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.disabled" fontWeight="bold"
                sx={{ display: 'block', textAlign: 'center', letterSpacing: 1.5, mb: 2, textTransform: 'uppercase' }}>
                Partners
              </Typography>
              <LogoRow items={partnerList} />
            </Box>
          )}
        </Box>
      ) : (
        <Box sx={{ px: { xs: 2, md: 6 } }}>
          <LogoRow items={partners} />
        </Box>
      )}
    </Box>
  );
}

export default SponsorsSection;
