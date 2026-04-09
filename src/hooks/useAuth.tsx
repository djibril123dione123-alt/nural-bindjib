import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from "react";

interface AudioEngineContextType {
  play: (url: string, loop?: boolean) => void;
  stop: () => void;
  isPlaying: boolean;
  isLoading: boolean;
  currentUrl: string | null;
}

const AudioEngineContext = createContext<AudioEngineContextType | undefined>(undefined);

export function AudioEngineProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setIsLoading(false);
    setCurrentUrl(null);
  }, []);

  const play = useCallback((url: string, loop = false) => {
    // Always destroy previous instance first
    stop();

    setIsLoading(true);
    const audio = new Audio(url);
    audio.loop = loop;
    audioRef.current = audio;
    setCurrentUrl(url);

    audio.addEventListener("canplaythrough", () => {
      setIsLoading(false);
      audio.play();
      setIsPlaying(true);
    }, { once: true });

    audio.addEventListener("error", () => {
      setIsLoading(false);
      setCurrentUrl(null);
    }, { once: true });

    audio.addEventListener("ended", () => {
      if (!loop) {
        setIsPlaying(false);
        setCurrentUrl(null);
      }
    });

    audio.load();
  }, [stop]);

  return (
    <AudioEngineContext.Provider value={{ play, stop, isPlaying, isLoading, currentUrl }}>
      {children}
    </AudioEngineContext.Provider>
  );
}

export function useAudioEngine() {
  const ctx = useContext(AudioEngineContext);
  if (!ctx) throw new Error("useAudioEngine must be used within AudioEngineProvider");
  return ctx;
}
