export default function AttendanceButton({ todayLogin, loggingIn, loggingOut, onLogin, onLogout }) {
  const isLoggedIn = !!todayLogin
  const isSignedOff = !!(todayLogin?.logout_time)

  if (isSignedOff) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-green-900/30 border-2 border-green-500/40 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="text-green-400 text-xs font-medium">Completed</span>
      </div>
    )
  }

  if (isLoggedIn) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onLogout}
          disabled={loggingOut}
          className="group relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-600/80 to-orange-700/80 border-2 border-amber-500/50 flex items-center justify-center shadow-lg shadow-amber-900/30 hover:scale-105 hover:shadow-amber-700/40 disabled:opacity-60 disabled:scale-100 transition-all duration-200"
        >
          {loggingOut ? (
            <svg className="w-7 h-7 text-white animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          ) : (
            <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
          )}
          <span className="absolute -inset-1 rounded-full border border-amber-400/20 animate-ping opacity-30 group-hover:opacity-0" />
        </button>
        <span className="text-amber-400 text-xs font-medium">{loggingOut ? 'Signing off...' : 'Check Out'}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onLogin}
        disabled={loggingIn}
        className="group relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-600/80 to-blue-800/80 border-2 border-blue-500/50 flex items-center justify-center shadow-lg shadow-blue-900/30 hover:scale-105 hover:shadow-blue-700/40 disabled:opacity-60 disabled:scale-100 transition-all duration-200"
      >
        {loggingIn ? (
          <svg className="w-7 h-7 text-white animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        ) : (
          <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33" />
          </svg>
        )}
        <span className="absolute -inset-1 rounded-full border border-blue-400/30 animate-ping opacity-40 group-hover:opacity-0" />
      </button>
      <span className="text-blue-400 text-xs font-medium">{loggingIn ? 'Locating...' : 'Check In'}</span>
    </div>
  )
}
