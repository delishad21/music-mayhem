"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/store/useStore";
import ThemeToggle from "@/components/ThemeToggle";
import { signIn, signOut } from "next-auth/react";
import { connectSocket, createRoom } from "@/hooks/useSocket";
import { GameMode } from "@/types/game";
import {
  Headphones,
  MicrophoneStage,
  MusicNote,
  SignIn,
  SignOut,
  Trophy,
} from "phosphor-react";
import GameModeCard from "@/components/GameModeCard";
import AuthRequiredModal from "@/components/AuthRequiredModal";
import RoomSettingsModal from "@/components/RoomSettingsModal";

export default function Home() {
  const router = useRouter();
  const { user, setUser, authStatus } = useStore();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRoomConfig, setShowRoomConfig] = useState(false);
  const [pendingMode, setPendingMode] = useState<string | null>(null);
  const [isPrivateRoom, setIsPrivateRoom] = useState(false);
  const [roomPassword, setRoomPassword] = useState("");
  const [roomConfigError, setRoomConfigError] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState("");
  const isStartingRoomRef = useRef(false);

  const handleGameSelect = (mode: string) => {
    if (authStatus === "loading") return;
    setPendingMode(mode);
    if (!user) {
      sessionStorage.setItem(
        "postAuthAction",
        JSON.stringify({ type: "create-room", mode }),
      );
      setShowAuthModal(true);
      return;
    }

    setRoomConfigError("");
    setShowRoomConfig(true);
  };

  const handleStartRoom = () => {
    if (!pendingMode) return;
    if (isStartingRoomRef.current) return;

    if (isPrivateRoom && roomPassword.trim().length < 3) {
      setRoomConfigError(
        "Private rooms require a password of at least 3 characters.",
      );
      return;
    }

    const socket = connectSocket();
    isStartingRoomRef.current = true;

    socket.once("room-created", ({ room }: { room: { code: string } }) => {
      const params = new URLSearchParams();
      if (isPrivateRoom) {
        params.set("private", "1");
        // Note: putting the password in the URL is not ideal, but keeps the flow simple for now.
        params.set("password", roomPassword.trim());
      }

      const query = params.toString();
      router.push(
        query
          ? `/game/${pendingMode}/${room.code}?${query}`
          : `/game/${pendingMode}/${room.code}`,
      );
      isStartingRoomRef.current = false;
    });

    createRoom(socket, pendingMode as GameMode, user!.username, user!.displayName, user!.id, {
      isPrivate: isPrivateRoom,
      password: isPrivateRoom ? roomPassword.trim() : undefined,
    });

    setShowRoomConfig(false);
    setPendingMode(null);
    setIsPrivateRoom(false);
    setRoomPassword("");
    setRoomConfigError("");
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    setUser(null);
    localStorage.removeItem("user");
  };

  const handleGuestLogin = async () => {
    if (!guestName.trim()) {
      setGuestError("Enter a guest name to continue.");
      return;
    }
    setGuestError("");
    setGuestLoading(true);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        mode: "guest",
        username: guestName.trim(),
      });

      if (result?.error) {
        setGuestError(result.error);
        return;
      }

      setShowAuthModal(false);
      setGuestName("");
      if (pendingMode) {
        setShowRoomConfig(true);
      }
    } catch (err: any) {
      setGuestError(err?.message || "Guest sign-in failed");
    } finally {
      setGuestLoading(false);
    }
  };

  useEffect(() => {
    if (authStatus !== "authenticated" || !user) return;
    const raw = sessionStorage.getItem("postAuthAction");
    if (!raw) return;
    sessionStorage.removeItem("postAuthAction");
    try {
      const action = JSON.parse(raw) as { type?: string; mode?: string };
      if (action.type === "create-room" && action.mode) {
        setPendingMode(action.mode);
        setRoomConfigError("");
        setShowRoomConfig(true);
      } else if (action.type === "lobby") {
        router.push("/lobby");
      }
    } catch {
      // Ignore malformed state
    }
  }, [authStatus, user, router]);

  if (authStatus === "loading") {
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
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* Header */}
      <div className="absolute top-4 right-4 flex gap-3 items-center">
        {user ? (
          <>
            <span className="text-sm">
              Welcome, <strong>{user.displayName || user.username}</strong>
            </span>
            <button
              onClick={handleLogout}
              className="btn-secondary px-4 py-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <SignOut size={16} weight="duotone" />
                Logout
              </span>
            </button>
          </>
        ) : (
          <button
            onClick={() => router.push("/auth")}
            className="btn px-4 py-2 text-sm"
          >
            <span className="flex items-center gap-2">
              <SignIn size={16} weight="duotone" />
              Login / Register
            </span>
          </button>
        )}
        <ThemeToggle />
      </div>

      {/* Main Content */}
      <div className="max-w-4xl w-full">
        <div
          className="flex items-center justify-center gap-3 mb-4"
          style={{ color: "var(--primary)" }}
        >
          <MusicNote size={36} weight="duotone" />
          <h1 className="text-5xl font-bold text-center">Music Mayhem</h1>
        </div>
        <p className="text-center text-xl mb-12 opacity-80">
          Choose your game mode!
        </p>

        {/* Game Modes */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              mode: "finish-lyrics",
              title: "Finish the Lyrics",
              description: "Listen to a short clip, then fill in the missing lyrics.",
              accentColor: "var(--amber-gold)",
              hoverTint: "rgba(251, 188, 5, 0.12)",
              icon: <MicrophoneStage size={40} weight="duotone" />,
            },
            {
              mode: "guess-song-easy",
              title: "Guess the Song",
              description: "Identify the song and artist while the clip is playing.",
              accentColor: "var(--medium-jungle)",
              hoverTint: "rgba(52, 168, 83, 0.12)",
              icon: <Headphones size={40} weight="duotone" />,
            },
            {
              mode: "guess-song-challenge",
              title: "Challenge Mode",
              description:
                "Progressive clips from 1s to 10s. Guess the song at any point.",
              accentColor: "var(--cinnabar)",
              hoverTint: "rgba(234, 67, 53, 0.12)",
              icon: <Trophy size={40} weight="duotone" />,
            },
          ].map((card) => (
            <GameModeCard
              key={card.mode}
              title={card.title}
              description={card.description}
              accentColor={card.accentColor}
              hoverTint={card.hoverTint}
              icon={card.icon}
              onClick={() => handleGameSelect(card.mode)}
            />
          ))}
        </div>

        {/* Lobby Browser */}
        <div className="mt-12 text-center">
          <button
            onClick={() => router.push("/lobby")}
            className="btn-secondary"
          >
            Browse Active Lobbies
          </button>
        </div>
      </div>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthRequiredModal
          guestName={guestName}
          guestError={guestError}
          guestLoading={guestLoading}
          onGuestNameChange={setGuestName}
          onGuestLogin={handleGuestLogin}
          onLogin={() => {
            sessionStorage.setItem(
              "postAuthAction",
              JSON.stringify({ type: "create-room", mode: pendingMode }),
            );
            router.push("/auth?mode=login");
          }}
          onSignup={() => {
            sessionStorage.setItem(
              "postAuthAction",
              JSON.stringify({ type: "create-room", mode: pendingMode }),
            );
            router.push("/auth?mode=register");
          }}
          onCancel={() => setShowAuthModal(false)}
        />
      )}

      {showRoomConfig && pendingMode && (
        <RoomSettingsModal
          isPrivateRoom={isPrivateRoom}
          roomPassword={roomPassword}
          roomConfigError={roomConfigError}
          onTogglePrivate={(checked) => {
            setIsPrivateRoom(checked);
            setRoomConfigError("");
          }}
          onPasswordChange={(value) => {
            setRoomPassword(value);
            setRoomConfigError("");
          }}
          onStart={handleStartRoom}
          onCancel={() => {
            setShowRoomConfig(false);
            setPendingMode(null);
            setIsPrivateRoom(false);
            setRoomPassword("");
            setRoomConfigError("");
          }}
        />
      )}
    </div>
  );
}
