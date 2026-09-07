import React, { useState, useRef } from 'react';
import {
  Plus,
  Star,
  Copy,
  Trash2,
  Edit2,
  Download,
  Upload,
  Radio,
  Shield,
  Zap,
} from 'lucide-react';
import { Profile } from '../types';
import { apiClient } from '../api/client';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { ConfirmModal } from '../components/ConfirmModal';

interface ProfilesPageProps {
  profiles: Profile[];
  onRefresh: () => void;
}

export const ProfilesPage: React.FC<ProfilesPageProps> = ({ profiles, onRefresh }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Partial<Profile> | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);
  const [isApplying, setIsApplying] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenCreate = () => {
    setEditingProfile({
      name: '',
      provider: 'protonvpn',
      country: '',
      city: '',
      protocol: 'wireguard',
      port_forwarding: true,
      block_malicious: true,
      block_ads: true,
      block_surveillance: false,
      is_favorite: false,
    });
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (profile: Profile) => {
    setEditingProfile({ ...profile });
    setIsEditorOpen(true);
  };

  const handleDuplicate = async (profile: Profile) => {
    try {
      const copyData: Partial<Profile> = {
        ...profile,
        name: `${profile.name} (Copy)`,
        is_favorite: false,
      };
      delete copyData.id;
      await apiClient.createProfile(copyData);
      showToast('Profile duplicated', 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed duplicating profile', 'error');
    }
  };

  const handleToggleFavorite = async (profile: Profile) => {
    try {
      await apiClient.updateProfile(profile.id, {
        ...profile,
        is_favorite: !profile.is_favorite,
      });
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed updating favorite', 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile || !editingProfile.name) {
      showToast('Please enter a profile name', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingProfile.id) {
        await apiClient.updateProfile(editingProfile.id, editingProfile);
        showToast('Profile updated', 'success');
      } else {
        await apiClient.createProfile(editingProfile);
        showToast('Profile created', 'success');
      }
      setIsEditorOpen(false);
      setEditingProfile(null);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed saving profile', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!profileToDelete) return;
    try {
      setIsSubmitting(true);
      await apiClient.deleteProfile(profileToDelete.id);
      showToast(`Deleted profile '${profileToDelete.name}'`, 'info');
      setProfileToDelete(null);
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed deleting profile', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApply = async (profile: Profile) => {
    try {
      setIsApplying(profile.id);
      await apiClient.applyProfile(profile.id);
      showToast(`Applied profile '${profile.name}'`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed applying profile', 'error');
    } finally {
      setIsApplying(null);
    }
  };

  const handleExportJSON = () => {
    const jsonStr = JSON.stringify(profiles, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gluetun-profiles.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported profiles to JSON', 'success');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Profile[];
      if (!Array.isArray(parsed)) {
        throw new Error('Import file must be an array of profiles');
      }

      for (const p of parsed) {
        delete (p as any).id;
        await apiClient.createProfile(p);
      }

      showToast(`Imported ${parsed.length} profiles`, 'success');
      onRefresh();
    } catch (err: any) {
      showToast(err.message || 'Failed importing profiles', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Connection Profiles</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Store preconfigured non-secret connection presets for rapid switching.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json,application/json"
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            <Upload size={16} />
            Import JSON
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem' }}
          >
            <Download size={16} />
            Export JSON
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="btn btn-primary"
            style={{ fontSize: '0.85rem' }}
          >
            <Plus size={16} />
            New Profile
          </button>
        </div>
      </div>

      {/* Profiles Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {profiles.map((p) => (
          <div
            key={p.id}
            className="glass-panel"
            style={{
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{p.name}</h3>
                  {p.is_favorite && <Star size={16} fill="var(--color-warning)" color="var(--color-warning)" />}
                </div>

                <div style={{ display: 'flex', gap: '0.2rem' }}>
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(p)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
                    title="Toggle Favorite"
                  >
                    <Star size={16} fill={p.is_favorite ? 'var(--color-warning)' : 'none'} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(p)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
                    title="Duplicate Profile"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(p)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)' }}
                    title="Edit Profile"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileToDelete(p)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-danger)' }}
                    title="Delete Profile"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Profile Config Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div>
                  Country:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {p.country || 'Any / Best Available'}
                  </strong>
                </div>
                <div>
                  Protocol:{' '}
                  <strong style={{ color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                    {p.protocol}
                  </strong>
                </div>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                {p.port_forwarding && (
                  <span className="badge badge-connected" style={{ fontSize: '0.65rem' }}>
                    <Radio size={11} /> Port Forwarding
                  </span>
                )}
                {p.block_malicious && (
                  <span className="badge badge-demo" style={{ fontSize: '0.65rem' }}>
                    <Shield size={11} /> Malicious Block
                  </span>
                )}
                {p.block_ads && (
                  <span className="badge badge-connecting" style={{ fontSize: '0.65rem' }}>
                    Ad Block
                  </span>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {p.last_used_at
                  ? `Used ${new Date(p.last_used_at).toLocaleDateString()}`
                  : 'Never used'}
              </span>

              <button
                type="button"
                onClick={() => handleApply(p)}
                disabled={isApplying === p.id}
                className="btn btn-primary"
                style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
              >
                <Zap size={14} />
                {isApplying === p.id ? 'Applying...' : 'Apply Profile'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Profile Create / Edit Modal */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={editingProfile?.id ? 'Edit Profile' : 'Create Connection Profile'}
        maxWidth="480px"
      >
        {editingProfile && (
          <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                Profile Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. India Fast P2P"
                value={editingProfile.name || ''}
                onChange={(e) => setEditingProfile({ ...editingProfile, name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                Country
              </label>
              <input
                type="text"
                placeholder="e.g. Switzerland, India, Japan"
                value={editingProfile.country || ''}
                onChange={(e) => setEditingProfile({ ...editingProfile, country: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.35rem', fontWeight: 600 }}>
                Protocol
              </label>
              <select
                value={editingProfile.protocol || 'wireguard'}
                onChange={(e) => setEditingProfile({ ...editingProfile, protocol: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem',
                }}
              >
                <option value="wireguard">WireGuard (Recommended)</option>
                <option value="openvpn_udp">OpenVPN UDP</option>
                <option value="openvpn_tcp">OpenVPN TCP</option>
              </select>
            </div>

            {/* Checkbox Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.5rem', fontSize: '0.85rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(editingProfile.port_forwarding)}
                  onChange={(e) => setEditingProfile({ ...editingProfile, port_forwarding: e.target.checked })}
                />
                Enable Port Forwarding (P2P NAT-PMP)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(editingProfile.block_malicious)}
                  onChange={(e) => setEditingProfile({ ...editingProfile, block_malicious: e.target.checked })}
                />
                Block Malicious Domains
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(editingProfile.block_ads)}
                  onChange={(e) => setEditingProfile({ ...editingProfile, block_ads: e.target.checked })}
                />
                Block Advertisements
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
              >
                {isSubmitting ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(profileToDelete)}
        onClose={() => setProfileToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Profile?"
        message={`Are you sure you want to delete profile '${profileToDelete?.name}'? This action cannot be undone.`}
        confirmLabel="Delete"
        isDestructive={true}
        isLoading={isSubmitting}
      />
    </div>
  );
};
