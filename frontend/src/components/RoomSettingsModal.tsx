interface RoomSettingsModalProps {
  isPrivateRoom: boolean;
  roomPassword: string;
  roomConfigError: string;
  onTogglePrivate: (checked: boolean) => void;
  onPasswordChange: (value: string) => void;
  onStart: () => void;
  onCancel: () => void;
}

export default function RoomSettingsModal({
  isPrivateRoom,
  roomPassword,
  roomConfigError,
  onTogglePrivate,
  onPasswordChange,
  onStart,
  onCancel,
}: RoomSettingsModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="card max-w-md w-full">
        <h2 className="text-2xl font-bold mb-2">Room Settings</h2>
        <p className="opacity-70 mb-6">
          Configure your room before starting the session.
        </p>

        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={isPrivateRoom}
              onChange={(e) => onTogglePrivate(e.target.checked)}
            />
            <span className="font-semibold">
              Private room (password required)
            </span>
          </label>

          {isPrivateRoom && (
            <div>
              <label className="block mb-2 font-semibold">Room Password</label>
              <input
                type="password"
                value={roomPassword}
                onChange={(e) => onPasswordChange(e.target.value)}
                className="input"
                placeholder="Enter a room password"
                minLength={3}
              />
            </div>
          )}

          {roomConfigError && (
            <div className="p-2 rounded border border-red-500 text-red-500 text-sm">
              {roomConfigError}
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-6">
          <button onClick={onStart} className="btn flex-1">
            Start Room
          </button>
          <button onClick={onCancel} className="btn-secondary flex-1">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
