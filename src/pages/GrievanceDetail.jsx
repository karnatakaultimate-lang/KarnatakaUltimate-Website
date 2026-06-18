import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Button, Divider,
  CircularProgress, TextField, Alert, Avatar, Tooltip, Select,
  MenuItem, FormControl, InputLabel
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import GavelIcon from '@mui/icons-material/Gavel';
import ShareIcon from '@mui/icons-material/Share';
import CheckIcon from '@mui/icons-material/Check';
import SendIcon from '@mui/icons-material/Send';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';

const STATUS_CONFIG = {
  open:        { label: 'Open',        color: 'error' },
  in_progress: { label: 'In Progress', color: 'warning' },
  resolved:    { label: 'Resolved',    color: 'success' },
  closed:      { label: 'Closed',      color: 'default' },
};

const ALL_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

const getInitials = (name) =>
  (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

function GrievanceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, profile } = useAuth();

  const [grievance, setGrievance] = useState(null);
  const [responses, setResponses] = useState([]);
  const [responderProfiles, setResponderProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);

  // Admin controls
  const [statusSaving, setStatusSaving] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  // Response compose
  const [responseText, setResponseText] = useState('');
  const [responseSaving, setResponseSaving] = useState(false);
  const [responseError, setResponseError] = useState('');

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: g, error: gErr } = await supabase
        .from('grievances')
        .select('*')
        .eq('id', id)
        .single();

      if (gErr || !g) { setNotFound(true); return; }
      setGrievance(g);
      setNewStatus(g.status);

      const { data: rData } = await supabase
        .from('grievance_responses')
        .select('*')
        .eq('grievance_id', id)
        .order('created_at', { ascending: true });

      setResponses(rData || []);

      // Fetch responder profiles
      const ids = [...new Set((rData || []).map(r => r.responded_by).filter(Boolean))];
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', ids);
        const map = {};
        (profiles || []).forEach(p => { map[p.id] = p; });
        setResponderProfiles(map);
      }
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (val) => {
    setNewStatus(val);
    setStatusSaving(true);
    try {
      const { error } = await supabase.from('grievances').update({ status: val }).eq('id', id);
      if (error) throw error;
      setGrievance(prev => ({ ...prev, status: val }));
    } catch (err) {
      console.error(err);
    } finally {
      setStatusSaving(false);
    }
  };

  const handlePostResponse = async () => {
    setResponseError('');
    if (!responseText.trim()) return setResponseError('Response cannot be empty.');
    if (!user) return;
    setResponseSaving(true);
    try {
      const { error } = await supabase.from('grievance_responses').insert([{
        grievance_id: id,
        responded_by: user.uid,
        response_text: responseText.trim(),
      }]);
      if (error) throw error;
      setResponseText('');
      await fetchData();
    } catch (err) {
      setResponseError(err.message || 'Failed to post response.');
    } finally {
      setResponseSaving(false);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: grievance.title, url });
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString('default', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

  const fmtShort = (iso) =>
    new Date(iso).toLocaleDateString('default', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>;

  if (notFound) return (
    <Box sx={{ textAlign: 'center', pt: 10 }}>
      <Typography variant="h5" color="text.secondary">Grievance not found.</Typography>
      <Button variant="text" sx={{ mt: 2 }} onClick={() => navigate('/grievances')}>← Back to Grievance Board</Button>
    </Box>
  );

  const statusCfg = STATUS_CONFIG[grievance.status] || STATUS_CONFIG.open;

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
      {/* Nav row */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/grievances')} sx={{ fontWeight: 'bold' }}>
          Back to Grievance Board
        </Button>
        <Tooltip title={copied ? 'Link copied!' : 'Copy shareable link'}>
          <Button
            variant="outlined" size="small"
            startIcon={copied ? <CheckIcon /> : <ShareIcon />}
            onClick={handleShare}
            color={copied ? 'success' : 'primary'}
            sx={{ fontWeight: 'bold' }}
          >
            {copied ? 'Copied!' : 'Share'}
          </Button>
        </Tooltip>
      </Box>

      {/* Grievance card */}
      <Card sx={{ boxShadow: 3, overflow: 'hidden', mb: 3 }}>
        <Box sx={{ borderTop: '6px solid', borderColor: 'primary.main', px: { xs: 3, md: 5 }, pt: 3, pb: 2.5, bgcolor: 'grey.50' }}>
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
            <Chip label={statusCfg.label} color={statusCfg.color} sx={{ fontWeight: 'bold' }} />
            <Chip label={grievance.category} variant="outlined" sx={{ fontWeight: 500 }} />
            {grievance.is_anonymous && (
              <Chip label="Anonymous" variant="outlined" sx={{ fontWeight: 500 }} />
            )}
          </Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom
            sx={{ lineHeight: 1.3, fontSize: { xs: '1.5rem', sm: '1.875rem', md: '2.125rem' } }}>
            {grievance.title}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Submitted {fmtDate(grievance.created_at)}
          </Typography>
        </Box>

        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ lineHeight: 2, fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}
          >
            {grievance.description}
          </Typography>
        </CardContent>
      </Card>

      {/* Admin panel */}
      {isAdmin && (
        <Card sx={{ boxShadow: 3, mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <AdminPanelSettingsIcon sx={{ color: 'warning.main' }} />
              <Typography variant="h6" fontWeight="bold">Admin Controls</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={newStatus}
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={statusSaving}
                >
                  {ALL_STATUSES.map(s => (
                    <MenuItem key={s} value={s}>
                      {STATUS_CONFIG[s].label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {statusSaving && <CircularProgress size={18} />}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Responses thread */}
      <Card sx={{ boxShadow: 3, mb: 3 }}>
        <Box sx={{ px: 3, py: 2.5, bgcolor: 'grey.50', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" fontWeight="bold">
            Responses {responses.length > 0 && `(${responses.length})`}
          </Typography>
        </Box>
        <CardContent sx={{ p: 0 }}>
          {responses.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 5 }}>
              No responses yet.
            </Typography>
          ) : (
            <Box>
              {responses.map((r, idx) => {
                const responder = responderProfiles[r.responded_by];
                return (
                  <React.Fragment key={r.id}>
                    <Box sx={{ px: 3, py: 2.5, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Avatar sx={{ bgcolor: 'grey.200', fontWeight: 'bold', width: 40, height: 40, flexShrink: 0, mt: 0.25 }}>
                        {responder?.avatar_url
                          ? <img src={responder.avatar_url} referrerPolicy="no-referrer" alt={responder?.full_name} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                          : getInitials(responder?.full_name)}
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {responder?.full_name || 'KUPA Admin'}
                          </Typography>
                          <Chip
                            icon={<AdminPanelSettingsIcon sx={{ fontSize: '13px !important' }} />}
                            label="Admin"
                            size="small" color="warning"
                            sx={{ fontWeight: 'bold', height: 20, fontSize: '0.7rem' }}
                          />
                          <Typography variant="caption" color="text.disabled">
                            {fmtShort(r.created_at)}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                          {r.response_text}
                        </Typography>
                      </Box>
                    </Box>
                    {idx < responses.length - 1 && <Divider />}
                  </React.Fragment>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Compose response (admins only) */}
      {isAdmin && (
        <Card sx={{ boxShadow: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>Post Response</Typography>
            {responseError && <Alert severity="error" sx={{ mb: 2 }}>{responseError}</Alert>}
            <TextField
              fullWidth
              multiline
              minRows={4}
              placeholder="Write a response to this grievance..."
              value={responseText}
              onChange={e => setResponseText(e.target.value)}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={responseSaving ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                onClick={handlePostResponse}
                disabled={responseSaving || !responseText.trim()}
                sx={{ fontWeight: 'bold', px: 4 }}
              >
                {responseSaving ? 'Posting...' : 'Post Response'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Non-admin: note that admins respond */}
      {!isAdmin && (
        <Alert severity="info">
          Admins will review and respond to this grievance. Check back for updates.
        </Alert>
      )}
    </Box>
  );
}

export default GrievanceDetail;
