export default function AttendanceButton({ todayLogin, loggingIn, loggingOut, onLogin, onLogout }) {
  const isLoggedIn = !!todayLogin
  const isSignedOff = !!(todayLogin?.logout_time)

  const FingerprintIcon = ({ scanning = false, color = '#a5b4fc' }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9">
      <path d="M20 32c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke={color} strokeWidth="2.8" strokeLinecap="round" className={scanning ? 'animate-pulse' : ''} />
      <path d="M14 32c0-9.941 8.059-18 18-18s18 8.059 18 18" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeOpacity="0.7" className={scanning ? 'animate-pulse' : ''} />
      <path d="M8 32c0-13.255 10.745-24 24-24s24 10.745 24 24" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeOpacity="0.4" className={scanning ? 'animate-pulse' : ''} />
      <path d="M26 32c0-3.314 2.686-6 6-6s6 2.686 6 6c0 4-2 8-6 10" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeOpacity="0.9" className={scanning ? 'animate-pulse' : ''} />
      <path d="M32 26v0" stroke={color} strokeWidth="3" strokeLinecap="round" />
      <path d="M20 44c1.5-3 2.5-7 2.5-12" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeOpacity="0.6" />
      <path d="M44 38c-0.5 2.5-1.5 4.5-3 6" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeOpacity="0.6" />
    </svg>
  )

  if (isSignedOff) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.5), transparent)', filter: 'blur(10px)' }} />
          <div className="relative w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,rgba(5,150,105,0.35),rgba(4,120,87,0.2))', border: '2px solid rgba(16,185,129,0.4)' }}>
            <svg className="w-7 h-7 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <span className="text-emerald-400 text-[11px] font-semibold tracking-wide uppercase">مكتمل</span>
      </div>
    )
  }

  if (isLoggedIn) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onLogout}
          disabled={loggingOut}
          className="relative group w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:scale-100"
          style={{
            background: 'linear-gradient(135deg,#d97706,#b45309)',
            border: '2px solid rgba(245,158,11,0.45)',
            boxShadow: '0 4px 24px rgba(217,119,6,0.4)',
          }}
        >
          <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.2),transparent)' }} />
          {loggingOut ? (
            <svg className="w-8 h-8 text-white/80 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <FingerprintIcon scanning={false} color="#fef3c7" />
          )}
          {!loggingOut && (
            <span className="absolute -inset-2 rounded-full border border-amber-400/25 animate-ping opacity-40 group-hover:opacity-0" />
          )}
        </button>
        <span className="text-amber-400 text-[11px] font-semibold tracking-wide uppercase">
          {loggingOut ? 'جارٍ التسجيل...' : 'تسجيل الانصراف'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onLogin}
        disabled={loggingIn}
        className="relative group w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:scale-100"
        style={{
          background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          border: '2px solid rgba(99,102,241,0.45)',
          boxShadow: '0 4px 24px rgba(79,70,229,0.45)',
        }}
      >
        <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'linear-gradient(135deg,rgba(165,180,252,0.2),transparent)' }} />
        {loggingIn ? (
          <svg className="w-8 h-8 text-white/80 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <FingerprintIcon scanning={true} color="#c7d2fe" />
        )}
        {!loggingIn && (
          <span className="absolute -inset-2 rounded-full border border-indigo-400/25 animate-ping opacity-50 group-hover:opacity-0" />
        )}
      </button>
      <span className="text-indigo-400 text-[11px] font-semibold tracking-wide uppercase">
        {loggingIn ? 'جارٍ التحديد...' : 'تسجيل الحضور'}
      </span>
    </div>
  )
}
