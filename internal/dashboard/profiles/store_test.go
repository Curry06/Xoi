package profiles

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_Profile_Validation(t *testing.T) {
	t.Parallel()

	testCases := map[string]struct {
		profile     Profile
		expectError bool
		expectedErr error
	}{
		"valid_wireguard_profile": {
			profile: Profile{
				Name:     "Test Wireguard",
				Provider: "protonvpn",
				Protocol: "wireguard",
			},
			expectError: false,
		},
		"empty_name": {
			profile: Profile{
				Name:     "   ",
				Provider: "protonvpn",
				Protocol: "wireguard",
			},
			expectError: true,
			expectedErr: ErrInvalidProfileName,
		},
		"empty_provider": {
			profile: Profile{
				Name:     "My Profile",
				Provider: "   ",
				Protocol: "wireguard",
			},
			expectError: true,
			expectedErr: ErrInvalidProvider,
		},
		"invalid_protocol": {
			profile: Profile{
				Name:     "My Profile",
				Provider: "protonvpn",
				Protocol: "invalid_proto",
			},
			expectError: true,
			expectedErr: ErrInvalidProtocol,
		},
	}

	for name, testCase := range testCases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			profileCopy := testCase.profile
			err := profileCopy.Validate()
			if testCase.expectError {
				assert.Error(t, err)
				if testCase.expectedErr != nil {
					assert.ErrorIs(t, err, testCase.expectedErr)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func Test_Store_Operations(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	filePath := filepath.Join(tempDir, "profiles.json")

	store, err := NewStore(filePath)
	require.NoError(t, err)

	// List initial seeded defaults
	initialList := store.List()
	assert.NotEmpty(t, initialList)

	// Create new profile
	created, err := store.Create(Profile{
		Name:           "Custom Japan",
		Provider:       "protonvpn",
		Country:        "Japan",
		Protocol:       "wireguard",
		PortForwarding: true,
		IsFavorite:     true,
	})
	require.NoError(t, err)
	assert.NotEmpty(t, created.ID)
	assert.True(t, created.IsFavorite)

	// Get profile
	fetched, exists := store.Get(created.ID)
	assert.True(t, exists)
	assert.Equal(t, "Custom Japan", fetched.Name)

	// Update profile
	fetched.Name = "Custom Tokyo"
	updated, err := store.Update(created.ID, fetched)
	require.NoError(t, err)
	assert.Equal(t, "Custom Tokyo", updated.Name)

	// Mark used
	store.MarkUsed(created.ID)
	used, exists := store.Get(created.ID)
	assert.True(t, exists)
	assert.NotNil(t, used.LastUsedAt)

	// Export JSON
	exportedJSON, err := store.ExportJSON()
	require.NoError(t, err)
	assert.Contains(t, string(exportedJSON), "Custom Tokyo")

	// Delete profile
	err = store.Delete(created.ID)
	require.NoError(t, err)
	_, exists = store.Get(created.ID)
	assert.False(t, exists)

	// Reload from disk to verify persistence
	reloadedStore, err := NewStore(filePath)
	require.NoError(t, err)
	_, exists = reloadedStore.Get(created.ID)
	assert.False(t, exists) // Was deleted before reload

	// Import JSON into reloaded store
	importedCount, err := reloadedStore.ImportJSON(exportedJSON)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, importedCount, 1)
	_, exists = reloadedStore.Get(created.ID)
	assert.True(t, exists)
}

func Test_Store_FileNotExistHandling(t *testing.T) {
	t.Parallel()

	tempDir := t.TempDir()
	nonExistentFile := filepath.Join(tempDir, "non_existent_subdir", "profiles.json")

	store, err := NewStore(nonExistentFile)
	require.NoError(t, err)
	assert.NotEmpty(t, store.List())

	// Ensure file was created on seed
	_, statErr := os.Stat(nonExistentFile)
	assert.NoError(t, statErr)
}
