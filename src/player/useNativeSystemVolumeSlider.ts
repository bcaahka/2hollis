import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { SystemVolumeSlider, isIosSystemVolumeSlider } from './systemVolumeSlider';

type NativeVolumeSliderApi = {
  active: boolean;
  sync: () => void;
};

/**
 * Places an invisible native MPVolumeView over `slotRef` so system volume is
 * smooth; the web IonRange underneath owns the red / small-knob visuals.
 */
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
      if (rect.width < 8 || rect.height < 8) return;

      const payload = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
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

    // Layout may not be ready on first paint — retry a few times.
    schedule();
    const boot = window.setTimeout(schedule, 50);
    const boot2 = window.setTimeout(schedule, 200);
    const boot3 = window.setTimeout(schedule, 500);

    const ro = new ResizeObserver(schedule);
    if (slotRef.current) ro.observe(slotRef.current);

    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    document.addEventListener('scroll', schedule, true);

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(boot);
      window.clearTimeout(boot2);
      window.clearTimeout(boot3);
      scheduleRef.current = () => undefined;
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      document.removeEventListener('scroll', schedule, true);
      mountedRef.current = false;
      SystemVolumeSlider.unmount().catch(() => undefined);
    };
  }, [native, slotRef]);

  return {
    active: native,
    sync: () => scheduleRef.current(),
  };
};
