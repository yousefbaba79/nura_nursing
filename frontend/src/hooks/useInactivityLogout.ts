import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "touchstart", "scroll"];

export function useInactivityLogout(timeoutMinutes: number) {
  const { logout, consultant } = useAuth();
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!consultant || !timeoutMinutes) return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        await logout();
        navigate("/login", { replace: true, state: { reason: "timeout" } });
      }, timeoutMinutes * 60 * 1000);
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, resetTimer));
    resetTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [consultant, timeoutMinutes, logout, navigate]);
}
