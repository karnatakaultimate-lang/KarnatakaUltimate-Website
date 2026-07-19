import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, Divider, Alert, CircularProgress } from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import GoogleIcon from '@mui/icons-material/Google';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebaseClient';
import { GoogleAuthProvider, signInWithPopup, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { supabase } from '../supabaseClient';

const actionCodeSettings = {
  // The URL the user will be redirected back to after clicking the magic link.
  url: window.location.origin + '/login',
  handleCodeInApp: true,
};

function Login() {
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  
  const [needsProfile, setNeedsProfile] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [fullName, setFullName] = useState('');

  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  // On mount, check if the user landed here from a magic link click
  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      setVerifying(true);
      // Retrieve the email the user used to request the link
      let storedEmail = window.localStorage.getItem('emailForSignIn');
      
      if (!storedEmail) {
        // If the user opened the link on a different device/browser, ask for email
        storedEmail = window.prompt('Please enter your email to confirm sign-in:');
      }

      if (storedEmail) {
        signInWithEmailLink(auth, storedEmail, window.location.href)
          .then(async (result) => {
            window.localStorage.removeItem('emailForSignIn');
            // Clean up the URL
            window.history.replaceState(null, '', '/login');
            
            // Check if returning user
            const { data } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', result.user.uid)
              .single();

            if (data) {
              navigate('/dashboard');
            } else {
              setFirebaseUser(result.user);
              setNeedsProfile(true);
              setVerifying(false);
            }
          })
          .catch((err) => {
            console.error('Email link sign-in error:', err);
            setError('This sign-in link is invalid or has expired. Please request a new one.');
            setVerifying(false);
          });
      } else {
        setError('Email is required to complete sign-in.');
        setVerifying(false);
      }
    }
  }, [navigate]);

  const createSupabaseProfile = async (user, name = null) => {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        { 
          id: user.uid, 
          username: (name ? name.replace(/\s+/g, '') : 'user') + Math.floor(Math.random() * 10000), 
          full_name: name || user.displayName || 'KUPA Member',
          phone_number: user.phoneNumber || null
        }
      ]);
      
    if (profileError && profileError.code !== '23505') { 
      console.error('Error creating Supabase profile:', profileError);
    }
  };

  const handleSendLink = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      // Save the email locally so we can retrieve it when the user clicks the link
      window.localStorage.setItem('emailForSignIn', email);
      setLinkSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send sign-in link.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await createSupabaseProfile(firebaseUser, fullName);
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to create profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await createSupabaseProfile(result.user, result.user.displayName);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to sign in with Google.');
    } finally {
      setLoading(false);
    }
  };

  // --- Loading screen while verifying magic link ---
  if (verifying) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', pt: 8 }}>
        <Card sx={{ maxWidth: 450, width: '100%', p: 3, boxShadow: 3, textAlign: 'center' }}>
          <CardContent>
            <CircularProgress sx={{ mb: 3 }} />
            <Typography variant="h5" fontWeight="bold">Verifying your link...</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Please wait while we sign you in.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // --- Complete Profile screen for new email-link users ---
  if (needsProfile) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', pt: 8 }}>
        <Card sx={{ maxWidth: 450, width: '100%', p: 3, boxShadow: 3 }}>
          <CardContent>
            <Typography variant="h4" gutterBottom fontWeight="bold" align="center"
              sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
              Complete Profile
            </Typography>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
              Just one last step! What should we call you?
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleCompleteProfile}>
              <TextField 
                fullWidth label="Full Name" variant="outlined" margin="normal" required 
                placeholder="e.g. Rahul Kumar"
                value={fullName} onChange={(e) => setFullName(e.target.value)}
              />
              <Button 
                fullWidth variant="contained" size="large" type="submit" 
                disabled={loading || !fullName}
                sx={{ mt: 3, py: 1.5, fontSize: '1.1rem' }}
              >
                {loading ? 'Saving...' : 'Enter Dashboard'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // --- Main Login screen ---
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', pt: 8 }}>
      <Card sx={{ maxWidth: 450, width: '100%', p: 3, boxShadow: 3 }}>
        <CardContent>
          <Typography variant="h4" gutterBottom fontWeight="bold" align="center"
            sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' } }}>
            Welcome to KUPA
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
            Sign in or create an account to continue
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {!linkSent ? (
            <form onSubmit={handleSendLink}>
              <TextField 
                fullWidth label="Email Address" variant="outlined" margin="normal" required 
                type="email"
                placeholder="e.g. you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
              <Button 
                fullWidth variant="contained" size="large" type="submit" 
                disabled={loading || !email}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <EmailIcon />}
                sx={{ mt: 2, mb: 2, py: 1.5, fontSize: '1.1rem' }}
              >
                {loading ? 'Sending...' : 'Send Magic Link'}
              </Button>
            </form>
          ) : (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <CheckCircleOutlinedIcon color="success" sx={{ fontSize: 56, mb: 2 }} />
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Check your inbox!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                We sent a sign-in link to <strong>{email}</strong>. Click the link in the email to log in.
              </Typography>
              <Button 
                fullWidth variant="text"
                onClick={() => { setLinkSent(false); setEmail(''); setError(''); }}
              >
                Use a different email
              </Button>
            </Box>
          )}

          <Divider sx={{ my: 3 }}>OR</Divider>

          <Button 
            fullWidth variant="outlined" size="large" 
            onClick={handleGoogleLogin}
            disabled={loading}
            startIcon={<GoogleIcon />}
            sx={{ mb: 1, py: 1.5, fontWeight: 'bold' }}
          >
            Continue with Google
          </Button>

        </CardContent>
      </Card>
    </Box>
  );
}

export default Login;
