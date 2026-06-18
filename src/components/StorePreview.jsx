import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Button, Grid, CircularProgress, CardMedia, Chip } from '@mui/material';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function StorePreview() {
  const navigate = useNavigate();
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
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      setMerch(data || []);
    } catch (err) {
      console.error('Error fetching merchandise:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 3 }}>
      <Box sx={{ p: 3, bgcolor: 'secondary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight="bold">Latest Merch</Typography>
        <Button variant="contained" color="primary" size="small" onClick={() => navigate('/merchandise')}>
          Go to Store
        </Button>
      </Box>
      <CardContent sx={{ flexGrow: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        ) : merch.length === 0 ? (
          <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>Store is empty right now.</Typography>
        ) : (
          <Grid container spacing={2}>
            {merch.map((item) => (
              <Grid size={{ xs: 12, sm: 4 }} key={item.id}>
                <Box sx={{ textAlign: 'center', p: 1, '&:hover': { bgcolor: 'grey.50', borderRadius: 2 } }}>
                  <Box sx={{ width: '100%', pt: '100%', position: 'relative', bgcolor: 'grey.100', borderRadius: 2, mb: 1, overflow: 'hidden' }}>
                    {item.image_url ? (
                      <CardMedia
                        component="img"
                        image={item.image_url}
                        alt={item.name}
                        sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', p: 1 }}
                      />
                    ) : (
                      <ShoppingBagIcon sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 40, color: 'text.disabled' }} />
                    )}
                    {!item.in_stock && (
                      <Chip label="Sold Out" color="error" size="small" sx={{ position: 'absolute', top: 8, right: 8, fontSize: '0.6rem', height: 20 }} />
                    )}
                  </Box>
                  <Typography variant="subtitle2" fontWeight="bold" noWrap>
                    {item.name}
                  </Typography>
                  <Typography variant="body2" color="primary.main" fontWeight="bold">
                    ₹{item.price}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        )}
      </CardContent>
    </Card>
  );
}

export default StorePreview;
