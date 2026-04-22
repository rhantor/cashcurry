// Segment layout for entry-data. Exists so co-located error.js / loading.js
// boundaries apply to every entry-data subroute (sales, cost, deposit, etc.).
export default function EntryDataLayout({ children }) {
  return children;
}
