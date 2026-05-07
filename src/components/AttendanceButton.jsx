export default function AttendanceButton({ todayLogin, loggingIn, loggingOut, onLogin, onLogout }) {
  const isLoggedIn = !!todayLogin
  const isSignedOff = !!(todayLogin?.logout_time)

  if (isSignedOff) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full opacity-30"
            style={{background:'radial-gradient(circle, rgba(16,185,129,0.4), transparent)', filter:'blur(8px)'}} />
          <div className="relative w-14 h-14 rounded-full flex items-center justify-center"
            style={{background:'linear-gradient(135deg,rgba(5,150,105,0.3),rgba(4,120,87,0.2))', border:'2px solid rgba(16,185,129,0.35)'}}>
            <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <span className="text-emerald-400 text-[11px] font-semibold tracking-wide uppercase">Completed</span>
      </div>
    )
  }

  if (isLoggedIn) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onLogout}
          disabled={loggingOut}
          className="relative group w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:scale-100"
          style={{
            background: 'linear-gradient(135deg,#d97706,#b45309)',
            border: '2px solid rgba(245,158,11,0.4)',
            boxShadow: '0 4px 20px rgba(217,119,6,0.35)',
          }}
        >
          <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{background:'linear-gradient(135deg,rgba(251,191,36,0.2),transparent)'}} />
          {loggingOut ? (
            <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          ) : (
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          )}
          {!loggingOut && (
            <span className="absolute -inset-1.5 rounded-full border border-amber-400/20 animate-ping opacity-40 group-hover:opacity-0" />
          )}
        </button>
        <span className="text-amber-400 text-[11px] font-semibold tracking-wide uppercase">
          {loggingOut ? 'Signing off...' : 'Check Out'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onLogin}
        disabled={loggingIn}
        className="relative group w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:scale-100"
        style={{
          background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          border: '2px solid rgba(99,102,241,0.4)',
          boxShadow: '0 4px 20px rgba(79,70,229,0.4)',
        }}
      >
        <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{background:'linear-gradient(135deg,rgba(165,180,252,0.2),transparent)'}} />
        {loggingIn ? (
          <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        ) : (
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l3 3m0 0l-3 3m3-3H2.25" />
          </svg>
        )}
        {!loggingIn && (
          <span className="absolute -inset-1.5 rounded-full border border-indigo-400/25 animate-ping opacity-50 group-hover:opacity-0" />
        )}
      </button>
      <span className="text-indigo-400 text-[11px] font-semibold tracking-wide uppercase">
        {loggingIn ? 'Locating...' : 'Check In'}
      </span>
    </div>
  )
}
