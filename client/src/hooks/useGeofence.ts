/**
 * useGeofence — Background Geolocation + Software Geofencing Hook
 *
 * Uses @capacitor-community/background-geolocation which runs an Android
 * Foreground Service (persistent notification) to keep tracking even when
 * the app is in the background or the screen is off.
 *
 * Geofencing is implemented in software by comparing the current position
 * against each assigned branch's coordinates using the Haversine formula.
 *
 * Flow:
 *  1. On mount: fetch assigned branches.
 *  2. Start background watcher (native Foreground Service on Android).
 *  3. On each position update → check distance against all branches.
 *  4. If inside a branch radius and not checked-in → auto check-in.
 *     - If online  → send to server immediately.
 *     - If offline → save locally as pending_checkin.
 *  5. If outside active branch radius and checked-in → auto check-out.
 *     - If online  → send to server immediately.
 *     - If offline → save locally as pending_checkout.
 *  6. All location updates are queued in localforage when offline and synced on reconnect.
 *  7. On reconnect → sync pending visits first, then location logs.
 *
 * ── الإصلاحات ────────────────────────────────────────────────────────────────
 *  • Cooldown 3 دقايق لكل فرع — يمنع check-in تلقائي متكرر
 *  • الـ watcher يُنشأ مرة واحدة فقط عبر watcherStartedRef
 *  • كل mutations تمر عبر refs — الـ watcher لا يُعاد بسبب تغيُّر الـ callbacks
 *  • syncAll لا تُستدعى مع كل GPS update — فقط كل 5 دقايق / foreground / online
 *  • إشعار "رجع النت" مرة واحدة كل 10 ثواني على الأكثر (debounce)
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Preferences } from "@capacitor/preferences";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import localforage from "localforage";
import { getDistanceMeters } from "../../../shared/utils";

// ─── Offline stores ───────────────────────────────────────────────────────────

// نقاط GPS لمسار المدير
const locationStore = localforage.createInstance({
  name: "branch-tracker",
  storeName: "offline_locations",
});

// الزيارات المعلقة (check-in / check-out وهو أوفلاين)
const visitStore = localforage.createInstance({
  name: "branch-tracker",
  storeName: "offline_visits",
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface OfflineLocation {
  latitude: string;
  longitude: string;
  accuracy?: string;
  timestamp: string;
}

interface PendingCheckIn {
  type: "check_in";
  branchId: number;
  branchName: string;
  latitude: string;
  longitude: string;
  accuracy?: string;
  checkInAt: string; // وقت الدخول الحقيقي
  localId: string;   // ID محلي مؤقت
  isMocked?: boolean; // هل الموقع وهمي؟
}

interface PendingCheckOut {
  type: "check_out";
  localCheckInId: string; // نفس localId بتاع الـ check-in
  serverVisitId?: number; // لو الـ check-in اتبعت للسيرفر وجه ID
  branchName: string;
  checkInAt: string;  // ✅ محتاجه السيرفر يحسب المدة (15 دقيقة)
  checkOutAt: string; // وقت الخروج الحقيقي
}

type PendingVisit = PendingCheckIn | PendingCheckOut;

// ─── Global State for mock detection ──────────────────────────────────────────
export let globalMockedStatus = false;

// ─── Cooldown: يمنع check-in تلقائي متكرر لنفس الفرع ───────────────────────
// مدة الـ cooldown: 3 دقائق
const CHECK_IN_COOLDOWN_MS = 3 * 60 * 1000;
const lastCheckInAttempt = new Map<number, number>(); // branchId → timestamp

// ─── Debounce للـ "online" toast (مرة واحدة كل 10 ثواني) ───────────────────
let lastOnlineToastAt = 0;
const ONLINE_TOAST_DEBOUNCE_MS = 10_000;

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useGeofence() {
  const { data: branches = [] } = trpc.manager.getMyBranches.useQuery();
  const { data: historyData, refetch: refetchHistory, isLoading: historyLoading } =
    trpc.visit.myHistory.useQuery({ limit: 1, offset: 0 });

  const checkInMutation = trpc.visit.checkIn.useMutation();
  const checkOutMutation = trpc.visit.checkOut.useMutation();
  const syncOfflineMutation = trpc.visit.syncOfflineData.useMutation();
  const syncVisitsMutation = trpc.visit.syncOfflineVisits.useMutation();

  const activeVisit = historyData?.items[0]?.status === "checked_in"
    ? historyData.items[0]
    : null;

  // Keep refs fresh for use inside callbacks (avoid stale closures)
  const activeVisitRef = useRef(activeVisit);
  activeVisitRef.current = activeVisit;

  const branchesRef = useRef(branches);
  branchesRef.current = branches;

  const historyLoadingRef = useRef(historyLoading);
  historyLoadingRef.current = historyLoading;

  const refetchHistoryRef = useRef(refetchHistory);
  refetchHistoryRef.current = refetchHistory;

  // Ref to hold the background watcher ID so cleanup can remove it
  const watcherIdRef = useRef<string | null>(null);

  // Flag: الـ watcher اتعمل — يمنع إنشاء watcher ثاني
  const watcherStartedRef = useRef(false);

  // ── Mutation refs (يمنع إعادة إنشاء الـ watcher عند تغيُّر الـ mutations) ──
  const checkInMutationRef = useRef(checkInMutation);
  checkInMutationRef.current = checkInMutation;

  const checkOutMutationRef = useRef(checkOutMutation);
  checkOutMutationRef.current = checkOutMutation;

  const syncOfflineMutationRef = useRef(syncOfflineMutation);
  syncOfflineMutationRef.current = syncOfflineMutation;

  const syncVisitsMutationRef = useRef(syncVisitsMutation);
  syncVisitsMutationRef.current = syncVisitsMutation;

  // State to expose the latest background location to the UI
  const [latestLocation, setLatestLocation] = useState<{ lat: number; lon: number; isMocked: boolean } | null>(null);

  // ── Sync to Native Preferences ──────────────────────────────────────────
  useEffect(() => {
    if (branches.length > 0 && Capacitor.isNativePlatform()) {
      Preferences.set({
        key: "branches_data",
        value: JSON.stringify(branches),
      });
      Preferences.set({
        key: "api_url",
        value: import.meta.env.VITE_API_URL || "http://192.168.1.8:3000",
      });
    }
  }, [branches]);

  // ── مساعد: هل في نت؟ ──────────────────────────────────────────────────────
  const isOnline = () => navigator.onLine;

  // ── مساعد: جلب الزيارات المعلقة ───────────────────────────────────────────
  const getPendingVisits = async (): Promise<PendingVisit[]> => {
    return (await visitStore.getItem<PendingVisit[]>("queue")) || [];
  };

  // ── مساعد: حفظ الزيارات المعلقة ───────────────────────────────────────────
  const setPendingVisits = async (visits: PendingVisit[]) => {
    await visitStore.setItem("queue", visits);
  };

  // ── مساعد: هل في check-in معلق محلياً؟ ───────────────────────────────────
  const getLocalActiveVisit = async (): Promise<PendingCheckIn | null> => {
    const pending = await getPendingVisits();
    const checkIns = pending.filter((v): v is PendingCheckIn => v.type === "check_in");
    const checkOuts = pending.filter((v): v is PendingCheckOut => v.type === "check_out");
    const checkedOutIds = new Set(checkOuts.map((v) => v.localCheckInId));
    return checkIns.find((v) => !checkedOutIds.has(v.localId)) || null;
  };

  // ── مزامنة الزيارات المعلقة مع السيرفر ────────────────────────────────────
  // مُعرَّفة كـ ref حتى لا تتسبب في إعادة إنشاء الـ watcher
  const syncPendingVisitsRef = useRef(async () => {
    if (!navigator.onLine) return;
    try {
      const pending = await getPendingVisits();
      if (pending.length === 0) return;

      const res = await syncVisitsMutationRef.current.mutateAsync({ visits: pending });

      if (res.synced > 0 || res.rejected > 0) {
        const sentIds = new Set(pending.map(v => v.type === "check_in" ? v.localId : v.localCheckInId));
        const currentPending = await getPendingVisits();
        const remaining = currentPending.filter((v) => {
          const id = v.type === "check_in" ? v.localId : v.localCheckInId;
          return !sentIds.has(id);
        });
        await setPendingVisits(remaining);
        refetchHistoryRef.current();

        if (res.rejected > 0) {
          toast.warning(`⚠️ ${res.rejected} زيارة رُفضت — تم إبلاغ الإدارة`);
        }
      }
    } catch {
      // هيحاول تاني المرة الجاية
    }
  });

  // ── مزامنة نقاط GPS ────────────────────────────────────────────────────────
  const syncOfflineDataRef = useRef(async () => {
    if (!navigator.onLine) return;
    try {
      const pending: OfflineLocation[] = (await locationStore.getItem("queue")) || [];
      if (pending.length > 0) {
        const res = await syncOfflineMutationRef.current.mutateAsync({ locations: pending });
        if (res.success) {
          await locationStore.setItem("queue", []);
        }
      }
    } catch {
      // silently fail — will retry next time
    }
  });

  // ── مزامنة شاملة ─────────────────────────────────────────────────────────
  const syncAllRef = useRef(async () => {
    await syncPendingVisitsRef.current();
    await syncOfflineDataRef.current();
  });

  // نسخة stable من syncAll للاستخدام الخارجي لو احتجنا
  const syncAll = useCallback(async () => {
    await syncAllRef.current();
  }, []);

  // Periodic sync every 5 minutes — يستخدم الـ ref مباشرة
  useEffect(() => {
    const interval = setInterval(() => syncAllRef.current(), 1000 * 60 * 5);
    return () => clearInterval(interval);
  }, []);

  // ── نظام نقاط الشك في الـ JavaScript Layer ───────────────────────────────
  // بيشتغل لما التطبيق مفتوح على الشاشة (foreground)
  // النتيجة بتتدمج مع نتيجة الـ Java layer على السيرفر
  const calcJsSuspicion = (
    accuracy: number | undefined,
    isMockedFromNative: boolean,
  ): { score: number; reasons: string[] } => {
    let score = 0;
    const reasons: string[] = [];

    // Native layer قال وهمي صراحة
    if (isMockedFromNative) {
      score += 100;
      reasons.push("NATIVE_IS_MOCKED");
    }

    if (accuracy !== undefined) {
      // accuracy = 0 مستحيل في GPS حقيقي
      if (accuracy === 0) {
        score += 40;
        reasons.push("ACCURACY_ZERO");
      }
      // accuracy رقم صحيح نضيف صغير — Mock apps كتير بتحط 1 أو 5 أو 10
      else if (accuracy <= 15 && Number.isInteger(accuracy)) {
        score += 30;
        reasons.push(`ACCURACY_PERFECT_INTEGER_${accuracy}`);
      }
      // accuracy ثابت بين أكتر من reading متتالية — GPS حقيقي بيتغير دايماً
      // (بنتحقق منه عبر recentAccuracies في الـ ref بتاعنا)
    }

    return { score, reasons };
  };

  // ── نحتفظ بآخر 5 قراءات accuracy عشان نكشف الثبات المريب ──────────────
  const recentAccuraciesRef = useRef<number[]>([]);

  // ── Handle a position update ───────────────────────────────────────────────
  const handlePositionUpdate = useCallback(async (
    currentLat: number,
    currentLng: number,
    accuracy?: number,
    isMocked?: boolean,
  ) => {
    // ── حساب نقاط الشك في الـ JS layer ──────────────────────────────────
    const { score: jsScore, reasons: jsReasons } = calcJsSuspicion(accuracy, !!isMocked);

    // ── Location Consistency: لو accuracy ثابت كتير → مريب ──────────────
    // GPS حقيقي accuracy بتاعه بيتغير مع كل reading
    let consistencyScore = 0;
    const consistencyReasons: string[] = [];
    if (accuracy !== undefined) {
      const recent = recentAccuraciesRef.current;
      recent.push(accuracy);
      if (recent.length > 5) recent.shift(); // خليها آخر 5 بس

      if (recent.length >= 4) {
        const allSame = recent.every(a => a === recent[0]);
        if (allSame) {
          consistencyScore += 35;
          consistencyReasons.push("ACCURACY_CONSTANT_OVER_5_READINGS");
        }
      }
    }

    const totalJsScore = jsScore + consistencyScore;
    const allJsReasons = [...jsReasons, ...consistencyReasons];

    const detectedMock = totalJsScore >= 50;
    globalMockedStatus = detectedMock;
    setLatestLocation({ lat: currentLat, lon: currentLng, isMocked: detectedMock });
    if (historyLoadingRef.current) return;

    // 1. احفظ نقطة الـ GPS في الـ queue
    const pendingLocs: OfflineLocation[] = (await locationStore.getItem("queue")) || [];
    pendingLocs.push({
      latitude: currentLat.toString(),
      longitude: currentLng.toString(),
      accuracy: accuracy?.toString(),
      timestamp: new Date().toISOString(),
    });
    await locationStore.setItem("queue", pendingLocs);

    // ⚡ لا نستدعي syncAll مع كل GPS update — تحدث تلقائياً كل 5 دقايق / foreground / online

    const currentBranches = branchesRef.current;

    // ── نبص على الحالة الحالية (سيرفر أو محلية) ──────────────────────────
    const serverActiveVisit = activeVisitRef.current;
    const localActiveVisit = await getLocalActiveVisit();

    // ── 2. Auto check-out ──────────────────────────────────────────────────
    if (serverActiveVisit) {
      const activeBranch = currentBranches.find((b) => b.id === serverActiveVisit.branchId);
      if (activeBranch?.latitude && activeBranch?.longitude) {
        const dist = getDistanceMeters(
          currentLat, currentLng,
          parseFloat(activeBranch.latitude),
          parseFloat(activeBranch.longitude)
        );
        if (dist > (activeBranch.geofenceRadiusMeters || 200) + 50) {
          if (isOnline()) {
            try {
              await checkOutMutationRef.current.mutateAsync({ visitId: serverActiveVisit.id });
              toast.info(`🔴 تسجيل خروج تلقائي من ${activeBranch.name}`);
              refetchHistoryRef.current();
            } catch { /* ignore */ }
          } else {
            // ✅ بنبعت checkInAt عشان السيرفر يقدر يحسب المدة صح
            const pending = await getPendingVisits();
            pending.push({
              type: "check_out",
              localCheckInId: `server_${serverActiveVisit.id}`,
              serverVisitId: serverActiveVisit.id,
              branchName: activeBranch.name,
              checkInAt: serverActiveVisit.checkInAt instanceof Date
                ? serverActiveVisit.checkInAt.toISOString()
                : String(serverActiveVisit.checkInAt),
              checkOutAt: new Date().toISOString(),
            });
            await setPendingVisits(pending);
            toast.info(`🔴 خروج مؤقت من ${activeBranch.name} — سيُرسل لما النت يرجع`);
          }
        }
      }
      return;
    }

    if (localActiveVisit) {
      const activeBranch = currentBranches.find((b) => b.id === localActiveVisit.branchId);
      if (activeBranch?.latitude && activeBranch?.longitude) {
        const dist = getDistanceMeters(
          currentLat, currentLng,
          parseFloat(activeBranch.latitude),
          parseFloat(activeBranch.longitude)
        );
        if (dist > (activeBranch.geofenceRadiusMeters || 200) + 50) {
          const pending = await getPendingVisits();
          pending.push({
            type: "check_out",
            localCheckInId: localActiveVisit.localId,
            branchName: activeBranch.name,
            checkInAt: localActiveVisit.checkInAt, // ✅ موجود في PendingCheckIn أصلاً
            checkOutAt: new Date().toISOString(),
          });
          await setPendingVisits(pending);
          toast.info(`🔴 خروج مؤقت من ${activeBranch.name} — سيُرسل لما النت يرجع`);
        }
      }
      return;
    }

    // ── 3. Auto check-in ───────────────────────────────────────────────────
    for (const branch of currentBranches) {
      if (!branch.latitude || !branch.longitude) continue;
      const dist = getDistanceMeters(
        currentLat, currentLng,
        parseFloat(branch.latitude),
        parseFloat(branch.longitude)
      );
      if (dist <= (branch.geofenceRadiusMeters || 200)) {
        // ── Cooldown: تجنب تسجيل الدخول أكثر من مرة للفرع نفسه في 3 دقايق ──
        const lastAttempt = lastCheckInAttempt.get(branch.id) ?? 0;
        const now = Date.now();
        if (now - lastAttempt < CHECK_IN_COOLDOWN_MS) {
          break; // في cooldown — تجاهل هذه المحاولة
        }
        lastCheckInAttempt.set(branch.id, now);

        if (isOnline()) {
          try {
            await checkInMutationRef.current.mutateAsync({
              branchId: branch.id,
              latitude: currentLat.toString(),
              longitude: currentLng.toString(),
              isMocked: detectedMock,
              suspicionScore: totalJsScore,
              mockReasons: allJsReasons,
            });
            toast.success(`✅ تسجيل دخول تلقائي في ${branch.name}${ detectedMock ? " ⚠️ موقع مشبوه" : ""}`);
            refetchHistoryRef.current();
          } catch (err: any) {
            if (err.message?.includes("Already checked")) {
              // المستخدم محسوب عليه check-in بالفعل — حدِّث الحالة فقط
              refetchHistoryRef.current();
            } else {
              toast.error(`❌ فشل الدخول: ${err.message || String(err)}`);
              // امسح الـ cooldown عشان يحاول تاني في المرة الجاية
              lastCheckInAttempt.delete(branch.id);
            }
          }
        } else {
          const localId = `local_${Date.now()}_${branch.id}`;
          const pending = await getPendingVisits();
          pending.push({
            type: "check_in",
            branchId: branch.id,
            branchName: branch.name,
            latitude: currentLat.toString(),
            longitude: currentLng.toString(),
            accuracy: accuracy?.toString(),
            checkInAt: new Date().toISOString(),
            localId,
            isMocked: detectedMock,
            suspicionScore: totalJsScore,
            mockReasons: allJsReasons,
          });
          await setPendingVisits(pending);
          toast.success(`✅ دخول مؤقت في ${branch.name} — سيُرسل لما النت يرجع`);
        }
        break; // check-in في فرع واحد بس
      }
    }
  }, []); // جميع المتغيرات تمر عبر refs — لا داعي لإعادة الإنشاء

  // ── Setup geolocation watcher (native or web) ─────────────────────────────
  // يُشغَّل مرة واحدة فقط عندما تصبح branches متاحة (branches.length > 0)
  // لا يعيد التشغيل بسبب تغيُّر handlePositionUpdate أو syncAll لأنهم refs
  useEffect(() => {
    if (branches.length === 0) return;
    // لا تُنشئ watcher ثاني لو الأول شغّال
    if (watcherStartedRef.current) return;
    watcherStartedRef.current = true;

    let cleanupFn: (() => void) | null = null;

    const setup = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Dynamic import — only runs on native Android/iOS.
          const bgGeoModule = "@capacitor-community/background-geolocation";
          const { BackgroundGeolocation } = await import(/* @vite-ignore */ bgGeoModule);

          const id = await BackgroundGeolocation.addWatcher(
            {
              backgroundTitle: "تتبع الزيارات نشط",
              backgroundMessage: "يتم تتبع موقعك لضمان دقة الزيارات الميدانية.",
              requestPermissions: true,
              stale: false,
              distanceFilter: 20,
            },
            async (location: any, error: any) => {
              if (error) {
                if (error.code === "NOT_AUTHORIZED") {
                  toast.error(
                    "يرجى السماح بالوصول للموقع دائماً من الإعدادات",
                    {
                      action: {
                        label: "الإعدادات",
                        onClick: () => BackgroundGeolocation.openSettings(),
                      },
                    }
                  );
                }
                return;
              }
              if (location) {
                await handlePositionUpdate(location.latitude, location.longitude, location.accuracy, !!location.simulated);
              }
            }
          );

          watcherIdRef.current = id;
          cleanupFn = async () => {
            if (watcherIdRef.current) {
              await BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
              watcherIdRef.current = null;
            }
          };
        } catch (err) {
          console.error("[Geofence] Native setup error:", err);
          console.warn("[Geofence] Falling back to web geolocation...");
          await setupWebGeolocation();
        }
      } else {
        await setupWebGeolocation();
      }
    };

    // ── Shared web geolocation fallback ──────────────────────────────────────
    async function setupWebGeolocation() {
      try {
        const { Geolocation } = await import("@capacitor/geolocation");
        const permissions = await Geolocation.checkPermissions();
        if (permissions.location !== "granted") {
          const req = await Geolocation.requestPermissions();
          if (req.location !== "granted") return;
        }
        const watchId = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
          (pos, err) => {
            if (!err && pos) {
              // In web fallback, we check for accuracy traces
              const isSuspicious = pos.coords.accuracy === 0 || pos.coords.accuracy === 1;
              handlePositionUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, isSuspicious);
            }
          }
        );
        cleanupFn = () => Geolocation.clearWatch({ id: watchId });
      } catch (geoErr) {
        console.error("[Geofence] Web geolocation error:", geoErr);
      }
    }

    setup();

    // لما التطبيق يرجع للفورجراوند → زامن عبر الـ ref مباشرة
    const listenerPromise = App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) syncAllRef.current();
    });

    // لما النت يرجع → toast مرة واحدة مع debounce + مزامنة
    const handleOnline = () => {
      const now = Date.now();
      if (now - lastOnlineToastAt > ONLINE_TOAST_DEBOUNCE_MS) {
        lastOnlineToastAt = now;
        toast.info("🌐 رجع النت — جاري مزامنة البيانات...");
      }
      syncAllRef.current();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      watcherStartedRef.current = false;
      if (typeof cleanupFn === "function") cleanupFn();
      listenerPromise.then((l) => l.remove());
      window.removeEventListener("online", handleOnline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches.length > 0 ? 1 : 0]); // يُشغَّل مرة واحدة فقط

  return { latestLocation };
}
