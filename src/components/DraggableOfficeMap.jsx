import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

const DEFAULT_LAT = 30.0803897
const DEFAULT_LNG = 31.3524335

export default function DraggableOfficeMap({ lat, lng, radius, onChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const circleRef = useRef(null)

  const validLat = isFinite(parseFloat(lat)) ? parseFloat(lat) : DEFAULT_LAT
  const validLng = isFinite(parseFloat(lng)) ? parseFloat(lng) : DEFAULT_LNG
  const validRadius = isFinite(parseFloat(radius)) && parseFloat(radius) > 0 ? parseFloat(radius) : 200

  useEffect(() => {
    if (!containerRef.current) return

    import('leaflet').then(({ default: L }) => {
      if (mapRef.current) return

      const map = L.map(containerRef.current, {
        center: [validLat, validLng],
        zoom: 16,
        zoomControl: true,
        attributionControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      const pinIcon = L.divIcon({
        className: '',
        html: `
          <div style="
            width:36px;height:36px;
            background:linear-gradient(135deg,#ef4444,#dc2626);
            border:3px solid #fff;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            box-shadow:0 4px 16px rgba(239,68,68,0.55);
            cursor:grab;
          "></div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -38],
      })

      const marker = L.marker([validLat, validLng], {
        draggable: true,
        icon: pinIcon,
      }).addTo(map)

      marker.bindPopup('<b>📍 موقع المكتب</b><br>اسحب لتغيير الموقع', { closeButton: false })

      const circle = L.circle([validLat, validLng], {
        radius: validRadius,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '6 4',
      }).addTo(map)

      marker.on('drag', (e) => {
        const { lat: newLat, lng: newLng } = e.target.getLatLng()
        circle.setLatLng([newLat, newLng])
      })

      marker.on('dragend', (e) => {
        const { lat: newLat, lng: newLng } = e.target.getLatLng()
        circle.setLatLng([newLat, newLng])
        onChange(newLat.toFixed(7), newLng.toFixed(7))
      })

      map.on('click', (e) => {
        const { lat: newLat, lng: newLng } = e.latlng
        marker.setLatLng([newLat, newLng])
        circle.setLatLng([newLat, newLng])
        onChange(newLat.toFixed(7), newLng.toFixed(7))
      })

      mapRef.current = map
      markerRef.current = marker
      circleRef.current = circle
    })

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
        circleRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return
    const newLat = isFinite(parseFloat(lat)) ? parseFloat(lat) : null
    const newLng = isFinite(parseFloat(lng)) ? parseFloat(lng) : null
    if (!newLat || !newLng) return
    const current = markerRef.current.getLatLng()
    if (Math.abs(current.lat - newLat) > 0.00001 || Math.abs(current.lng - newLng) > 0.00001) {
      markerRef.current.setLatLng([newLat, newLng])
      circleRef.current.setLatLng([newLat, newLng])
      mapRef.current.panTo([newLat, newLng], { animate: true, duration: 0.5 })
    }
  }, [lat, lng])

  useEffect(() => {
    if (!circleRef.current) return
    const r = isFinite(parseFloat(radius)) && parseFloat(radius) > 0 ? parseFloat(radius) : 200
    circleRef.current.setRadius(r)
  }, [radius])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '320px', borderRadius: '0', display: 'block' }}
    />
  )
}
