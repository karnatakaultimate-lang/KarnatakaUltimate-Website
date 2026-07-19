import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Button,
  Divider, CircularProgress, Tooltip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CampaignIcon from '@mui/icons-material/Campaign';
import ShareIcon from '@mui/icons-material/Share';
import CheckIcon from '@mui/icons-material/Check';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function AnnouncementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [announcement, setAnnouncement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchAnnouncement();
  }, [id]);

  const fetchAnnouncement = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        setNotFound(true);
      } else {
        setAnnouncement(data);
      }
    } catch (err) {
      console.error('Error fetching announcement:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: announcement.title, url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('default', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound) {
    return (
      <Box sx={{ textAlign: 'center', pt: 10 }}>
        <Typography variant="h5" color="text.secondary">Announcement not found.</Typography>
        <Button variant="text" sx={{ mt: 2 }} onClick={() => navigate('/announcements')}>
          ← Back to Notice Board
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      {/* Back + Share row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/announcements')}
          sx={{ fontWeight: 'bold' }}
        >
          Back to Notice Board
        </Button>
        <Tooltip title={copied ? 'Link copied!' : 'Copy shareable link'}>
          <Button
            variant="outlined"
            size="small"
            startIcon={copied ? <CheckIcon /> : <ShareIcon />}
            onClick={handleShare}
            color={copied ? 'success' : 'primary'}
            sx={{ fontWeight: 'bold' }}
          >
            {copied ? 'Copied!' : 'Share'}
          </Button>
        </Tooltip>
      </Box>

      <Card sx={{ boxShadow: 3, overflow: 'hidden' }}>
        {/* Hero image — only rendered when present */}
        {announcement.image_url && (
          <Box
            component="img"
            src={announcement.image_url}
            alt={announcement.title}
            sx={{
              width: '100%',
              maxHeight: { xs: 240, md: 420 },
              objectFit: 'cover',
              display: 'block',
            }}
          />
        )}

        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          {/* Header row */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3 }}>
            <Box
              sx={{
                bgcolor: 'grey.100',
                color: 'primary.main',
                p: 1.25,
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
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" fontWeight="bold" gutterBottom
                sx={{ lineHeight: 1.3, fontSize: { xs: '1.5rem', sm: '1.875rem', md: '2.125rem' } }}>
                {announcement.title}
              </Typography>
              <Chip
                label={formatDate(announcement.date)}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 500 }}
              />
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          {/* Body */}
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ lineHeight: 2, fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}
          >
            {announcement.description}
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default AnnouncementDetail;
