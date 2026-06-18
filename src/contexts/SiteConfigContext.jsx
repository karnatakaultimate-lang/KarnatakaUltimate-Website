import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const SiteConfigContext = createContext({
  config: {},
  loading: true,
  updateConfig: async () => {},
});

export const useSiteConfig = () => useContext(SiteConfigContext);

export const SiteConfigProvider = ({ children }) => {
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();

    // Live-sync: re-fetch whenever any row in site_config changes.
    // This ensures module toggles updated by an admin propagate instantly
    // to all other active sessions without requiring a page refresh.
    const channel = supabase
      .channel('site_config_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_config' }, () => {
        fetchConfig();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchConfig = async () => {
    try {
      const { data } = await supabase.from('site_config').select('*');
      const configMap = {};
      (data || []).forEach(row => {
        // Convert string 'true'/'false' to boolean
        configMap[row.key] = row.value === 'true' ? true : row.value === 'false' ? false : row.value;
      });
      setConfig(configMap);
    } catch (err) {
      console.error('Error fetching site config:', err);
    } finally {
      setLoading(false);
    }
  };

  // Admin only — update a config key in Supabase
  const updateConfig = async (key, value) => {
    const { error } = await supabase
      .from('site_config')
      .update({ value: String(value) })
      .eq('key', key);
    if (error) throw error;
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <SiteConfigContext.Provider value={{ config, loading, updateConfig }}>
      {children}
    </SiteConfigContext.Provider>
  );
};
