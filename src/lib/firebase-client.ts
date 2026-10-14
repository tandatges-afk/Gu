'use client';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
const config = {
  apiKey:process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId:process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
function clientApp(){
  if(!config.apiKey||!config.projectId)throw new Error('Thiếu cấu hình Firebase Web trong .env.local.');
  return getApps().length?getApp():initializeApp(config);
}
export function clientAuth(){return getAuth(clientApp());}
