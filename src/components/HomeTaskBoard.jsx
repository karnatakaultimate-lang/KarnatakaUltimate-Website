import React, { useState, useEffect } from 'react';
import { Box, Typography, Card, CardContent, Chip, Button, Divider, CircularProgress } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import StarIcon from '@mui/icons-material/Star';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function HomeTaskBoard() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, points, status')
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(3);

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 3 }}>
      {/* Header */}
      <Box sx={{
        p: 3, bgcolor: 'secondary.main', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Typography variant="h5" fontWeight="bold">Task Board</Typography>
        <Button variant="contained" color="primary" size="small" onClick={() => navigate('/tasks')}>
          View All
        </Button>
      </Box>

      <CardContent sx={{ flexGrow: 1, p: 0 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        ) : tasks.length === 0 ? (
          <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4, px: 3 }}>
            No open tasks right now.
          </Typography>
        ) : (
          tasks.map((task, index) => (
            <React.Fragment key={task.id}>
              <Box
                onClick={() => navigate('/tasks')}
                sx={{
                  p: 3, display: 'flex', alignItems: 'flex-start', gap: 2,
                  cursor: 'pointer', transition: '0.2s',
                  '&:hover': { bgcolor: 'grey.50' },
                }}
              >
                <Box sx={{
                  bgcolor: 'secondary.main', color: 'white',
                  p: 1, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <AssignmentIcon fontSize="small" />
                </Box>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" fontWeight="bold" noWrap>
                    {task.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
                    {task.description}
                  </Typography>
                </Box>
                <Chip
                  icon={<StarIcon sx={{ fontSize: '0.85rem !important' }} />}
                  label={`${task.points} pts`}
                  size="small"
                  color="warning"
                  sx={{ fontWeight: 'bold', flexShrink: 0 }}
                />
              </Box>
              {index < tasks.length - 1 && <Divider />}
            </React.Fragment>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default HomeTaskBoard;
