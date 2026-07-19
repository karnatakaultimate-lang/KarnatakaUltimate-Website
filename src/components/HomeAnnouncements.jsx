import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Button, Divider, CircularProgress } from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function HomeAnnouncements() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('date', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 3 }}>
      <Box sx={{ p: 3, bgcolor: 'grey.100', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight="bold">Notice Board</Typography>
        <Button variant="outlined" size="small" onClick={() => navigate('/announcements')}>
          View All
        </Button>
      </Box>
      <CardContent sx={{ flexGrow: 1 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        ) : announcements.length === 0 ? (
          <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>No announcements at this time.</Typography>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {announcements.map((announcement, index) => (
              <React.Fragment key={announcement.id}>
                <Box
                  component="li"
                  onClick={() => navigate(`/announcements/${announcement.id}`)}
                  sx={{ py: 2, display: 'flex', alignItems: 'flex-start', cursor: 'pointer' }}
                >
                  <CampaignIcon color="primary" sx={{ mr: 2, mt: 0.5, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
                      {announcement.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                      {announcement.description}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block', fontWeight: 'bold' }}>
                      {formatDate(announcement.date)}
                    </Typography>
                  </Box>
                </Box>
                {index < announcements.length - 1 && <Divider component="li" />}
              </React.Fragment>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default HomeAnnouncements;
