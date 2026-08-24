import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import {
  SystemVolumeSlider,
  isIosSystemVolumeSlider,
  readVolumeSliderColors,
} from './systemVolumeSlider';

type NativeVolumeSliderApi = {
  active: boolean;
  sync: () => void;
};

/** Keeps a native MPVolumeView aligned with a web slot (iOS only). */
export const useNativeSystemVolumeSlider = (
  slotRef: RefObject<HTMLElement | null>,
  enabled: boolean
): NativeVolumeSliderApi => {
  const mountedRef = useRef(false);
  const scheduleRef = useRef<() => void>(() => undefined);
  const native = enabled && isIosSystemVolumeSlider();

  useEffect(() => {
    if (!native) return;

    let cancelled = false;
    let raf = 0;

    const sync = () => {
      if (cancelled) return;
      const el = slotRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const visible =
        rect.width >= 1 &&
        rect.height >= 1 &&
        rect.bottom > 0 &&
        rect.top < window.innerHeight &&
        rect.right > 0 &&
        rect.left < window.innerWidth;

      const payload = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        visible,
        ...readVolumeSliderColors(),
      };

      const run = mountedRef.current
        ? SystemVolumeSlider.update(payload)
        : SystemVolumeSlider.mount(payload);

      run
        .then(() => {
          if (!cancelled) mountedRef.current = true;
        })
        .catch(() => undefined);
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    };
    scheduleRef.current = schedule;

    schedule();

    const ro = new ResizeObserver(schedule);
    if (slotRef.current) ro.observe(slotRef.current);

    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    document.addEventListener('scroll', schedule, true);

    // Theme class changes need a full remount so native thumb colors refresh.
    const themeObserver = new MutationObserver(() => {
      mountedRef.current = false;
      SystemVolumeSlider.unmount()
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) schedule();
        });
    });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      scheduleRef.current = () => undefined;
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      document.removeEventListener('scroll', schedule, true);
      themeObserver.disconnect();
      mountedRef.current = false;
      SystemVolumeSlider.unmount().catch(() => undefined);
    };
  }, [native, slotRef]);

  return {
    active: native,
    sync: () => scheduleRef.current(),
  };
};
