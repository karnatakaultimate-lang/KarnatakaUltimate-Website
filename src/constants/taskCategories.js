export const TASK_CATEGORIES = [
  { label: 'Field Setup',         color: '#2e7d32', bg: '#e8f5e9' },
  { label: 'Media & Photography', color: '#0277bd', bg: '#e1f5fe' },
  { label: 'Social Media',        color: '#6a1b9a', bg: '#f3e5f5' },
  { label: 'Administrative',      color: '#546e7a', bg: '#eceff1' },
  { label: 'Outreach',            color: '#e65100', bg: '#fff3e0' },
  { label: 'Design',              color: '#283593', bg: '#e8eaf6' },
  { label: 'Logistics',           color: '#4e342e', bg: '#efebe9' },
  { label: 'Fundraising',         color: '#c62828', bg: '#ffebee' },
  { label: 'Training Support',    color: '#00695c', bg: '#e0f2f1' },
  { label: 'Other',               color: '#757575', bg: '#f5f5f5' },
];

export const getCategoryStyle = (categoryLabel) => {
  const cat = TASK_CATEGORIES.find(c => c.label === categoryLabel);
  return cat ? { bgcolor: cat.bg, color: cat.color, borderColor: cat.color } : {};
};
