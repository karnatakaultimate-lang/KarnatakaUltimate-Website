import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Button, CircularProgress, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Avatar, Divider, Collapse, IconButton, Tooltip, Grid, Checkbox,
  FormControlLabel, FormGroup, Select, InputLabel, FormControl,
} from '@mui/material';
import AddIcon                  from '@mui/icons-material/Add';
import ExpandMoreIcon           from '@mui/icons-material/ExpandMore';
import ExpandLessIcon           from '@mui/icons-material/ExpandLess';
import DeleteIcon               from '@mui/icons-material/Delete';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CheckCircleIcon          from '@mui/icons-material/CheckCircle';
import PendingIcon              from '@mui/icons-material/Pending';
import { supabase } from '../../supabaseClient';

// ── Constants ──────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'tournament', label: 'Tournament', color: 'warning' },
  { value: 'training',   label: 'Training',   color: 'info'    },
  { value: 'equipment',  label: 'Equipment',  color: 'secondary'},
  { value: 'food',       label: 'Food',       color: 'success'  },
  { value: 'other',      label: 'Other',      color: 'default'  },
];

const SPLIT_MODES = [
  { value: 'full_team',        label: 'Full Team',        desc: 'Split equally among all current members' },
  { value: 'event_attendees',  label: 'Event Attendees',  desc: 'Split among members who attended a session' },
  { value: 'custom',           label: 'Custom',           desc: 'Choose specific members to split among' },
];

const EMPTY_FORM = {
  title: '', description: '', total_amount: '',
  category: 'other', expense_date: new Date().toISOString().split('T')[0],
  split_mode: 'full_team', event_id: '', custom_members: [],
};

const fmt = (n) => `₹${Number(n || 0).toFixed(2)}`;

