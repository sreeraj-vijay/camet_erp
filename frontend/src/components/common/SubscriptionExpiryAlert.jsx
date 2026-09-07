import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const getSubscriptionAlertDetails = (user) => {
  const expiresAt = user?.subscription?.expiresAt;
  const expiryTime = new Date(expiresAt).getTime();

  if (!expiresAt || Number.isNaN(expiryTime)) return null;

  const daysRemaining = Math.ceil((expiryTime - Date.now()) / DAY_IN_MS);
  if (daysRemaining <= 0 || daysRemaining > 7) return null;

  return { expiresAt, daysRemaining };
};

export const subscriptionHasExpired = (user) => {
  const expiresAt = user?.subscription?.expiresAt;
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
};

function SubscriptionExpiryAlert({ user, variant = "popup" }) {
  const details = getSubscriptionAlertDetails(user);
  const dismissalKey = details
    ? `subscription-alert-dismissed:${user?._id || user?.primaryUser || "account"}:${details.expiresAt}`
    : null;
  const [isDismissed, setIsDismissed] = useState(
    () => dismissalKey && sessionStorage.getItem(dismissalKey) === "true",
  );

  if (!details || (variant === "popup" && isDismissed)) return null;

  const expiryDate = new Date(details.expiresAt).toLocaleDateString();
  const days = details.daysRemaining;

  const dismissAlert = () => {
    sessionStorage.setItem(dismissalKey, "true");
    setIsDismissed(true);
  };

  if (variant === "sidebar") {
    return (
      <div
        title={`Your subscription ends in ${days} day${days === 1 ? "" : "s"}.`}
        className="mx-1 mt-3 rounded border-2 border-red-400 bg-red-50 px-3 py-2 text-center text-xs font-bold leading-none text-red-700 shadow-sm"
      >
        Subscription ends in {days} day{days === 1 ? "" : "s"}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="subscription-alert-title"
        className="w-full max-w-md rounded-xl border-2 border-amber-400 bg-white p-5 shadow-2xl animate-pulse"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-amber-100 p-2">
            <AlertTriangle className="h-6 w-6 text-amber-700" />
          </div>
          <div className="flex-1">
            <h2 id="subscription-alert-title" className="text-base font-bold text-amber-950">
              Subscription expiry alert
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-700">
              Your subscription ends in {days} day{days === 1 ? "" : "s"} ({expiryDate}). Please renew to avoid losing access.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissAlert}
            aria-label="Close subscription expiry alert"
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionExpiryAlert;
