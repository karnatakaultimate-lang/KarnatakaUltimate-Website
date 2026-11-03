import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Chip, Button,
  LinearProgress, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Alert
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import LockIcon from '@mui/icons-material/Lock';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import GroupsIcon from '@mui/icons-material/Groups';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../firebaseClient';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { TASK_CATEGORIES, getCategoryStyle } from '../constants/taskCategories';

const PROGRESS = { available: 0, claimed: 40, pending_review: 75, completed: 100 };

function TaskBoard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState([]);
  // taskId → user's own claim row (for multi-user tasks)
  const [userClaims, setUserClaims] = useState({});
  // taskId → { completed: N, claimed: N, pending_review: N }
  const [claimCounts, setClaimCounts] = useState({});

  // Claim dialog
  const [claimDialog, setClaimDialog] = useState({ open: false, task: null });
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState('');

  // Proof dialog
  const [proofDialog, setProofDialog] = useState({ open: false, task: null });
  const [proofText, setProofText] = useState('');
  const [proofImage, setProofImage] = useState(null);
  const [proofImagePreview, setProofImagePreview] = useState('');
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState('');
  const proofImageInputRef = useRef(null);

  useEffect(() => { fetchTasks(); }, [user?.uid]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const taskList = data || [];
      setTasks(taskList);

      const multiIds = taskList.filter(t => t.is_multi_user).map(t => t.id);

      // Fetch claim counts for all multi-user tasks
      if (multiIds.length > 0) {
        const { data: counts } = await supabase
          .from('task_claims')
          .select('task_id, status')
          .in('task_id', multiIds);
        const countMap = {};
        (counts || []).forEach(c => {
          if (!countMap[c.task_id]) countMap[c.task_id] = { claimed: 0, pending_review: 0, completed: 0 };
          countMap[c.task_id][c.status] = (countMap[c.task_id][c.status] || 0) + 1;
        });
        setClaimCounts(countMap);
      }

      // Fetch this user's own claims
      if (user && multiIds.length > 0) {
        const { data: myClaims } = await supabase
          .from('task_claims')
          .select('*')
          .eq('user_id', user.uid)
          .in('task_id', multiIds);
        const claimMap = {};
        (myClaims || []).forEach(c => { claimMap[c.task_id] = c; });
        setUserClaims(claimMap);
      } else {
        setUserClaims({});
      }
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
      if (task.is_multi_user) {
        const { error } = await supabase
          .from('task_claims')
          .insert({ task_id: task.id, user_id: user.uid, status: 'claimed' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tasks')
          .update({ status: 'claimed', claimed_by: user.uid, claimed_at: new Date().toISOString() })
          .eq('id', task.id)
          .eq('status', 'available');
        if (error) throw error;
      }
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
    setProofImage(null);
    setProofImagePreview('');
    setProofError('');
    setProofDialog({ open: true, task });
  };

  const handleProofImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofImage(file);
    setProofImagePreview(URL.createObjectURL(file));
  };

  const handleSubmitProof = async () => {
    const task = proofDialog.task;
    if (task.requires_photo_proof && !proofImage) {
      setProofError('A screenshot is required for this task.');
      return;
    }
    if (!proofText.trim() && !proofImage) {
      setProofError('Please add a description or a screenshot.');
      return;
    }
    setProofLoading(true);
    setProofError('');
    try {
      let proof_image_url = null;
      if (proofImage) {
        const ext = proofImage.name.split('.').pop();
        const path = `task-proofs/${task.id}/${user.uid}_${Date.now()}.${ext}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, proofImage);
        proof_image_url = await getDownloadURL(storageRef);
      }

      if (task.is_multi_user) {
        const { error } = await supabase
          .from('task_claims')
          .update({ status: 'pending_review', proof_text: proofText.trim() || null, proof_image_url })
          .eq('task_id', task.id)
          .eq('user_id', user.uid);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tasks')
          .update({ status: 'pending_review', proof_text: proofText.trim() || null, proof_image_url })
          .eq('id', task.id)
          .eq('claimed_by', user.uid);
        if (error) throw error;
      }

      setProofDialog({ open: false, task: null });
      setProofText('');
      setProofImage(null);
      setProofImagePreview('');
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
      case 'available':      return 'primary';
      case 'claimed':        return 'warning';
      case 'pending_review': return 'info';
      case 'completed':      return 'success';
      default:               return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'available':      return 'Available';
      case 'claimed':        return 'In Progress';
      case 'pending_review': return 'Under Review';
      case 'completed':      return 'Completed';
      default:               return status;
    }
  };

  // For multi-user tasks, effective status is the user's own claim status
  const getEffectiveStatus = (task) => {
    if (task.is_multi_user) return userClaims[task.id]?.status || 'available';
    return task.status;
  };

  const renderAction = (task) => {
    if (task.is_multi_user) {
      const claim = userClaims[task.id];
      if (!claim) {
        return (
          <Button fullWidth variant="contained" color="primary"
            onClick={() => openClaimDialog(task)} sx={{ fontWeight: 'bold' }}>
            {user ? 'Claim Task' : 'Login to Claim'}
          </Button>
        );
      }
      if (claim.status === 'completed') {
        return (
          <Chip icon={<CheckCircleIcon />} label="Completed" color="success"
            sx={{ fontWeight: 'bold', width: '100%', borderRadius: 1.5, py: 2.5 }} />
        );
      }
      if (claim.status === 'pending_review') {
        return (
          <Chip icon={<HourglassEmptyIcon />} label="Awaiting Admin Review" color="info"
            sx={{ fontWeight: 'bold', width: '100%', borderRadius: 1.5, py: 2.5 }} />
        );
      }
      return (
        <Button fullWidth variant="contained" color="warning"
          onClick={() => openProofDialog(task)} sx={{ fontWeight: 'bold' }}>
          Submit Proof
        </Button>
      );
    }

    // Single-user task
    const mine = user && task.claimed_by === user.uid;

    if (task.status === 'completed') {
      return (
        <Chip icon={<CheckCircleIcon />} label="Completed" color="success"
          sx={{ fontWeight: 'bold', width: '100%', borderRadius: 1.5, py: 2.5 }} />
      );
    }
    if (task.status === 'pending_review') {
      return mine ? (
        <Chip icon={<HourglassEmptyIcon />} label="Awaiting Admin Review" color="info"
          sx={{ fontWeight: 'bold', width: '100%', borderRadius: 1.5, py: 2.5 }} />
      ) : (
        <Button fullWidth variant="outlined" disabled>Under Review</Button>
      );
    }
    if (task.status === 'claimed') {
      if (mine) {
        return (
          <Button fullWidth variant="contained" color="warning"
            onClick={() => openProofDialog(task)} sx={{ fontWeight: 'bold' }}>
            Submit Proof
          </Button>
        );
      }
      return (
        <Chip icon={<LockIcon />} label="Claimed" variant="outlined"
          sx={{ fontWeight: 'bold', width: '100%', borderRadius: 1.5, py: 2.5 }} />
      );
    }
    return (
      <Button fullWidth variant="contained" color="primary"
        onClick={() => openClaimDialog(task)} sx={{ fontWeight: 'bold' }}>
        {user ? 'Claim Task' : 'Login to Claim'}
      </Button>
    );
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  const toggleCategory = (label) => {
    setSelectedCategories(prev =>
      prev.includes(label) ? prev.filter(c => c !== label) : [...prev, label]
    );
  };

  const visibleCategories = TASK_CATEGORIES.filter(cat =>
    tasks.some(t => (t.category || 'Other') === cat.label)
  );

  const filteredTasks = selectedCategories.length === 0
    ? tasks
    : tasks.filter(t => selectedCategories.includes(t.category || 'Other'));

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h3" fontWeight="bold" gutterBottom sx={{ fontSize: { xs: '1.75rem', md: '3rem' } }}>
          Task Board
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Complete community tasks to earn KUPA reward points. Use your points for exclusive merchandise and event discounts!
        </Typography>
      </Box>

      {/* Category filter bar */}
      {!loading && visibleCategories.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            {visibleCategories.map(cat => {
              const active = selectedCategories.includes(cat.label);
              return (
                <Chip
                  key={cat.label}
                  label={cat.label}
                  onClick={() => toggleCategory(cat.label)}
                  variant={active ? 'filled' : 'outlined'}
                  sx={active
                    ? { ...getCategoryStyle(cat.label), fontWeight: 'bold', cursor: 'pointer' }
                    : { borderColor: cat.color, color: cat.color, fontWeight: 'medium', cursor: 'pointer' }
                  }
                />
              );
            })}
            {selectedCategories.length > 0 && (
              <Chip
                label="Clear"
                onClick={() => setSelectedCategories([])}
                variant="outlined"
                size="small"
                sx={{ cursor: 'pointer', color: 'text.secondary' }}
              />
            )}
          </Box>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : filteredTasks.length === 0 ? (
        <Typography variant="h6" color="text.secondary" align="center" sx={{ py: 5 }}>
          {tasks.length === 0 ? 'No tasks available right now.' : 'No tasks match the selected filters.'}
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {filteredTasks.map((task) => {
            const effectiveStatus = getEffectiveStatus(task);
            const isDimmed = effectiveStatus === 'completed';
            const counts = claimCounts[task.id] || {};

            return (
              <Grid size={{ xs: 12, md: 4 }} key={task.id}>
                <Card sx={{
                  height: '100%', display: 'flex', flexDirection: 'column',
                  transition: '0.2s',
                  opacity: isDimmed ? 0.7 : 1,
                  '&:hover': !isDimmed ? { transform: 'translateY(-4px)', boxShadow: 4 } : {},
                }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    {/* Status + points row */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Chip
                        icon={<AssignmentIcon />}
                        label={getStatusLabel(effectiveStatus)}
                        color={getStatusColor(effectiveStatus)}
                        size="small"
                      />
                      <Chip
                        icon={<StarIcon />}
                        label={`${task.points} pts`}
                        color="warning" size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </Box>

                    <Typography variant="h6" fontWeight="bold" gutterBottom>
                      {task.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {task.description}
                    </Typography>

                    {/* Badges */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
                      {task.category && (
                        <Chip
                          label={task.category} size="small"
                          sx={{ ...getCategoryStyle(task.category), fontWeight: 'bold' }}
                        />
                      )}
                      {task.is_multi_user && (
                        <Chip icon={<GroupsIcon />} label="Open to all" size="small" color="secondary" variant="outlined" />
                      )}
                      {task.requires_photo_proof && (
                        <Chip icon={<CameraAltIcon />} label="Photo required" size="small" variant="outlined" color="info" />
                      )}
                    </Box>

                    {/* Completion count for multi-user tasks */}
                    {task.is_multi_user && (counts.completed > 0 || counts.pending_review > 0 || counts.claimed > 0) && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        {[
                          counts.completed  && `${counts.completed} completed`,
                          counts.pending_review && `${counts.pending_review} under review`,
                          counts.claimed    && `${counts.claimed} in progress`,
                        ].filter(Boolean).join(' · ')}
                      </Typography>
                    )}

                    {/* Progress bar */}
                    <Box sx={{ mt: 'auto', pt: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={PROGRESS[effectiveStatus] ?? 0}
                        color={getStatusColor(effectiveStatus)}
                        sx={{ height: 6, borderRadius: 3, mb: 0.75 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {PROGRESS[effectiveStatus] ?? 0}% complete
                      </Typography>
                    </Box>
                  </CardContent>

                  <Box sx={{ p: 2, pt: 0 }}>
                    {renderAction(task)}
                  </Box>
                </Card>
              </Grid>
            );
          })}
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
          <Typography variant="body1" gutterBottom>You're about to claim:</Typography>
          <Box sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 2, mt: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" fontWeight="bold">{claimDialog.task?.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {claimDialog.task?.description}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
              <Chip icon={<StarIcon />} label={`${claimDialog.task?.points} pts on completion`}
                color="warning" size="small" sx={{ fontWeight: 'bold' }} />
              {claimDialog.task?.is_multi_user && (
                <Chip icon={<GroupsIcon />} label="Open to all" size="small" color="secondary" variant="outlined" />
              )}
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            After claiming, complete the task and submit proof. An admin will review and award your points.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setClaimDialog({ open: false, task: null })} disabled={claimLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleClaim} disabled={claimLoading}
            startIcon={claimLoading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 'bold', px: 3 }}>
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

          <input type="file" accept="image/*" hidden ref={proofImageInputRef} onChange={handleProofImageChange} />
          {proofImagePreview ? (
            <Box sx={{ mb: 2 }}>
              <Box component="img" src={proofImagePreview} alt="Proof preview"
                sx={{ width: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 1.5, border: '1px solid', borderColor: 'divider', mb: 1 }} />
              <Button size="small" onClick={() => { setProofImage(null); setProofImagePreview(''); }}>
                Remove image
              </Button>
            </Box>
          ) : (
            <Button fullWidth variant="outlined"
              color={proofDialog.task?.requires_photo_proof ? 'primary' : 'inherit'}
              startIcon={<CameraAltIcon />}
              onClick={() => proofImageInputRef.current?.click()}
              sx={{ mb: 2, py: 1.5, borderStyle: 'dashed' }}>
              {proofDialog.task?.requires_photo_proof ? 'Upload screenshot (required)' : 'Upload screenshot (optional)'}
            </Button>
          )}

          <TextField
            fullWidth multiline minRows={3}
            label={proofDialog.task?.requires_photo_proof ? 'Additional notes (optional)' : 'What did you do?'}
            placeholder="Describe how you completed this task. Be specific — admins use this to verify your work."
            value={proofText}
            onChange={(e) => setProofText(e.target.value)}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            An admin will review your submission and award <strong>{proofDialog.task?.points} points</strong> upon approval.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setProofDialog({ open: false, task: null })} disabled={proofLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmitProof} disabled={proofLoading}
            startIcon={proofLoading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 'bold', px: 3 }}>
            {proofLoading ? 'Submitting...' : 'Submit for Review'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TaskBoard;
