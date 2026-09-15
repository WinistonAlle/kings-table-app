import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export function useFullscreen() {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = Platform.OS === 'web' && typeof document !== 'undefined'
    && Boolean(document.documentElement.requestFullscreen);

  useEffect(() => {
    if (!supported) return;
    const update = () => setActive(Boolean(document.fullscreenElement));
    update();
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, [supported]);

  const exit = async () => {
    if (supported && document.fullscreenElement) await document.exitFullscreen();
  };

  const toggle = async () => {
    setError(null);
    try {
      if (active) await exit();
      else if (supported) await document.documentElement.requestFullscreen();
    } catch {
      setError('Não foi possível alterar a tela cheia neste navegador.');
    }
  };

  return { active, supported, error, toggle, exit };
}
