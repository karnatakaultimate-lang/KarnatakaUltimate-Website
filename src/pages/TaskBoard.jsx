import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button,
  LinearProgress, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert, Avatar
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LockIcon from '@mui/icons-material/Lock';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';

// Map task status → progress bar value
const PROGRESS = { available: 0, claimed: 40, pending_review: 75, completed: 100 };

function TaskBoard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Claim dialog
  const [claimDialog, setClaimDialog] = useState({ open: false, task: null });
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState('');

  // Proof dialog
  const [proofDialog, setProofDialog] = useState({ open: false, task: null });
  const [proofText, setProofText] = useState('');
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState('');

  useEffect(() => { fetchTasks(); }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Claim ──────────────────────────────────────────────────────────────────

  const openClaimDialog = (task) => {
    if (!user) { navigate('/login'); return; }
    setClaimError('');
    setClaimDialog({ open: true, task });
  };

  const handleClaim = async () => {
    const task = claimDialog.task;
    setClaimLoading(true);
    setClaimError('');
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status: 'claimed',
          claimed_by: user.uid,
          claimed_at: new Date().toISOString(),
        })
        .eq('id', task.id)
        .eq('status', 'available'); // prevents double-claiming

      if (error) throw error;
      setClaimDialog({ open: false, task: null });
      await fetchTasks();
    } catch (err) {
      setClaimError(err.message || 'Failed to claim task. It may have just been claimed by someone else.');
    } finally {
      setClaimLoading(false);
    }
  };

  // ── Proof submission ───────────────────────────────────────────────────────

  const openProofDialog = (task) => {
    setProofText('');
    setProofError('');
    setProofDialog({ open: true, task });
  };

  const handleSubmitProof = async () => {
    const task = proofDialog.task;
    if (!proofText.trim()) { setProofError('Please describe what you did.'); return; }
    setProofLoading(true);
    setProofError('');
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'pending_review', proof_text: proofText.trim() })
        .eq('id', task.id)
        .eq('claimed_by', user.uid);

      if (error) throw error;
      setProofDialog({ open: false, task: null });
      setProofText('');
      await fetchTasks();
    } catch (err) {
      setProofError(err.message || 'Failed to submit proof.');
    } finally {
      setProofLoading(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':     return 'primary';
      case 'claimed':       return 'warning';
      case 'pending_review':return 'info';
      case 'completed':     return 'success';
      default:              return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'available':      return 'Available';
      case 'claimed':        return 'Claimed';
      case 'pending_review': return 'Under Review';
      case 'completed':      return 'Completed';
      default:               return status;
    }
  };

  // Decide what action area to render per task
  const renderAction = (task) => {
    const mine = user && task.claimed_by === user.uid;

    if (task.status === 'completed') {
      return (
        <Chip
          icon={<CheckCircleIcon />}
          label="Completed"
          color="success"
          sx={{ fontWeight: 'bold', width: '100%', borderRadius: 1.5, py: 2.5 }}
        />
      );
    }

    if (task.status === 'pending_review') {
      return mine ? (
        <Chip
          icon={<HourglassEmptyIcon />}
          label="Awaiting Admin Review"
          color="info"
          sx={{ fontWeight: 'bold', width: '100%', borderRadius: 1.5, py: 2.5 }}
        />
      ) : (
        <Button fullWidth variant="outlined" disabled>Under Review</Button>
      );
    }

    if (task.status === 'claimed') {
      if (mine) {
        return (
          <Button
            fullWidth variant="contained" color="warning"
            onClick={() => openProofDialog(task)}
            sx={{ fontWeight: 'bold' }}
          >
            Submit Proof
          </Button>
        );
      }
      return (
        <Chip
          icon={<LockIcon />}
          label="Claimed"
          variant="outlined"
          sx={{ fontWeight: 'bold', width: '100%', borderRadius: 1.5, py: 2.5 }}
        />
      );
    }

    // available
    return (
      <Button
        fullWidth variant="contained" color="primary"
        onClick={() => openClaimDialog(task)}
        sx={{ fontWeight: 'bold' }}
      >
        {user ? 'Claim Task' : 'Login to Claim'}
      </Button>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1.75rem', md: '3rem' } }}>Task Board</Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Complete community tasks to earn KUPA reward points. Use your points for exclusive merchandise and event discounts!
        </Typography>

      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : tasks.length === 0 ? (
        <Typography variant="h6" color="text.secondary" align="center" sx={{ py: 5 }}>
          No tasks available right now.
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {tasks.map((task) => (
            <Grid size={{ xs: 12, md: 4 }} key={task.id}>
              <Card sx={{
                height: '100%', display: 'flex', flexDirection: 'column',
                transition: '0.2s',
                opacity: task.status === 'completed' ? 0.7 : 1,
                '&:hover': task.status !== 'completed'
                  ? { transform: 'translateY(-4px)', boxShadow: 4 }
                  : {},
              }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  {/* Status + points row */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Chip
                      icon={<AssignmentIcon />}
                      label={getStatusLabel(task.status)}
                      color={getStatusColor(task.status)}
                      size="small"
                    />
                    <Chip
                      icon={<StarIcon />}
                      label={`${task.points} pts`}
                      color="warning"
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </Box>

                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {task.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {task.description}
                  </Typography>

                  {/* Progress bar */}
                  <Box sx={{ mt: 'auto', pt: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={PROGRESS[task.status] ?? 0}
                      color={getStatusColor(task.status)}
                      sx={{ height: 6, borderRadius: 3, mb: 0.75 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {PROGRESS[task.status] ?? 0}% complete
                    </Typography>
                  </Box>
                </CardContent>

                {/* Action area */}
                <Box sx={{ p: 2, pt: 0 }}>
                  {renderAction(task)}
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* ── Claim confirmation dialog ── */}
      <Dialog
        open={claimDialog.open}
        onClose={() => !claimLoading && setClaimDialog({ open: false, task: null })}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Claim Task</DialogTitle>
        <DialogContent>
          {claimError && <Alert severity="error" sx={{ mb: 2 }}>{claimError}</Alert>}
          <Typography variant="body1" gutterBottom>
            You're about to claim:
          </Typography>
          <Box sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 2, mt: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight="bold">{claimDialog.task?.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {claimDialog.task?.description}
            </Typography>
            <Chip
              icon={<StarIcon />}
              label={`${claimDialog.task?.points} pts on completion`}
              color="warning" size="small"
              sx={{ mt: 1.5, fontWeight: 'bold' }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            After claiming, complete the task and submit proof. An admin will review and award your points.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setClaimDialog({ open: false, task: null })} disabled={claimLoading}>
            Cancel
          </Button>
          <Button
            variant="contained" onClick={handleClaim} disabled={claimLoading}
            startIcon={claimLoading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 'bold', px: 3 }}
          >
            {claimLoading ? 'Claiming...' : 'Confirm Claim'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Proof submission dialog ── */}
      <Dialog
        open={proofDialog.open}
        onClose={() => !proofLoading && setProofDialog({ open: false, task: null })}
        maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Submit Proof of Completion</DialogTitle>
        <DialogContent>
          {proofError && <Alert severity="error" sx={{ mb: 2 }}>{proofError}</Alert>}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Task: <strong>{proofDialog.task?.title}</strong>
          </Typography>
          <TextField
            fullWidth multiline minRows={4}
            label="What did you do?"
            placeholder="Describe how you completed this task. Be specific — admins use this to verify your work."
            value={proofText}
            onChange={(e) => setProofText(e.target.value)}
            required
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            An admin will review your submission and award <strong>{proofDialog.task?.points} points</strong> upon approval.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setProofDialog({ open: false, task: null })} disabled={proofLoading}>
            Cancel
          </Button>
          <Button
            variant="contained" onClick={handleSubmitProof} disabled={proofLoading}
            startIcon={proofLoading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 'bold', px: 3 }}
          >
            {proofLoading ? 'Submitting...' : 'Submit for Review'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TaskBoard;
