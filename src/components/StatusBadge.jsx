export default function StatusBadge({ status }) {
  return (
    <span className={`status-${status} text-xs font-medium px-2.5 py-1 rounded-full capitalize mono`}>
      {status}
    </span>
  )
}