const getInitials = (name) =>
  (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

const catConfig = (cat) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[4];

// ── Component ──────────────────────────────────────────────────────────────────
export default function TeamFinancialsTab({ teamId, members, profileMap, isTeamAdmin, canFinance, user }) {
  const [expenses,    setExpenses]    = useState([]);
  const [splits,      setSplits]      = useState({}); // expenseId → [split rows]
  const [sessions,    setSessions]    = useState([]); // past events for split_mode=event_attendees
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [expanded,    setExpanded]    = useState({}); // expenseId → bool

  // Add expense dialog
  const [addOpen,   setAddOpen]   = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [preview,   setPreview]   = useState([]); // { user_id, name, share }
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirm
  const [deleteId,      setDeleteId]      = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Expenses
      const { data: expData, error: expErr } = await supabase
        .from('team_expenses')
        .select('*')
        .eq('team_id', teamId)
        .order('expense_date', { ascending: false });
      if (expErr) throw expErr;
      setExpenses(expData || []);

      // Splits for all expenses
      if (expData && expData.length > 0) {
        const expIds = expData.map(e => e.id);
        const { data: splitData } = await supabase
          .from('expense_splits')
          .select('*')
          .in('expense_id', expIds);
        const map = {};
        expIds.forEach(id => { map[id] = []; });
        (splitData || []).forEach(s => {
          if (map[s.expense_id]) map[s.expense_id].push(s);
        });
        setSplits(map);
      } else {
        setSplits({});
      }

      // Past sessions for event_attendees split mode
      const { data: evData } = await supabase
        .from('events')
        .select('id, title, start_time')
        .eq('hosting_team_id', teamId)
        .lt('end_time', new Date().toISOString())
        .order('start_time', { ascending: false });
      setSessions(evData || []);
    } catch (err) {
      setError(err.message || 'Failed to load financials.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Split preview calculation ─────────────────────────────────────────────
  useEffect(() => {
    if (!addOpen) return;
    calcPreview();
  }, [form.split_mode, form.event_id, form.custom_members, form.total_amount, members]);

  const calcPreview = async () => {
    const amount = parseFloat(form.total_amount);
    if (!amount || amount <= 0) { setPreview([]); return; }

    let splitMembers = [];

    if (form.split_mode === 'full_team') {
      splitMembers = members.map(m => m.user_id);

    } else if (form.split_mode === 'event_attendees') {
      if (!form.event_id) { setPreview([]); return; }
      // Try attendance marks first, fall back to confirmed RSVPs
      const { data: marks } = await supabase
        .from('event_attendance_marks')
        .select('user_id')
        .eq('event_id', form.event_id)
        .eq('team_id', teamId)
        .eq('status', 'present');

      if (marks && marks.length > 0) {
        splitMembers = marks.map(m => m.user_id);
      } else {
        const memberIds = members.map(m => m.user_id);
        const { data: rsvps } = await supabase
          .from('event_attendees')
          .select('user_id')
          .eq('event_id', form.event_id)
          .eq('status', 'confirmed')
          .in('user_id', memberIds);
        splitMembers = (rsvps || []).map(r => r.user_id);
      }

    } else if (form.split_mode === 'custom') {
      splitMembers = form.custom_members;
    }

    if (splitMembers.length === 0) { setPreview([]); return; }

    const share = amount / splitMembers.length;
    setPreview(
      splitMembers.map(uid => ({
        user_id: uid,
        name: profileMap[uid]?.full_name || profileMap[uid]?.username || 'Unknown',
        share: share.toFixed(2),
      }))
    );
  };

  // ── Add expense ────────────────────────────────────────────────────────────
  const handleAddExpense = async () => {
    setFormError('');
    if (!form.title.trim())      return setFormError('Title is required.');
    const amount = parseFloat(form.total_amount);
    if (!amount || amount <= 0)  return setFormError('Amount must be greater than 0.');
    if (!form.expense_date)      return setFormError('Date is required.');
    if (preview.length === 0)    return setFormError('No members to split among. Check your split settings.');

    setSaving(true);
    try {
      const { data: expRow, error: expErr } = await supabase
        .from('team_expenses')
        .insert([{
          team_id:      teamId,
          title:        form.title.trim(),
          description:  form.description.trim() || null,
          total_amount: amount,
          category:     form.category,
          expense_date: form.expense_date,
          split_mode:   form.split_mode,
          event_id:     form.split_mode === 'event_attendees' ? form.event_id || null : null,
          created_by:   user.uid,
        }])
        .select()
        .single();
      if (expErr) throw expErr;

      const splitRows = preview.map(p => ({
        expense_id:  expRow.id,
        user_id:     p.user_id,
        amount_owed: parseFloat(p.share),
        amount_paid: 0,
      }));

      const { error: splitErr } = await supabase.from('expense_splits').insert(splitRows);
      if (splitErr) throw splitErr;

      setAddOpen(false);
      setForm(EMPTY_FORM);
      setPreview([]);
      await fetchData();
    } catch (err) {
      setFormError(err.message || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  // ── Mark paid ──────────────────────────────────────────────────────────────
  const handleMarkPaid = async (splitId, fullAmount) => {
    try {
      await supabase
        .from('expense_splits')
        .update({ amount_paid: fullAmount, paid_at: new Date().toISOString() })
        .eq('id', splitId);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to update payment.');
    }
  };

  const handleMarkUnpaid = async (splitId) => {
    try {
      await supabase
        .from('expense_splits')
        .update({ amount_paid: 0, paid_at: null })
        .eq('id', splitId);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to update payment.');
    }
  };

  // ── Delete expense ─────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await supabase.from('team_expenses').delete().eq('id', deleteId);
      setDeleteId(null);
      await fetchData();
    } catch (err) {
      setError(err.message || 'Failed to delete expense.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Summary numbers ────────────────────────────────────────────────────────
  const totalSpent     = expenses.reduce((s, e) => s + Number(e.total_amount), 0);
  const totalCollected = Object.values(splits).flat().reduce((s, sp) => s + Number(sp.amount_paid), 0);
  const outstanding    = totalSpent - totalCollected;

  const myUid = user?.uid;
  const mySplits   = Object.values(splits).flat().filter(sp => sp.user_id === myUid);
  const myOwed     = mySplits.reduce((s, sp) => s + Number(sp.amount_owed), 0);
  const myPaid     = mySplits.reduce((s, sp) => s + Number(sp.amount_paid), 0);
  const myBalance  = myOwed - myPaid;

  const f = (key) => (e) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

      {/* ── Summary bar ── */}
      <Grid container spacing={2}>
        {[
          { label: 'Total Expenses', value: fmt(totalSpent),    color: 'text.primary'  },
          { label: 'Collected',      value: fmt(totalCollected), color: 'success.main'  },
          { label: 'Outstanding',    value: fmt(outstanding),    color: outstanding > 0 ? 'error.main' : 'success.main' },
        ].map(({ label, value, color }) => (
          <Grid size={{ xs: 12, sm: 4 }} key={label}>
            <Card sx={{ boxShadow: 2, textAlign: 'center', py: 2.5 }}>
              <Typography variant="h5" fontWeight="bold" color={color}>{value}</Typography>
              <Typography variant="caption" color="text.secondary" fontWeight="bold"
                sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
              </Typography>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* My balance chip */}
      {myOwed > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalanceWalletIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">Your balance:</Typography>
          <Chip
            label={myBalance <= 0 ? '✓ All clear' : `You owe ${fmt(myBalance)}`}
            color={myBalance <= 0 ? 'success' : 'error'}
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
      )}

      {/* ── Expenses list ── */}
      <Card sx={{ boxShadow: 2 }}>
        <Box sx={{
          px: 3, py: 2.5, bgcolor: 'grey.50',
          borderBottom: '1px solid', borderColor: 'divider',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Typography variant="h6" fontWeight="bold">
            Expenses{' '}
            <Typography component="span" variant="body2" color="text.secondary">
              ({expenses.length})
            </Typography>
          </Typography>
          {canFinance && (
            <Button size="small" variant="contained" startIcon={<AddIcon />}
              onClick={() => { setForm(EMPTY_FORM); setPreview([]); setFormError(''); setAddOpen(true); }}
              sx={{ fontWeight: 'bold' }}>
              Add Expense
            </Button>
          )}
        </Box>

        {expenses.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 7 }}>
            <AccountBalanceWalletIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="body1" color="text.secondary">No expenses recorded yet.</Typography>
          </Box>
        ) : (
          <CardContent sx={{ p: 0 }}>
            {expenses.map((exp, idx) => {
              const expSplits   = splits[exp.id] || [];
              const totalPaid   = expSplits.reduce((s, sp) => s + Number(sp.amount_paid), 0);
              const paidCount   = expSplits.filter(sp => Number(sp.amount_paid) >= Number(sp.amount_owed)).length;
              const isExpanded  = expanded[exp.id];
              const cat         = catConfig(exp.category);
              const mySplit     = expSplits.find(sp => sp.user_id === myUid);

              return (
                <React.Fragment key={exp.id}>
                  {/* Expense row */}
                  <Box sx={{ px: 3, py: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
                      {/* Category + title */}
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                          <Chip label={cat.label} size="small" color={cat.color}
                            sx={{ fontWeight: 'bold', height: 20, fontSize: '0.68rem' }} />
                          <Typography variant="caption" color="text.disabled">
                            {new Date(exp.expense_date).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Typography>
                        </Box>
                        <Typography variant="subtitle2" fontWeight="bold">{exp.title}</Typography>
                        {exp.description && (
                          <Typography variant="caption" color="text.secondary">{exp.description}</Typography>
                        )}

                        {/* Payment summary */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
                          <Chip
                            icon={paidCount === expSplits.length && expSplits.length > 0
                              ? <CheckCircleIcon sx={{ fontSize: '13px !important' }} />
                              : <PendingIcon sx={{ fontSize: '13px !important' }} />}
                            label={`${paidCount}/${expSplits.length} paid`}
                            size="small"
                            color={paidCount === expSplits.length && expSplits.length > 0 ? 'success' : 'warning'}
                            variant="outlined"
                            sx={{ fontWeight: 'bold', height: 20, fontSize: '0.68rem' }}
                          />
                          {mySplit && (
                            <Chip
                              label={Number(mySplit.amount_paid) >= Number(mySplit.amount_owed)
                                ? `You: paid ${fmt(mySplit.amount_owed)}`
                                : `You owe ${fmt(Number(mySplit.amount_owed) - Number(mySplit.amount_paid))}`}
                              size="small"
                              color={Number(mySplit.amount_paid) >= Number(mySplit.amount_owed) ? 'success' : 'error'}
                              sx={{ fontWeight: 'bold', height: 20, fontSize: '0.68rem' }}
                            />
                          )}
                        </Box>
                      </Box>

                      {/* Amount + controls */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
                        <Typography variant="h6" fontWeight="bold">{fmt(exp.total_amount)}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {isTeamAdmin && (
                            <Tooltip title="Delete expense">
                              <IconButton size="small" color="error" onClick={() => setDeleteId(exp.id)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title={isExpanded ? 'Collapse' : 'View splits'}>
                            <IconButton size="small"
                              onClick={() => setExpanded(prev => ({ ...prev, [exp.id]: !prev[exp.id] }))}>
                              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                    </Box>

                    {/* Expanded splits */}
                    <Collapse in={isExpanded}>
                      <Box sx={{ mt: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                        {/* Table header */}
                        <Box sx={{
                          display: 'grid', gridTemplateColumns: '1fr auto auto',
                          px: 2, py: 1, bgcolor: 'grey.50',
                          borderBottom: '1px solid', borderColor: 'divider',
                        }}>
                          <Typography variant="caption" fontWeight="bold" color="text.secondary">Member</Typography>
                          <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ minWidth: 80, textAlign: 'right' }}>Owed</Typography>
                          <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ minWidth: 110, textAlign: 'right' }}>Status</Typography>
                        </Box>

                        {expSplits.length === 0 ? (
                          <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                            No splits recorded.
                          </Typography>
                        ) : (
                          expSplits.map((sp, sIdx) => {
                            const profile = profileMap[sp.user_id];
                            const isPaid  = Number(sp.amount_paid) >= Number(sp.amount_owed);
                            const isMe    = sp.user_id === myUid;

                            return (
                              <React.Fragment key={sp.id}>
                                <Box sx={{
                                  display: 'grid', gridTemplateColumns: '1fr auto auto',
                                  alignItems: 'center', px: 2, py: 1.25,
                                  bgcolor: isMe ? 'primary.50' : 'transparent',
                                }}>
                                  {/* Member */}
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                    <Avatar sx={{ width: 28, height: 28, bgcolor: 'grey.200', fontSize: '0.65rem', fontWeight: 'bold', flexShrink: 0 }}>
                                      {profile?.avatar_url
                                        ? <img src={profile.avatar_url} referrerPolicy="no-referrer" alt=""
                                            style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                                        : getInitials(profile?.full_name)}
                                    </Avatar>
                                    <Typography variant="body2" fontWeight={isMe ? 'bold' : 'normal'} noWrap>
                                      {profile?.full_name || 'Unknown'}
                                      {isMe && <Typography component="span" variant="caption" color="primary.main" sx={{ ml: 0.5 }}>(you)</Typography>}
                                    </Typography>
                                  </Box>

                                  {/* Amount */}
                                  <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 80, textAlign: 'right' }}>
                                    {fmt(sp.amount_owed)}
                                  </Typography>

                                  {/* Status + action */}
                                  <Box sx={{ minWidth: 110, display: 'flex', justifyContent: 'flex-end' }}>
                                    {isPaid ? (
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Chip icon={<CheckCircleIcon sx={{ fontSize: '12px !important' }} />}
                                          label="Paid" size="small" color="success"
                                          sx={{ fontWeight: 'bold', height: 22, fontSize: '0.68rem' }} />
                                        {canFinance && (
                                          <Tooltip title="Mark as unpaid">
                                            <IconButton size="small" onClick={() => handleMarkUnpaid(sp.id)}>
                                              <CancelIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                          </Tooltip>
                                        )}
                                      </Box>
                                    ) : (
                                      canFinance ? (
                                        <Button size="small" variant="outlined" color="success"
                                          onClick={() => handleMarkPaid(sp.id, sp.amount_owed)}
                                          sx={{ fontWeight: 'bold', height: 24, fontSize: '0.68rem', px: 1 }}>
                                          Mark Paid
                                        </Button>
                                      ) : (
                                        <Chip label="Unpaid" size="small" color="error" variant="outlined"
                                          sx={{ fontWeight: 'bold', height: 22, fontSize: '0.68rem' }} />
                                      )
                                    )}
                                  </Box>
                                </Box>
                                {sIdx < expSplits.length - 1 && <Divider />}
                              </React.Fragment>
                            );
                          })
                        )}

                        {/* Totals row */}
                        {expSplits.length > 0 && (
                          <Box sx={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            px: 2, py: 1, bgcolor: 'grey.50',
                            borderTop: '1px solid', borderColor: 'divider',
                          }}>
                            <Typography variant="caption" color="text.secondary" fontWeight="bold">
                              Total collected
                            </Typography>
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              {fmt(totalPaid)} / {fmt(exp.total_amount)}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Collapse>
                  </Box>
                  {idx < expenses.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* ── Add Expense Dialog ── */}
      <Dialog open={addOpen} onClose={() => !saving && setAddOpen(false)}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Add Expense</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

          <TextField fullWidth label="Title *" margin="normal"
            placeholder="e.g. State Championship registration"
            value={form.title} onChange={f('title')} />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Amount (₹) *" type="number" margin="normal"
                inputProps={{ min: 0.01, step: 0.01 }}
                value={form.total_amount} onChange={f('total_amount')} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth select label="Category" margin="normal"
                value={form.category} onChange={f('category')}>
                {CATEGORIES.map(c => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>

          <TextField fullWidth label="Date *" type="date" margin="normal"
            value={form.expense_date} onChange={f('expense_date')}
            InputLabelProps={{ shrink: true }} />

          <TextField fullWidth label="Description" margin="normal" multiline minRows={2}
            placeholder="Optional notes about this expense"
            value={form.description} onChange={f('description')} />

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">Split Among</Typography>
          </Divider>

          {/* Split mode selector */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {SPLIT_MODES.map(mode => (
              <Chip
                key={mode.value}
                label={mode.label}
                variant={form.split_mode === mode.value ? 'filled' : 'outlined'}
                color={form.split_mode === mode.value ? 'primary' : 'default'}
                onClick={() => setForm(prev => ({ ...prev, split_mode: mode.value, event_id: '', custom_members: [] }))}
                sx={{ fontWeight: 'bold', cursor: 'pointer' }}
              />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            {SPLIT_MODES.find(m => m.value === form.split_mode)?.desc}
          </Typography>

          {/* Event selector */}
          {form.split_mode === 'event_attendees' && (
            <FormControl fullWidth margin="dense" sx={{ mb: 1.5 }}>
              <InputLabel>Select Session</InputLabel>
              <Select label="Select Session" value={form.event_id} onChange={f('event_id')}>
                {sessions.length === 0
                  ? <MenuItem disabled>No past sessions</MenuItem>
                  : sessions.map(s => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.title} — {new Date(s.start_time).toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          )}

          {/* Custom member selector */}
          {form.split_mode === 'custom' && (
            <FormGroup sx={{ mb: 1.5 }}>
              {members.map(m => {
                const profile = profileMap[m.user_id];
                return (
                  <FormControlLabel
                    key={m.user_id}
                    control={
                      <Checkbox
                        size="small"
                        checked={form.custom_members.includes(m.user_id)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...form.custom_members, m.user_id]
                            : form.custom_members.filter(id => id !== m.user_id);
                          setForm(prev => ({ ...prev, custom_members: next }));
                        }}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 24, height: 24, bgcolor: 'grey.200', fontSize: '0.6rem', fontWeight: 'bold' }}>
                          {profile?.avatar_url
                            ? <img src={profile.avatar_url} referrerPolicy="no-referrer" alt=""
                                style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                            : getInitials(profile?.full_name)}
                        </Avatar>
                        <Typography variant="body2">{profile?.full_name || 'Unknown'}</Typography>
                      </Box>
                    }
                  />
                );
              })}
            </FormGroup>
          )}

          {/* Split preview */}
          {preview.length > 0 && (
            <Box sx={{ bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
              <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" fontWeight="bold" color="text.secondary">
                  SPLIT PREVIEW — {fmt(form.total_amount)} ÷ {preview.length} = {fmt(parseFloat(form.total_amount) / preview.length)} each
                </Typography>
              </Box>
              {preview.map((p, idx) => (
                <React.Fragment key={p.user_id}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 0.75 }}>
                    <Typography variant="body2">{p.name}</Typography>
                    <Typography variant="body2" fontWeight="bold">{fmt(p.share)}</Typography>
                  </Box>
                  {idx < preview.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleAddExpense} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
            sx={{ fontWeight: 'bold', px: 4 }}>
            {saving ? 'Saving…' : 'Add Expense'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog open={Boolean(deleteId)} onClose={() => !deleteLoading && setDeleteId(null)}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>Delete Expense?</DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary">
            This will permanently delete the expense and all its payment records.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={() => setDeleteId(null)} disabled={deleteLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleteLoading}
            startIcon={deleteLoading ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
            sx={{ fontWeight: 'bold', px: 3 }}>
            {deleteLoading ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
