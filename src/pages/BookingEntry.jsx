import { useEffect } from 'react';
export default function BookingEntry() {
  useEffect(() => { window.location.replace('/service-request'); }, []);
  return <main style={{padding:40,color:'#d5b96c',background:'#090909',minHeight:'100vh'}}><a href="/service-request">Open the Nova booking assistant →</a></main>;
}
