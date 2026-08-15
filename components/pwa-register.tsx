"use client";
import { useEffect } from "react";
export default function PwaRegister(){useEffect(()=>{if("serviceWorker" in navigator){void navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch((error)=>console.warn("[pwa] service worker registration failed",error));}},[]);return null;}
