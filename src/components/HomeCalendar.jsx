import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Chip, Button, CircularProgress } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function HomeCalendar() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(3);
      
      if (error) throw error;
      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEventColor = (type) => {
    switch(type) {
      case 'Training': return 'info.main';
      case 'Pick-up': return 'success.main';
      case 'Tournament': return 'warning.main';
      default: return 'primary.main';
    }
  };

  const formatDate = (isoString) => {
    const d = new Date(isoString);
    return {
      day: d.getDate(),
      monthStr: d.toLocaleString('default', { month: 'short' }),
      timeStr: d.toLocaleTimeString('default', { hour: '2-digit', minute:'2-digit' })
    };
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 3 }}>
      <Box sx={{ p: 3, bgcolor: 'secondary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight="bold">Upcoming Events</Typography>
        <Button variant="contained" color="primary" size="small" onClick={() => navigate('/events')}>
          View Calendar
        </Button>
      </Box>
      <CardContent sx={{ flexGrow: 1, p: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        ) : events.length === 0 ? (
          <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>No upcoming events.</Typography>
        ) : (
          events.map((event, index) => {
            const dateObj = formatDate(event.start_time);
            return (
              <Box key={event.id} sx={{ p: 3, display: 'flex', borderBottom: index < events.length - 1 ? '1px solid' : 'none', borderColor: 'divider', transition: 'bgcolor 0.2s', '&:hover': { bgcolor: 'grey.50' } }}>
                <Box sx={{ minWidth: 70, textAlign: 'center', mr: 3 }}>
                  <Typography variant="h5" fontWeight="bold" color="primary.main">{dateObj.day}</Typography>
                  <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase' }}>{dateObj.monthStr}</Typography>
                </Box>
                <Box>
                  <Typography variant="h6" fontWeight="bold" sx={{ mb: 0.5 }}>{event.title}</Typography>
                  <Chip label={event.type} size="small" sx={{ mb: 1, bgcolor: getEventColor(event.type), color: 'white', fontWeight: 'bold' }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary', mb: 0.5 }}>
                    <CalendarTodayIcon sx={{ fontSize: 16, mr: 1 }} />
                    <Typography variant="body2">{dateObj.timeStr}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
                    <LocationOnIcon sx={{ fontSize: 16, mr: 1 }} />
                    <Typography variant="body2">{event.location}</Typography>
                  </Box>
                </Box>
              </Box>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

export default HomeCalendar;
