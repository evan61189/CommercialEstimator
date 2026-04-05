export function ConnectionStatus({ status }: { status: 'connecting' | 'connected' | 'disconnected' }) {
  const config = {
    connecting: { color: 'bg-amber-400', label: 'Connecting...' },
    connected: { color: 'bg-emerald-400', label: 'Live' },
    disconnected: { color: 'bg-red-400', label: 'Disconnected' },
  }[status];

  return (
    <span className="flex items-center gap-2 text-xs text-gray-400">
      <span className={`w-2 h-2 rounded-full ${config.color} ${status === 'connected' ? 'animate-pulse-slow' : ''}`} />
      {config.label}
    </span>
  );
}
