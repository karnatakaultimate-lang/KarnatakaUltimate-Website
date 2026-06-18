import React, { useState, useEffect } from 'react';
import { Box, Typography, Grid, Card, CardMedia, CardContent, Button, Chip, CircularProgress } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { supabase } from '../supabaseClient';

function Merchandise() {
  const [merch, setMerch] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMerch();
  }, []);

  const fetchMerch = async () => {
    try {
      const { data, error } = await supabase
        .from('merchandise')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMerch(data || []);
    } catch (err) {
      console.error('Error fetching merchandise:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 6, textAlign: 'center', mt: 2 }}>
        <Typography variant="h2" fontWeight="bold" gutterBottom color="primary.main"
          sx={{ fontSize: { xs: '2rem', md: '3.75rem' } }}>
          KUPA Store
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto', lineHeight: 1.6 }}>
          Get official KUPA merchandise. Use your reward points to claim discounts on select items!
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : merch.length === 0 ? (
        <Typography variant="h6" color="text.secondary" align="center" sx={{ py: 5 }}>Store is empty right now.</Typography>
      ) : (
        <Grid container spacing={4}>
          {merch.map((item) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: '0.3s', '&:hover': { transform: 'translateY(-8px)', boxShadow: 6 } }}>
                <Box sx={{ position: 'relative', pt: '100%', bgcolor: 'grey.100' }}>
                  {item.image_url ? (
                    <CardMedia
                      component="img"
                      image={item.image_url}
                      alt={item.name}
                      sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', p: 2 }}
                    />
                  ) : (
                    <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.disabled' }}>
                      <Typography>No Image</Typography>
                    </Box>
                  )}
                  {item.in_stock && (
                    <Chip label="In Stock" color="success" size="small" sx={{ position: 'absolute', top: 16, right: 16, fontWeight: 'bold' }} />
                  )}
                  {!item.in_stock && (
                    <Chip label="Sold Out" color="error" size="small" sx={{ position: 'absolute', top: 16, right: 16, fontWeight: 'bold' }} />
                  )}
                </Box>
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
                  <Typography variant="h5" fontWeight="bold" gutterBottom>
                    {item.name}
                  </Typography>
                  <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 2 }}>
                    <Typography variant="h5" fontWeight="bold" color="primary.main">
                      ₹{item.price}
                    </Typography>
                    <Button variant="contained" disabled={!item.in_stock} startIcon={<ShoppingCartIcon />}>
                      Buy Now
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

export default Merchandise;
