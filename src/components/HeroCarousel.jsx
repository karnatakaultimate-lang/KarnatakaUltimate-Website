import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { supabase } from '../supabaseClient';

function HeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSlides();
  }, []);

  const fetchSlides = async () => {
    try {
      const { data, error } = await supabase
        .from('carousel_slides')
        .select('id, title, description, image_url, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching carousel slides:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [items.length]);

  const handleNext = () => setActiveIndex((prev) => (prev + 1) % items.length);
  const handlePrev = () => setActiveIndex((prev) => (prev - 1 + items.length) % items.length);

  if (loading) {
    return (
      <Box sx={{
        width: '100%', height: { xs: '240px', sm: '360px', md: '500px' }, mb: { xs: 2, md: 4 }, borderRadius: 2,
        bgcolor: 'grey.200', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (items.length === 0) return null;

  return (
    <Box sx={{
      position: 'relative',
      width: '100%',
      height: { xs: '240px', sm: '360px', md: '500px' },
      mb: { xs: 2, md: 4 },
      borderRadius: 2,
      overflow: 'hidden',
      boxShadow: 3,
    }}>
      {items.map((item, i) => (
        <Box
          key={item.id}
          sx={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            opacity: i === activeIndex ? 1 : 0,
            transition: 'opacity 0.8s ease-in-out',
            backgroundImage: `url(${item.image_url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'flex-start',
            color: 'white',
            textAlign: 'left',
            zIndex: i === activeIndex ? 1 : 0,
            // Gradient only at the bottom so the image stays clear at the top
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              background: (item.title || item.description)
                ? 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.8) 100%)'
                : 'none',
            },
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 2, p: { xs: 1.5, md: 4 }, pb: { xs: 2, md: 3 } }}>
            {item.title && (
              <Typography fontWeight="bold" gutterBottom sx={{
                fontSize: { xs: '0.95rem', sm: '1.4rem', md: '2.25rem' },
                textShadow: '1px 1px 6px rgba(0,0,0,0.7)',
                lineHeight: 1.25,
              }}>
                {item.title}
              </Typography>
            )}
            {item.description && (
              <Typography fontWeight={400} sx={{
                fontSize: { xs: '0.75rem', sm: '1rem', md: '1.15rem' },
                textShadow: '1px 1px 4px rgba(0,0,0,0.6)',
                opacity: 0.92,
                display: { xs: 'none', sm: 'block' },
              }}>
                {item.description}
              </Typography>
            )}
          </Box>
        </Box>
      ))}

      {/* Navigation arrows — only shown when more than 1 slide */}
      {items.length > 1 && (
        <>
          <IconButton
            onClick={handlePrev}
            sx={{
              position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
              color: 'white', bgcolor: 'rgba(0,0,0,0.3)', zIndex: 3,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
            }}
          >
            <ArrowBackIosNewIcon />
          </IconButton>

          <IconButton
            onClick={handleNext}
            sx={{
              position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
              color: 'white', bgcolor: 'rgba(0,0,0,0.3)', zIndex: 3,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
            }}
          >
            <ArrowForwardIosIcon />
          </IconButton>

          {/* Dot indicators */}
          <Box sx={{
            position: 'absolute', bottom: 16, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', gap: 1, zIndex: 3,
          }}>
            {items.map((_, i) => (
              <Box
                key={i}
                onClick={() => setActiveIndex(i)}
                sx={{
                  width: 12, height: 12, borderRadius: '50%',
                  bgcolor: i === activeIndex ? 'white' : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer', transition: 'background-color 0.3s',
                }}
              />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}

export default HeroCarousel;
