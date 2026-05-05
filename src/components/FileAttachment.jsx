function isImageFile(url, name) {
  const imageExtRe = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif|tiff?)$/i
  if (url && imageExtRe.test(url)) return true
  if (name && imageExtRe.test(name)) return true
  return false
}

function getFileInfo(name) {
  if (!name) return { icon: null, label: 'File', color: 'text-slate-400' }
  const ext = name.split('.').pop()?.toLowerCase()
  if (['pdf'].includes(ext)) return { icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z"/><path d="M8 13h8v2H8zm0 3h5v2H8z"/></svg>
  ), label: 'PDF', color: 'text-red-400' }
  if (['doc','docx'].includes(ext)) return { icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
  ), label: 'Word', color: 'text-blue-400' }
  if (['xls','xlsx','csv'].includes(ext)) return { icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>
  ), label: 'Spreadsheet', color: 'text-green-400' }
  if (['zip','rar','7z','tar','gz'].includes(ext)) return { icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.52 15.48 0 12.36 0H11.5C8.38 0 6 2.43 6 5.5c0 .5.07.95.18 1.36L4 7a2 2 0 00-2 2v11a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2z"/></svg>
  ), label: 'Archive', color: 'text-yellow-400' }
  if (['mp4','mov','avi','mkv','webm'].includes(ext)) return { icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /></svg>
  ), label: 'Video', color: 'text-purple-400' }
  if (['mp3','wav','ogg','aac'].includes(ext)) return { icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" /></svg>
  ), label: 'Audio', color: 'text-pink-400' }
  return { icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" /></svg>
  ), label: ext?.toUpperCase() || 'File', color: 'text-slate-400' }
}

export default function FileAttachment({ url, name }) {
  if (!url) return null

  if (isImageFile(url, name)) {
    return (
      <div className="mt-3">
        <div
          className="relative inline-block rounded-xl overflow-hidden border border-white/10 cursor-pointer group shadow-lg"
          onClick={() => window.open(url, '_blank')}
          style={{maxWidth: '280px'}}
        >
          <img
            src={url}
            alt={name || 'Image'}
            className="block max-h-64 w-full object-contain"
            style={{background:'rgba(0,0,0,0.2)'}}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-full p-2">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>
        {name && (
          <p className="text-slate-500 text-[11px] mt-1.5 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            {name}
          </p>
        )}
      </div>
    )
  }

  const displayName = name || url.split('/').pop() || 'Download'
  const { icon, label, color } = getFileInfo(displayName)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      download={displayName}
      className="mt-3 inline-flex items-center gap-3 rounded-xl px-4 py-3 border border-white/10 hover:border-white/20 transition-all group max-w-xs"
      style={{background:'rgba(255,255,255,0.04)'}}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
    >
      <div className={`${color} flex-shrink-0`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium truncate">{displayName}</p>
        <p className={`text-[10px] mt-0.5 ${color} opacity-70`}>{label}</p>
      </div>
      <div className="flex-shrink-0 text-slate-500 group-hover:text-slate-300 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      </div>
    </a>
  )
}
