export default function AttendanceButton({ todayLogin, loggingIn, loggingOut, onLogin, onLogout, pendingRemoteRequest, rejectedRemoteRequest }) {
  const isLoggedIn = !!todayLogin
  const isSignedOff = !!(todayLogin?.logout_time)
  const isRemote = todayLogin?.attendance_type === 'remote'

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

  const HomeIcon = ({ color = '#86efac' }) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )

  if (pendingRemoteRequest) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.5), transparent)', filter: 'blur(10px)' }} />
          <div className="relative w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,rgba(120,80,0,0.4),rgba(90,60,0,0.25))', border: '2px solid rgba(245,158,11,0.4)' }}>
            <svg className="w-8 h-8 text-amber-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
            </svg>
          </div>
        </div>
        <span className="text-amber-400 text-[11px] font-semibold tracking-wide text-center">في انتظار الموافقة</span>
        <span className="text-[10px] text-amber-300/60">🏠 طلب عن بُعد</span>
      </div>
    )
  }

  if (rejectedRemoteRequest) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full opacity-30"
            style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.5), transparent)', filter: 'blur(10px)' }} />
          <div className="relative w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,rgba(120,20,20,0.4),rgba(90,10,10,0.25))', border: '2px solid rgba(239,68,68,0.4)' }}>
            <svg className="w-7 h-7 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        </div>
        <span className="text-red-400 text-[11px] font-semibold tracking-wide text-center">تم الرفض</span>
        <span className="text-[10px] text-red-300/70 text-center leading-tight">الرجاء التوجه<br/>إلى المكتب</span>
        <button
          onClick={() => onLogin('office')}
          disabled={loggingIn}
          className="mt-1 text-[10px] text-indigo-300 hover:text-indigo-200 bg-indigo-900/30 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all disabled:opacity-50"
        >
          تسجيل حضور المكتب
        </button>
      </div>
    )
  }

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
        {isRemote && <span className="text-[10px] text-green-300/70 font-medium">🏠 عن بُعد</span>}
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
            background: isRemote
              ? 'linear-gradient(135deg,#15803d,#166534)'
              : 'linear-gradient(135deg,#d97706,#b45309)',
            border: isRemote
              ? '2px solid rgba(74,222,128,0.45)'
              : '2px solid rgba(245,158,11,0.45)',
            boxShadow: isRemote
              ? '0 4px 24px rgba(34,197,94,0.4)'
              : '0 4px 24px rgba(217,119,6,0.4)',
          }}
        >
          <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'linear-gradient(135deg,rgba(251,191,36,0.2),transparent)' }} />
          {loggingOut ? (
            <svg className="w-8 h-8 text-white/80 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : isRemote ? (
            <HomeIcon color="#bbf7d0" />
          ) : (
            <FingerprintIcon scanning={false} color="#fef3c7" />
          )}
          {!loggingOut && (
            <span className={`absolute -inset-2 rounded-full border animate-ping opacity-40 group-hover:opacity-0 ${isRemote ? 'border-green-400/25' : 'border-amber-400/25'}`} />
          )}
        </button>
        <span className={`text-[11px] font-semibold tracking-wide uppercase ${isRemote ? 'text-green-400' : 'text-amber-400'}`}>
          {loggingOut ? 'جارٍ التسجيل...' : 'تسجيل الانصراف'}
        </span>
        {isRemote && !loggingOut && <span className="text-[10px] text-green-300/70 font-medium">🏠 عن بُعد</span>}
      </div>
    )
  }

  return (
    <AttendanceModeSelector onLogin={onLogin} loggingIn={loggingIn} />
  )
}

function AttendanceModeSelector({ onLogin, loggingIn }) {
  const FingerprintIcon = ({ scanning = false, color = '#a5b4fc' }) => (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
      <path d="M20 32c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke={color} strokeWidth="2.8" strokeLinecap="round" className={scanning ? 'animate-pulse' : ''} />
      <path d="M14 32c0-9.941 8.059-18 18-18s18 8.059 18 18" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeOpacity="0.7" className={scanning ? 'animate-pulse' : ''} />
      <path d="M8 32c0-13.255 10.745-24 24-24s24 10.745 24 24" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeOpacity="0.4" className={scanning ? 'animate-pulse' : ''} />
      <path d="M26 32c0-3.314 2.686-6 6-6s6 2.686 6 6c0 4-2 8-6 10" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeOpacity="0.9" className={scanning ? 'animate-pulse' : ''} />
      <path d="M32 26v0" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  )

  const HomeIcon = ({ color = '#86efac' }) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">سجّل حضورك</p>
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={() => onLogin('office')}
            disabled={loggingIn}
            className="relative group w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:scale-100"
            style={{
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
              border: '2px solid rgba(99,102,241,0.45)',
              boxShadow: '0 4px 20px rgba(79,70,229,0.45)',
            }}
          >
            <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'linear-gradient(135deg,rgba(165,180,252,0.2),transparent)' }} />
            {loggingIn === 'office' ? (
              <svg className="w-7 h-7 text-white/80 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <FingerprintIcon scanning={true} color="#c7d2fe" />
            )}
            {!loggingIn && (
              <span className="absolute -inset-1.5 rounded-full border border-indigo-400/25 animate-ping opacity-50 group-hover:opacity-0" />
            )}
          </button>
          <span className="text-indigo-400 text-[10px] font-semibold tracking-wide">مكتب</span>
        </div>

        <div className="w-px h-10 bg-white/10" />

        <div className="flex flex-col items-center gap-1.5">
          <button
            onClick={() => onLogin('remote')}
            disabled={loggingIn}
            className="relative group w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-60 disabled:scale-100"
            style={{
              background: 'linear-gradient(135deg,#15803d,#166534)',
              border: '2px solid rgba(74,222,128,0.45)',
              boxShadow: '0 4px 20px rgba(34,197,94,0.35)',
            }}
          >
            <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'linear-gradient(135deg,rgba(134,239,172,0.2),transparent)' }} />
            {loggingIn === 'remote' ? (
              <svg className="w-7 h-7 text-white/80 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <HomeIcon color="#bbf7d0" />
            )}
            {!loggingIn && (
              <span className="absolute -inset-1.5 rounded-full border border-green-400/25 animate-ping opacity-50 group-hover:opacity-0" />
            )}
          </button>
          <span className="text-green-400 text-[10px] font-semibold tracking-wide">عن بُعد</span>
        </div>
      </div>
    </div>
  )
}
