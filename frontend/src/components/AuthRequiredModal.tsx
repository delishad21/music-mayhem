import { SignIn } from "phosphor-react";

interface AuthRequiredModalProps {
  guestName: string;
  guestError: string;
  guestLoading: boolean;
  onGuestNameChange: (value: string) => void;
  onGuestLogin: () => void;
  onLogin: () => void;
  onSignup: () => void;
  onCancel: () => void;
}

export default function AuthRequiredModal({
  guestName,
  guestError,
  guestLoading,
  onGuestNameChange,
  onGuestLogin,
  onLogin,
  onSignup,
  onCancel,
}: AuthRequiredModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="card max-w-md">
        <h2 className="text-2xl font-bold mb-4">Login Required</h2>
        <p className="mb-4">You need to login or continue as a guest.</p>
        <div className="space-y-3 mb-6">
          <label className="block text-sm font-semibold">Guest name</label>
          <input
            type="text"
            value={guestName}
            onChange={(e) => onGuestNameChange(e.target.value)}
            className="input"
            placeholder="Enter a display name"
            maxLength={20}
          />
          {guestError && (
            <div className="p-2 rounded border border-red-500 text-red-500 text-sm">
              {guestError}
            </div>
          )}
          <button
            onClick={onGuestLogin}
            className="btn w-full"
            disabled={guestLoading}
          >
            {guestLoading ? "Signing in..." : "Continue as Guest"}
          </button>
        </div>
        <div className="space-y-3">
          <div className="flex gap-3">
            <button onClick={onLogin} className="btn flex-1">
              <span className="flex items-center justify-center gap-2">
                <SignIn size={16} weight="duotone" />
                Login
              </span>
            </button>
            <button onClick={onSignup} className="btn-secondary flex-1">
              Sign up
            </button>
          </div>
          <button onClick={onCancel} className="btn-secondary w-full">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
