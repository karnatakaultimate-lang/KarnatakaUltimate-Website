import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Button,
  CircularProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, Tabs, Tab, Grid
} from '@mui/material';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import StarIcon from '@mui/icons-material/Star';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelIcon from '@mui/icons-material/Cancel';
import { supabase } from '../supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { REDEMPTION_CATEGORIES, getRedemptionCategoryStyle } from '../constants/redemptionCategories';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ pt: 3 }}>{children}</Box> : null;
}

const STATUS_CONFIG = {
  pending:   { label: 'Pending',   color: 'warning', Icon: HourglassEmptyIcon },
  fulfilled: { label: 'Fulfilled', color: 'success', Icon: CheckCircleIcon    },
  rejected:  { label: 'Rejected',  color: 'error',   Icon: CancelIcon         },
};

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });

function Redeem() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [points, setPoints] = useState(null);
  const [items, setItems] = useState([]);
  const [myRedemptions, setMyRedemptions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [redemptionsLoading, setRedemptionsLoading] = useState(true);

  // Redeem dialog
  const [redeemDialog, setRedeemDialog] = useState({ open: false, item: null });
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemError, setRedeemError] = useState('');
  const [redeemSuccess, setRedeemSuccess] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchItems();
    fetchBalance();
    fetchMyRedemptions();
  }, [user]);

  const fetchBalance = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('reward_points')
      .eq('id', user.uid)
      .single();
    setPoints(data?.reward_points ?? 0);
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('redemption_items')
        .select('*')
        .eq('is_active', true)
        .order('points_cost', { ascending: true });
      if (error) throw error;
      setItems(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchMyRedemptions = async () => {
    setRedemptionsLoading(true);
    try {
      const { data, error } = await supabase
        .from('redemptions')
        .select('*, redemption_items(title, category, points_cost)')
        .eq('user_id', user.uid)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMyRedemptions(data || []);
    } catch (err) { console.error(err); }
    finally { setRedemptionsLoading(false); }
  };

  const openRedeemDialog = (item) => {
    setRedeemError('');
    setRedeemSuccess('');
    setRedeemDialog({ open: true, item });
  };

  const handleRedeem = async () => {
    const item = redeemDialog.item;
    setRedeemLoading(true);
    setRedeemError('');
    try {
      const { data, error } = await supabase.rpc('request_redemption', {
        p_user_id: user.uid,
        p_item_id: item.id,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const autoFulfilled = data?.status === 'fulfilled';
      setRedeemSuccess(autoFulfilled
        ? 'Redemption confirmed!'
        : 'Redemption request submitted! An admin will review and fulfil it shortly.');
      await fetchBalance();
      await fetchMyRedemptions();
    } catch (err) {
      setRedeemError(err.message || 'Failed to submit redemption. Please try again.');
    } finally {
      setRedeemLoading(false);
    }
  };

  const filteredItems = selectedCategory
    ? items.filter(i => i.category === selectedCategory)
    : items;

  const pendingCount = myRedemptions.filter(r => r.status === 'pending').length;

  if (!user) {
    return (
      <Box sx={{ maxWidth: 700, mx: 'auto', p: 3 }}>
        <Alert severity="info">Please log in to view redemption options.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <CardGiftcardIcon sx={{ color: 'primary.main', fontSize: 32, mt: 0.5 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight="bold">Redeem Points</Typography>
          <Typography variant="body2" color="text.secondary">
            Exchange your earned points for memberships, discounts, and more.
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
            <StarIcon sx={{ color: 'warning.main', fontSize: 22 }} />
            {points === null ? (
              <CircularProgress size={18} />
            ) : (
              <Typography variant="h6" fontWeight="bold" color="warning.dark">
                {points.toLocaleString()} pts
              </Typography>
            )}
          </Box>
          <Typography variant="caption" color="text.secondary">Your balance</Typography>
        </Box>
      </Box>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Catalog" />
          <Tab label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              My Redemptions
              {pendingCount > 0 && (
                <Chip label={pendingCount} size="small" color="warning"
                  sx={{ height: 18, fontSize: '0.65rem' }} />
              )}
            </Box>
          } />
        </Tabs>
      </Box>

      {/* ── Catalog ────────────────────────────────────────────────────── */}
      <TabPanel value={activeTab} index={0}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
          <Chip
            label="All"
            onClick={() => setSelectedCategory('')}
            variant={selectedCategory === '' ? 'filled' : 'outlined'}
            color={selectedCategory === '' ? 'primary' : 'default'}
          />
          {REDEMPTION_CATEGORIES.map(cat => (
            <Chip
              key={cat.label}
              label={cat.label}
              onClick={() => setSelectedCategory(cat.label === selectedCategory ? '' : cat.label)}
              variant={selectedCategory === cat.label ? 'filled' : 'outlined'}
              sx={selectedCategory === cat.label
                ? { bgcolor: cat.bg, color: cat.color, borderColor: cat.color }
                : {}}
            />
          ))}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : filteredItems.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CardGiftcardIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="body1" color="text.secondary">
              {selectedCategory ? 'No items in this category.' : 'No redemption items available yet.'}
            </Typography>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {filteredItems.map(item => {
              const canAfford = points !== null && points >= item.points_cost;
              const catStyle = getRedemptionCategoryStyle(item.category);
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.id}>
                  <Card sx={{
                    height: '100%', display: 'flex', flexDirection: 'column',
                    boxShadow: 2, opacity: canAfford ? 1 : 0.65,
                  }}>
                    <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 2.5 }}>
                      <Chip
                        label={item.category}
                        size="small" variant="outlined"
                        sx={{ ...catStyle, mb: 1.5, fontSize: '0.7rem', alignSelf: 'flex-start' }}
                      />
                      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        {item.name}
                      </Typography>
                      {item.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          {item.description}
                        </Typography>
                      )}
                      <Box sx={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'space-between', mt: 'auto', pt: 2,
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <StarIcon sx={{ color: 'warning.main', fontSize: 18 }} />
                          <Typography variant="subtitle2" fontWeight="bold" color="warning.dark">
                            {item.points_cost.toLocaleString()} pts
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          variant={canAfford ? 'contained' : 'outlined'}
                          disabled={!canAfford}
                          onClick={() => openRedeemDialog(item)}
                          sx={{ fontWeight: 'bold' }}
                        >
                          {canAfford ? 'Redeem' : 'Not enough pts'}
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </TabPanel>

      {/* ── My Redemptions ─────────────────────────────────────────────── */}
      <TabPanel value={activeTab} index={1}>
        {redemptionsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : myRedemptions.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <CardGiftcardIcon sx={{ fontSize: 52, color: 'text.disabled', mb: 1.5 }} />
            <Typography variant="body1" color="text.secondary">
              No redemptions yet. Browse the catalog to get started.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {myRedemptions.map(r => {
              const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
              const catStyle = getRedemptionCategoryStyle(r.redemption_items?.category);
              return (
                <Card key={r.id} sx={{ boxShadow: 1 }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{
                      display: 'flex', alignItems: 'flex-start',
                      justifyContent: 'space-between', gap: 1, flexWrap: 'wrap',
                    }}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="bold">
                          {r.redemption_items?.title ?? 'Unknown item'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                          {r.redemption_items?.category && (
                            <Chip label={r.redemption_items.category} size="small" variant="outlined"
                              sx={{ ...catStyle, height: 18, fontSize: '0.65rem' }} />
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <StarIcon sx={{ color: 'warning.main', fontSize: 14 }} />
                            <Typography variant="caption" fontWeight="bold" color="warning.dark">
                              {r.redemption_items?.points_cost?.toLocaleString()} pts
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Chip
                        icon={<sc.Icon sx={{ fontSize: '14px !important' }} />}
                        label={sc.label}
                        size="small"
                        color={sc.color}
                        sx={{ fontWeight: 'bold', fontSize: '0.75rem' }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.disabled" sx={{ mt: 0.75, display: 'block' }}>
                      Requested {fmtDate(r.created_at)}
                    </Typography>
                    {r.admin_notes && (
                      <Alert severity={r.status === 'rejected' ? 'error' : 'info'} sx={{ mt: 1, py: 0.5 }}>
                        {r.admin_notes}
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </TabPanel>

      {/* ── Redeem Dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={redeemDialog.open}
        onClose={() => !redeemLoading && setRedeemDialog({ open: false, item: null })}
        maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Confirm Redemption</DialogTitle>
        <DialogContent>
          {redeemError && <Alert severity="error" sx={{ mb: 2 }}>{redeemError}</Alert>}
          {redeemSuccess ? (
            <Alert severity="success">{redeemSuccess}</Alert>
          ) : (
            <>
              <Typography variant="body1" gutterBottom>
                You're about to redeem <strong>{redeemDialog.item?.title}</strong>.
              </Typography>
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2, mt: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Cost</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <StarIcon sx={{ color: 'warning.main', fontSize: 16 }} />
                    <Typography variant="body2" fontWeight="bold" color="warning.dark">
                      {redeemDialog.item?.points_cost?.toLocaleString()} pts
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Balance after</Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {points !== null && redeemDialog.item
                      ? (points - redeemDialog.item.points_cost).toLocaleString()
                      : '—'} pts
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                Points are deducted immediately. An admin will review and fulfil your request.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 1 }}>
          {redeemSuccess ? (
            <Button variant="contained" onClick={() => setRedeemDialog({ open: false, item: null })}
              sx={{ fontWeight: 'bold' }}>
              Done
            </Button>
          ) : (
            <>
              <Button onClick={() => setRedeemDialog({ open: false, item: null })} disabled={redeemLoading}>
                Cancel
              </Button>
              <Button
                variant="contained" onClick={handleRedeem} disabled={redeemLoading}
                startIcon={redeemLoading ? <CircularProgress size={16} color="inherit" /> : null}
                sx={{ fontWeight: 'bold', px: 3 }}
              >
                {redeemLoading ? 'Submitting...' : 'Confirm'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Redeem;
