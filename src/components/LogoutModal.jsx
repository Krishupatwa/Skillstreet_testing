export default function LogoutModal({ open, onClose, onConfirm }) {
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6 transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      <div className="w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/40">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 text-white">
          <i className="fas fa-sign-out-alt text-xl"></i>
        </div>
        <h3 className="text-xl font-semibold text-white">Logout Confirmation</h3>
        <p className="mt-2 text-sm text-slate-400">Are you sure you want to logout?</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-700">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400">
            Yes, Logout
          </button>
        </div>
      </div>
    </div>
  );
}
