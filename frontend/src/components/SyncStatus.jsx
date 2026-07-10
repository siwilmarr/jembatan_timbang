export default function SyncStatus({ pendingCount }) {
  const statusType = pendingCount === 0 ? "green" : pendingCount < 10 ? "yellow" : "red";
  const label = pendingCount === 0 ? "Semua data tersinkron" : `${pendingCount} data menunggu sinkronisasi`;

  return (
    <div className={`sync-status sync-status--${statusType}`}>
      <span className="sync-status__icon">☁</span>
      <span>{label}</span>
    </div>
  );
}
