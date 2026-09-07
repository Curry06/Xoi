import type { ConnectionState } from '../types/index.ts';

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatRate(bytesPerSec: number): string {
  if (bytesPerSec === 0) return '0 KB/s';
  const k = 1024;
  if (bytesPerSec < k) return `${bytesPerSec} B/s`;
  if (bytesPerSec < k * k) return `${(bytesPerSec / k).toFixed(1)} KB/s`;
  return `${(bytesPerSec / (k * k)).toFixed(1)} MB/s`;
}

export function formatUptime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function getStateBadgeClass(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'badge-connected';
    case 'connecting':
    case 'reconnecting':
      return 'badge-connecting';
    case 'disconnected':
      return 'badge-disconnected';
    case 'degraded':
      return 'badge-degraded';
    case 'error':
      return 'badge-error';
    default:
      return 'badge-disconnected';
  }
}
