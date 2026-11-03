import React from 'react';
import {
  Box, Typography, Card, CardContent, Chip, Button, Divider, CircularProgress,
} from '@mui/material';
import LockOpenIcon       from '@mui/icons-material/LockOpen';
import HowToRegIcon       from '@mui/icons-material/HowToReg';
import LocationOnIcon     from '@mui/icons-material/LocationOn';
import PersonIcon         from '@mui/icons-material/Person';
import ContactPhoneIcon   from '@mui/icons-material/ContactPhone';
import GroupsIcon         from '@mui/icons-material/Groups';
import PersonAddIcon      from '@mui/icons-material/PersonAdd';
import ExitToAppIcon      from '@mui/icons-material/ExitToApp';
import EditIcon           from '@mui/icons-material/Edit';
import DeleteIcon         from '@mui/icons-material/Delete';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import SendIcon           from '@mui/icons-material/Send';
import CancelIcon         from '@mui/icons-material/Cancel';

export default function TeamOverviewTab({
  team, members, myRole, isTeamAdmin, isMember,
  hasPendingRequest, user, navigate,
  onJoin, onRequestJoin, onCancelRequest, onLeave,
  onOpenEdit, onOpenDelete,
  actionLoading, fmtDate,
}) {
  const isRequest  = team.join_mode === 'request';
  const isOpenJoin = !isRequest;
  const adminCount = members.filter(m => m.role === 'admin').length;
  const isLastAdmin = myRole === 'admin' && adminCount <= 1;

  return (
    <Card sx={{ boxShadow: 2, borderRadius: 2 }}>
      <CardContent sx={{ p: 3 }}>
        {/* Join mode badge */}
        <Chip
          icon={isRequest
            ? <HowToRegIcon sx={{ fontSize: '14px !important' }} />
            : <LockOpenIcon sx={{ fontSize: '14px !important' }} />}
          label={isRequest ? 'By Request' : 'Open to join'}
          size="small"
          color={isRequest ? 'warning' : 'success'}
          sx={{ mb: 2, fontWeight: 'bold' }}
        />

        {team.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.7 }}>
            {team.description}
          </Typography>
        )}

        <Divider sx={{ mb: 2 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupsIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Typography>
          </Box>
          {team.session_location && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LocationOnIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">{team.session_location}</Typography>
            </Box>
          )}
          {team.contact_person && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PersonIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">{team.contact_person}</Typography>
            </Box>
          )}
          {team.contact_info && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ContactPhoneIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
              <Typography variant="body2" color="text.secondary">{team.contact_info}</Typography>
            </Box>
          )}
        </Box>

        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5 }}>
          Created {fmtDate(team.created_at)}
        </Typography>

        {/* Action buttons */}
        <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {!user ? (
            <Button fullWidth variant="contained" onClick={() => navigate('/login')} sx={{ fontWeight: 'bold' }}>
              Login to Join
            </Button>

          ) : isMember ? (
            <>
              {myRole === 'admin' && (
                <Chip
                  icon={<AdminPanelSettingsIcon sx={{ fontSize: '16px !important' }} />}
                  label="You are an admin"
                  color="warning"
                  sx={{ fontWeight: 'bold', justifyContent: 'flex-start' }}
                />
              )}
              {isTeamAdmin && (
                <Button fullWidth variant="outlined" startIcon={<EditIcon />}
                  onClick={onOpenEdit} sx={{ fontWeight: 'bold' }}>
                  Edit Team Info
                </Button>
              )}
              {isLastAdmin ? (
                <Typography variant="caption" color="text.secondary"
                  sx={{ textAlign: 'center', py: 0.5, fontStyle: 'italic' }}>
                  Assign another admin before leaving.
                </Typography>
              ) : (
                <Button fullWidth variant="outlined" color="error"
                  startIcon={actionLoading ? <CircularProgress size={16} /> : <ExitToAppIcon />}
                  onClick={onLeave} disabled={actionLoading} sx={{ fontWeight: 'bold' }}>
                  Leave Team
                </Button>
              )}
              {isTeamAdmin && (
                <Button fullWidth variant="text" color="error" startIcon={<DeleteIcon />}
                  onClick={onOpenDelete} sx={{ fontWeight: 'bold' }}>
                  Delete Team
                </Button>
              )}
            </>

          ) : hasPendingRequest ? (
            <>
              <Chip
                icon={<SendIcon sx={{ fontSize: '15px !important' }} />}
                label="Request sent — awaiting approval"
                color="warning"
                sx={{ fontWeight: 'bold', justifyContent: 'flex-start' }}
              />
              <Button fullWidth variant="outlined" color="error"
                startIcon={actionLoading ? <CircularProgress size={16} /> : <CancelIcon />}
                onClick={onCancelRequest} disabled={actionLoading} sx={{ fontWeight: 'bold' }}>
                Cancel Request
              </Button>
            </>

          ) : isOpenJoin ? (
            <Button fullWidth variant="contained"
              startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <PersonAddIcon />}
              onClick={onJoin} disabled={actionLoading} sx={{ fontWeight: 'bold' }}>
              Join Team
            </Button>

          ) : (
            <Button fullWidth variant="contained" color="warning"
              startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <HowToRegIcon />}
              onClick={onRequestJoin} disabled={actionLoading} sx={{ fontWeight: 'bold' }}>
              Request to Join
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
