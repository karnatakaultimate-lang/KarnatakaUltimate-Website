import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Divider, Chip, CircularProgress } from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ImageIcon from '@mui/icons-material/Image';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function Announcements() {
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
        .order('date', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err) {
      console.error('Error fetching announcements:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) =>
    new Date(isoString).toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <Box>
      <Box sx={{ mb: 6, textAlign: 'center', mt: 2 }}>
        <Typography variant="h2" fontWeight="bold" gutterBottom
          sx={{ fontSize: { xs: '2rem', md: '3.75rem' } }}>
          Notice Board
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 700, mx: 'auto', lineHeight: 1.6 }}>
          Stay up to date with the latest news, policy changes, and important updates from KUPA.
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : announcements.length === 0 ? (
        <Typography variant="h6" color="text.secondary" align="center" sx={{ py: 5 }}>
          No announcements at this time.
        </Typography>
      ) : (
        <Card sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 0 }}>
            {announcements.map((announcement, index) => (
              <Box key={announcement.id}>
                <Box
                  onClick={() => navigate(`/announcements/${announcement.id}`)}
                  sx={{
                    p: 4,
                    display: 'flex',
                    gap: 3,
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    transition: '0.15s',
                    '&:hover': { bgcolor: 'grey.50' },
                    '&:hover .chevron': { opacity: 1, transform: 'translateX(0)' },
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: 'grey.100',
                      color: 'primary.main',
                      p: 1.5,
                      borderRadius: '50%',
                      display: { xs: 'none', sm: 'flex' },
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      mt: 0.5,
                    }}
                  >
                    <CampaignIcon />
                  </Box>

                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                      <Typography variant="h5" fontWeight="bold">
                        {announcement.title}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {announcement.image_url && (
                          <Chip
                            icon={<ImageIcon sx={{ fontSize: '14px !important' }} />}
                            label="Photo"
                            size="small"
                            variant="outlined"
                            color="info"
                          />
                        )}
                        <Chip label={formatDate(announcement.date)} size="small" variant="outlined" />
                      </Box>
                    </Box>
                    <Typography
                      variant="body1"
                      color="text.secondary"
                      sx={{
                        lineHeight: 1.8,
                        fontSize: '1.05rem',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {announcement.description}
                    </Typography>
                  </Box>

                  {/* Animated chevron */}
                  <Box
                    className="chevron"
                    sx={{
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      color: 'primary.main',
                      opacity: 0,
                      transform: 'translateX(-4px)',
                      transition: 'opacity 0.15s, transform 0.15s',
                      alignSelf: 'center',
                    }}
                  >
                    <ChevronRightIcon />
                  </Box>
                </Box>
                {index < announcements.length - 1 && <Divider />}
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default Announcements;
