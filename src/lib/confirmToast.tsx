import { toast } from "react-toastify";

export function confirmToast(message: string, onConfirm: () => void, confirmLabel = "Confirm") {
  const toastId = "confirm-action";
  toast.dismiss(toastId);

  toast(
    ({ closeToast }: { closeToast?: () => void }) => (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-mist">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => closeToast?.()}
            className="text-xs rounded-md border border-mist/30 text-mist px-3 py-1.5 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              closeToast?.();
            }}
            className="text-xs rounded-md bg-coral text-deep-navy font-semibold px-3 py-1.5 hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    ),
    {
      toastId,
      autoClose: false,
      closeOnClick: false,
      draggable: false,
      className: "!bg-ocean-blue !border !border-sea-foam/30",
    }
  );
}