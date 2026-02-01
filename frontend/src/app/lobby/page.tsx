'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/store/useStore';
import ThemeToggle from '@/components/ThemeToggle';
import { RoomListItem } from '@/types/game';
import { roomsAPI } from '@/lib/api';
import { Headphones, MicrophoneStage, MusicNote, Trophy } from 'phosphor-react';
import AuthRequiredModal from '@/components/AuthRequiredModal';
import { signIn } from 'next-auth/react';

export default function LobbyPage() {
  const router = useRouter();
  const { user, authStatus, isLeavingRoom, resetRoomState } = useStore();
  const [rooms, setRooms] = useState<RoomListItem[]>([]);
  const [roomCode, setRoomCode] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [joinError, setJoinError] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState('');

  useEffect(() => {
    if (authStatus === 'loading') return;
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    let isMounted = true;

    const fetchRooms = async () => {
      try {
        const roomsList = await roomsAPI.list();
        if (isMounted) {
          setRooms(roomsList as RoomListItem[]);
        }
      } catch (error) {
        console.error('Failed to fetch rooms:', error);
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [authStatus, user, router]);

  useEffect(() => {
    if (isLeavingRoom) {
      resetRoomState();
    }
  }, [isLeavingRoom, resetRoomState]);

  const handleGuestLogin = async () => {
    if (!guestName.trim()) {
      setGuestError('Enter a guest name to continue.');
      return;
    }
    setGuestError('');
    setGuestLoading(true);
    try {
      const result = await signIn('credentials', {
        redirect: false,
        mode: 'guest',
        username: guestName.trim(),
      });

      if (result?.error) {
        setGuestError(result.error);
        return;
      }

      setShowAuthModal(false);
      setGuestName('');
    } catch (err: any) {
      setGuestError(err?.message || 'Guest sign-in failed');
    } finally {
      setGuestLoading(false);
    }
  };

  const handleJoinRoom = (code: string) => {
    if (!user) return;
    const roomItem = rooms.find(r => r.code === code);
    if (!roomItem) return;
    router.push(`/game/${roomItem.gameMode}/${roomItem.code}`);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCode.trim()) {
      void (async () => {
        try {
          setJoinError('');
          const lookup = await roomsAPI.get(roomCode.toUpperCase());

          if (lookup.isPrivate && roomPassword.trim().length === 0) {
            setJoinError('This room is private. Enter the room password to join.');
            return;
          }

          const params = new URLSearchParams();
          if (roomPassword.trim().length > 0) {
            params.set('password', roomPassword.trim());
          }

          const query = params.toString();
          router.push(
            query
              ? `/game/${lookup.gameMode}/${lookup.code}?${query}`
              : `/game/${lookup.gameMode}/${lookup.code}`
          );
        } catch (error: any) {
          setJoinError(error?.response?.data?.error || 'Room not found');
        }
      })();
    }
  };

  const getGameModeLabel = (mode: string) => {
    switch (mode) {
      case 'finish-lyrics':
        return 'Finish the Lyrics';
      case 'guess-song-easy':
        return 'Guess the Song';
      case 'guess-song-challenge':
        return 'Challenge Mode';
      default:
        return mode;
    }
  };

  const getGameModeIcon = (mode: string) => {
    switch (mode) {
      case 'finish-lyrics':
        return <MicrophoneStage size={18} weight="duotone" style={{ color: 'var(--amber-gold)' }} />;
      case 'guess-song-easy':
        return <Headphones size={18} weight="duotone" style={{ color: 'var(--medium-jungle)' }} />;
      case 'guess-song-challenge':
        return <Trophy size={18} weight="duotone" style={{ color: 'var(--cinnabar)' }} />;
      default:
        return <MusicNote size={18} weight="duotone" />;
    }
  };

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <MusicNote size={40} weight="duotone" />
          </div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/')}
            className="text-sm opacity-60 hover:opacity-100 transition-opacity mb-4"
          >
            ← Back to Home
          </button>
          <h1 className="text-4xl font-bold" style={{ color: 'var(--primary)' }}>
            Active Lobbies
          </h1>
        </div>

        {/* Join by Code */}
        <div className="card mb-8">
          <h2 className="text-2xl font-bold mb-4">Join by Room Code</h2>
          <form onSubmit={handleJoinByCode} className="flex gap-4">
            <div className="flex-1 grid md:grid-cols-2 gap-3">
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="input"
                placeholder="Enter 6-digit room code"
                maxLength={6}
              />
              <input
                type="password"
                value={roomPassword}
                onChange={(e) => setRoomPassword(e.target.value)}
                className="input"
                placeholder="Room password (if private)"
              />
            </div>
            <button type="submit" className="btn">
              Join
            </button>
          </form>
          {joinError && (
            <div className="mt-3 p-3 rounded-lg bg-red-500 bg-opacity-20 text-red-500 border border-red-500 text-sm">
              {joinError}
            </div>
          )}
        </div>

        {/* Room List */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Browse Rooms</h2>
          {rooms.length === 0 ? (
            <div className="card text-center py-12 opacity-60">
              No active rooms available. Create one from the home page!
            </div>
          ) : (
            <div className="space-y-4">
              {rooms.map((room) => (
                <div key={room.code} className="card flex justify-between items-center">
                  <div>
                    <div className="text-xl font-bold mb-1 flex items-center gap-2">
                      {getGameModeIcon(room.gameMode)}
                      {getGameModeLabel(room.gameMode)}
                    </div>
                    <div className="text-sm opacity-60">
                      Room Code: <span className="font-mono font-bold">{room.code}</span> •
                      Host: {room.hostName} •
                      Players: {room.playerCount}
                    </div>
                  </div>
                  <button
                    onClick={() => handleJoinRoom(room.code)}
                    className="btn"
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAuthModal && (
        <AuthRequiredModal
          guestName={guestName}
          guestError={guestError}
          guestLoading={guestLoading}
          onGuestNameChange={setGuestName}
          onGuestLogin={handleGuestLogin}
          onLogin={() => {
            sessionStorage.setItem('postAuthAction', JSON.stringify({ type: 'lobby' }));
            router.push('/auth?mode=login');
          }}
          onSignup={() => {
            sessionStorage.setItem('postAuthAction', JSON.stringify({ type: 'lobby' }));
            router.push('/auth?mode=register');
          }}
          onCancel={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
