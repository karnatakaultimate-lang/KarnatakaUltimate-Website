export const REDEMPTION_CATEGORIES = [
  { label: 'Membership',     color: '#00695c', bg: '#e0f2f1' },
  { label: 'Store Discount', color: '#e65100', bg: '#fff3e0' },
  { label: 'Event Perk',     color: '#2e7d32', bg: '#e8f5e9' },
  { label: 'Merchandise',    color: '#283593', bg: '#e8eaf6' },
  { label: 'Other',          color: '#757575', bg: '#f5f5f5' },
];

export const getRedemptionCategoryStyle = (categoryLabel) => {
  const cat = REDEMPTION_CATEGORIES.find(c => c.label === categoryLabel);
  return cat ? { bgcolor: cat.bg, color: cat.color, borderColor: cat.color } : {};
};
