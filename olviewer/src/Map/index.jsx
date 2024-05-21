import React, { useState, useRef, useEffect } from 'react'
import './index.css'
import Map from 'ol/Map'
import XYZ from 'ol/source/XYZ'
import TileLayer from 'ol/layer/Tile'
import View from 'ol/View';
import {transform} from 'ol/proj.js';
import 'ol/ol.css';

const apiKey = process.env.APIKEY || ''
const defaultMapStyle = process.env.DEFAULT_MAPSTYLE || 'satmap'
const region = process.env.REGION || 'ap-southeast-2'
const cloudfront = process.env.CLOUDFRONT || ''

export default () => {
  useEffect(()=> {
    const osmLayer = new TileLayer({
      preload: Infinity,
      source: new XYZ({
        url: `https://maps.geo.${region}.amazonaws.com/maps/v0/maps/${defaultMapStyle}/tiles/{z}/{x}/{y}?key=${apiKey}`
      }),
    })
    
    const map = new Map({
      target: "map",
      layers: [
        osmLayer,
        new TileLayer({
          source: new XYZ({
            url: `${cloudfront}/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?url=https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/50/H/LH/2024/5/S2A_50HLH_20240520_0_L2A/TCI.tif`
          })
        })
      ],
      view: new View({
          center: transform([115.463330454, -33.885], 'EPSG:4326', 'EPSG:3857'),
          zoom: 9,
        }),
    })
    return () => map.setTarget(null)
  }, [])
  const mapRef = useRef()
  return <div ref={mapRef} id="map" style={{ width: '100vw', height: '100vh' }}></div>;
}
