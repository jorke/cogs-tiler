import React, { useState, useRef, useEffect, useMemo } from 'react'
import MapGL, {
  NavigationControl,
  GeolocateControl,
  Source,
  Layer,
  useMap,
  useControl
} from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import './index.css'
import LatLonBox from '../LatLonBox'

const apiKey = process.env.APIKEY || ''
const defaultMapStyle = process.env.DEFAULT_MAPSTYLE || 'vectormap'
const region = process.env.REGION || ''

const cfdomain = process.env.VITE_CLOUDFRONT_DOMAIN || '' 
const api = process.env.VITE_API || ''

const Map = () => {
  const [viewport, setViewport] = useState({
    longitude: 115.463330454,
    latitude: -33.885,
    zoom: 9,
  })

  const [sources, setSources] = useState([])
  const [colormaps, setColormaps] = useState([])
  const [lngLat, setLngLat] = useState({ lat: viewport.latitude, lng: viewport.longitude})

  const mapRef = useRef()

  //TODO: static list of cogs.
  const cogs = [
    "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/50/H/LH/2024/5/S2A_50HLH_20240520_0_L2A/TCI.tif",
    // "s3://<bucket>/<file>.tif",
  ]

  const bandParams = list => list.map(b => `bidx=${b}`).join('&')
 
  useEffect(() => {
    // bit of a hack, data should be stored in repo like ddb.
    const fetchSourceData = async () => {
      const sourcedata = await Promise.all(
        cogs.map(s => fetch(`${api}/info?url=${s}`).then(async d => {
            const info = await d.json()
            const tileinfo = await fetch(`${api}/WebMercatorQuad/tilejson.json?url=${s}`).then(x => x.json())
            const selectedBands = info.count > 4 ? [1,2,3] : []
            // set the tiles url to use cloudfront
            const tileUrl = `${cfdomain}/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=${s}&${bandParams(selectedBands)}`

            return {
              url: s,
              ...tileinfo,
              ...info,
              ...{selectedBands: selectedBands},
              ...{colormap: 'spectral'},
              tiles: [tileUrl]
            }
      })))
      console.log(sourcedata)
      setSources(sourcedata)  
    }

    const fetchColorMaps = async () => {
      const { colorMaps } = await fetch(`${api}/colorMaps`).then(d => d.json())
      setColormaps(colorMaps)
    }
    
    fetchSourceData()
    fetchColorMaps()

  }, [])
  
  // eslint-disable-next-line react/prop-types
  const ColorMapSelector = ({ defaultVal, colormaps, idx }) => {
    const selectColorMap = e => {
      const colormap = e.target.value
      sources[idx].tiles = [
        `${cfdomain}/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=${sources[idx].url}&${bandParams([sources[idx].selectedBands])}&rescale=0,65535&colormap_name=${colormap}`]
      setSources(sources)
    }
  
    return (
      <label>
        ColorMap:
        <select defaultValue={defaultVal} name={`colormap-${idx}`} onChange={selectColorMap}>
          {//  eslint-disable-next-line react/prop-types
          colormaps.map((c, i) => (
            <option key={i} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
    )
  }
  // eslint-disable-next-line react/prop-types
  const CheckBox = ({value, label}) => {
    const [ band, sourceindex] = value
    const [isChecked, setIsChecked] = useState(false)

    const checkHandler = e => {
      const bandval = e.target.value[1]
      console.log(sourceindex)
      console.log(sources[sourceindex])
      sources[sourceindex].selectedBands = [bandval]
      sources[sourceindex].tiles = [`${cfdomain}/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=${sources[sourceindex].url}&${bandParams([bandval])}&rescale=0,65535&colormap_name=${sources[sourceindex].colormap}`]
      setSources(sources)
      console.log(sources)

      setIsChecked(!isChecked)
    }
    
    return (
      <label>
        <input type="checkbox" name={`${label}-${value}`} value={band} checked={isChecked} onChange={checkHandler} />
        {label}
      </label>
    )
  }

  return (
    (apiKey && defaultMapStyle && region) ?
      <>
        <MapGL
          id="mainmap"
          initialViewState={viewport} 
          ref={mapRef}
          // onViewportChange={(v) => setViewport(v)}
          width="100vw"
          height="100vh"
          mapStyle={`https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${defaultMapStyle}/style-descriptor?key=${apiKey}`}
          onMouseMove={(m) =>setLngLat(m.lngLat)}
          tileSize={512}
          maxZoom={27}
          onLoad={() => mapRef}
        >
        
          { sources.map((s, i) => (
            <Source key={`source-${i}`} id={`source-${i}`} type="raster" bounds={s.bounds} tiles={s.tiles} maxzoom={s.maxzoom}>
              <Layer key={`layer-${i}`} id={`layer-${i}`} source={`source-${i}`} type="raster" paint={{
                "raster-resampling": "nearest"
              }}/>
            </Source>
          ))}
          
          <GeolocateControl
            style={{ right: 10, bottom: 85 }}
            positionOptions={{ enableHighAccuracy: true }}
            trackUserLocation
            auto={false}
          />
          <NavigationControl
              style={{ right: 10, bottom: 20 }}
              showCompass={false}
            />
        </MapGL>
        <LatLonBox data={lngLat} />
        <div className='selectors'>
          { sources.map((s, i) => (
            <div key={`fly-${i}`}>
              <button onClick={() => mapRef.current.flyTo({center: [s.center[0], s.center[1]]})}>{s.url}</button>
              {s.band_descriptions.length > 4 ? (
                <>
                  <div>{s.band_descriptions.map(b => <CheckBox key={b} value={[b[0], i]} label={b[1]} />)}</div>
                  <div><ColorMapSelector defaultVal={s.colormap} colormaps={colormaps} idx={i} /></div>
                </>
              ): <></>}
            </div>
          ))}
        </div>
      </>

    :
      <h1>check your env variables for APIKEY, DEFAULT_MAPSTYLE, and REGION respectively. 
        You can also check the README for more details.
      </h1>
  )
}

export default Map
