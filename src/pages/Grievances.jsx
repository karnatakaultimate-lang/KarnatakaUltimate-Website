import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, CardActionArea, Grid, Chip,
  Button, CircularProgress, TextField, Dialog, DialogTitle,
  DialogContent, DialogActions, MenuItem, Select, InputLabel,
  FormControl, FormControlLabel, Switch, Alert, Divider
} from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import AddIcon from '@mui/icons-material/Add';
import FeedbackIcon from '@mui/icons-material/Feedback';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

const CATEGORIES = ['Gameplay', 'Conduct', 'Organization', 'Facilities', 'Safety', 'Other'];

const STATUS_CONFIG = {
  open:        { label: 'Open',        color: 'error' },
  in_progress: { label: 'In Progress', color: 'warning' },
  resolved:    { label: 'Resolved',    color: 'success' },
  closed:      { label: 'Closed',      color: 'default' },
};

const EMPTY_FORM = { title: '', description: '', category: 'Other', is_anonymous: false };

function Grievances() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState('');

  useEffect(() => {
    fetchGrievances();
  }, []);

  const fetchGrievances = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('grievances')
        .select('id, title, category, status, is_anonymous, submitted_by, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setGrievances(data || []);
    } catch (err) {
      console.error('Error fetching grievances:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!form.title.trim()) return setFormError('Title is required.');
    if (!form.description.trim()) return setFormError('Description is required.');
    setFormSaving(true);
    try {
      const { error } = await supabase.from('grievances').insert([{
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        is_anonymous: form.is_anonymous,
        submitted_by: form.is_anonymous ? null : (user?.uid || null),
        status: 'open',
      }]);
      if (error) throw error;
      setSubmitOpen(false);
      setForm(EMPTY_FORM);
      setSubmitSuccess('Your grievance has been submitted. Thank you for helping us improve.');
      setTimeout(() => setSubmitSuccess(''), 5000);
      await fetchGrievances();
    } catch (err) {
      setFormError(err.message || 'Failed to submit grievance.');
    } finally {
      setFormSaving(false);
    }
  };

  const filtered = filterStatus === 'all'
    ? grievances
    : grievances.filter(g => g.status === filterStatus);

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Box>
      {/* Header */}
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: { xs: 1.5, md: 0 },
        mb: 1,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <GavelIcon sx={{ fontSize: { xs: 28, md: 36 }, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.5rem', md: '2.125rem' } }}>Grievance Board</Typography>
            <Typography variant="body1" color="text.secondary">
              Raise concerns openly. We are committed to transparency and accountability.
            </Typography>
          </Box>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setForm(EMPTY_FORM); setFormError(''); setSubmitOpen(true); }}
          sx={{ fontWeight: 'bold', alignSelf: { xs: 'stretch', md: 'auto' } }}
        >
          Submit Grievance
        </Button>
      </Box>

      {/* Public note */}
      <Alert severity="info" sx={{ mb: 3, mt: 2 }}>
        This board is public — all submissions are visible to everyone. Admins review and respond to each grievance.
        You may submit anonymously if you prefer.
      </Alert>

      {submitSuccess && <Alert severity="success" sx={{ mb: 3 }}>{submitSuccess}</Alert>}

      {/* Filter chips */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
          <Chip
            key={s}
            label={s === 'all' ? `All (${grievances.length})` : `${STATUS_CONFIG[s]?.label} (${grievances.filter(g => g.status === s).length})`}
            onClick={() => setFilterStatus(s)}
            color={filterStatus === s ? (s === 'all' ? 'primary' : STATUS_CONFIG[s]?.color) : 'default'}
            variant={filterStatus === s ? 'filled' : 'outlined'}
            sx={{ fontWeight: 'bold', cursor: 'pointer' }}
          />
        ))}
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}><CircularProgress /></Box>
      ) : filtered.length === 0 ? (
        <Card sx={{ textAlign: 'center', p: 6, boxShadow: 2 }}>
          <FeedbackIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {filterStatus === 'all' ? 'No grievances submitted yet.' : `No ${STATUS_CONFIG[filterStatus]?.label.toLowerCase()} grievances.`}
          </Typography>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((g) => {
            const statusCfg = STATUS_CONFIG[g.status] || STATUS_CONFIG.open;
            return (
              <Grid size={{ xs: 12 }} key={g.id}>
                <Card sx={{ boxShadow: 2, transition: '0.15s', '&:hover': { boxShadow: 4 } }}>
                  <CardActionArea onClick={() => navigate(`/grievances/${g.id}`)}>
                    <CardContent sx={{ p: 2.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75, flexWrap: 'wrap' }}>
                            <Chip label={statusCfg.label} size="small" color={statusCfg.color} sx={{ fontWeight: 'bold' }} />
                            <Chip label={g.category} size="small" variant="outlined" sx={{ fontWeight: 500 }} />
                            {g.is_anonymous && (
                              <Chip label="Anonymous" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                            )}
                          </Box>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            {g.title}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0, mt: 0.5 }}>
                          {fmtDate(g.created_at)}
                        </Typography>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Submit Dialog */}
      <Dialog
        open={submitOpen}
        onClose={() => !formSaving && setSubmitOpen(false)}
        maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', fontSize: '1.4rem' }}>Submit a Grievance</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

          <Alert severity="info" sx={{ mb: 2 }}>
            All grievances are published on this public board. If you prefer, you may submit anonymously.
          </Alert>

          <TextField
            fullWidth label="Title" margin="normal" required
            placeholder="Short summary of the grievance"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          />

          <FormControl fullWidth margin="normal">
            <InputLabel>Category</InputLabel>
            <Select
              label="Category"
              value={form.category}
              onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
            >
              {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>

          <TextField
            fullWidth label="Description" margin="normal" required multiline minRows={5}
            placeholder="Describe the issue in detail. Include dates, people involved, and what happened..."
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />

          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Switch
                checked={form.is_anonymous}
                onChange={e => setForm(p => ({ ...p, is_anonymous: e.target.checked }))}
                color="primary"
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight="bold">Submit anonymously</Typography>
                <Typography variant="caption" color="text.secondary">
                  Your name won't be shown publicly, but admins may know your identity through logs.
                </Typography>
              </Box>
            }
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setSubmitOpen(false)} disabled={formSaving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={formSaving}
            startIcon={formSaving ? <CircularProgress size={16} color="inherit" /> : <GavelIcon />}
            sx={{ fontWeight: 'bold', px: 4 }}
          >
            {formSaving ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Grievances;
