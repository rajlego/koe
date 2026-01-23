import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../../store/settingsStore';

export default function AudioDeviceSelector() {
  const { audioInputDevice, setAudioInputDevice } = useSettingsStore();
  const [devices, setDevices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError(null);
      const deviceList = await invoke<string[]>('list_audio_devices');
      setDevices(deviceList);
    } catch (err) {
      setError(`Failed to load devices: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceChange = async (deviceName: string) => {
    const device = deviceName === '' ? null : deviceName;
    setAudioInputDevice(device);

    try {
      await invoke('set_audio_device', { deviceName: device });
    } catch (err) {
      console.error('Failed to set device:', err);
    }
  };

  if (loading) {
    return (
      <div className="setting-row">
        <span className="setting-label">Audio Input Device</span>
        <span className="loading-text">Loading devices...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="setting-row">
        <span className="setting-label">Audio Input Device</span>
        <span className="error-text">{error}</span>
        <button className="retry-btn" onClick={loadDevices}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="setting-row audio-device-row">
      <label className="select-label">
        <span>Audio Input Device</span>
        <div className="device-select-wrapper">
          <select
            value={audioInputDevice || ''}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className="device-select"
          >
            <option value="">System Default</option>
            {devices.map((device) => (
              <option key={device} value={device}>
                {device}
              </option>
            ))}
          </select>
          <button className="refresh-btn" onClick={loadDevices} title="Refresh device list">
            ↻
          </button>
        </div>
      </label>
    </div>
  );
}
