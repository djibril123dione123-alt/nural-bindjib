import { useEffect, useState } from "react";

export interface PrayerTime {
  name: string;
  time: string;
}

export function useServiceWorker() {
  const [swRegistered, setSwRegistered] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");

  // Enregistrer le Service Worker au montage
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[SW] Enregistré :", reg.scope);
        setSwRegistered(true);
      })
      .catch((err) => console.error("[SW] Échec :", err));

    // Lire l'état de permission actuel
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Demander la permission (à appeler depuis l'onboarding)
  const requestPermission = async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    return perm === "granted";
  };

  // Programmer les Adhans de la journée via le Service Worker
  const scheduleAdhan = (prayers: PrayerTime[]) => {
    if (!swRegistered || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type: "SCHEDULE_ADHAN", payload: { prayers } });
    });
  };

  // Envoyer une notification locale immédiate
  const sendNotification = (title: string, body: string, options?: {
    url?: string;
    tag?: string;
    type?: string;
  }) => {
    if (!swRegistered || notifPermission !== "granted") return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({
        type: "SEND_NOTIFICATION",
        payload: { title, body, url: options?.url || "/", tag: options?.tag, type: options?.type },
      });
    });
  };

  // Mettre à jour le badge (tâches restantes)
  const updateBadge = (count: number) => {
    if ("setAppBadge" in navigator) {
      if (count > 0) {
        (navigator as any).setAppBadge(count);
      } else {
        (navigator as any).clearAppBadge();
      }
    }
  };

  return {
    swRegistered,
    notifPermission,
    requestPermission,
    scheduleAdhan,
    sendNotification,
    updateBadge,
  };
}
