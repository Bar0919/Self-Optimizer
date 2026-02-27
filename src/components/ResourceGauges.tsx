
// @/components/ResourceGauges.tsx

export const ResourceGauges = () => {
  return (
    <div style={{ border: '1px solid #ccc', padding: '1rem', display: 'flex', gap: '1rem' }}>
      <div>
        <label>HP (体力)</label>
        <progress value="80" max="100"></progress>
        <span>80%</span>
      </div>
      <div>
        <label>MP (精神力)</label>
        <progress value="65" max="100"></progress>
        <span>65%</span>
      </div>
    </div>
  );
};
