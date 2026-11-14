function loadImage(src) {
  const image=new Image();
  image.src=src;
  return image.decode().then(()=>image);
}

function wrapLines(ctx,text,maxWidth) {
  const lines=[];let line='';
  for(const word of String(text).split(/\s+/)){
    const next=line?line+' '+word:word;
    if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;
  }
  if(line)lines.push(line);
  return lines;
}

export async function renderCampaignVideo(scenes,onProgress=()=>{},signal,brand='NOVA SYSTEMS') {
  const formats=['video/webm;codecs=vp8','video/mp4'];
  const mime=typeof MediaRecorder==='undefined'?null:formats.find(format=>MediaRecorder.isTypeSupported(format));
  if(!mime||!HTMLCanvasElement.prototype.captureStream)throw Error('This browser cannot render a video preview. Try a current desktop browser.');
  const image=await loadImage('/nova-studio/gold-network.jpg');
  signal?.throwIfAborted();
  const canvas=document.createElement('canvas');
  canvas.width=720;
  canvas.height=1280;
  const ctx=canvas.getContext('2d');
  const duration=scenes.reduce((total,scene)=>total+scene.seconds,0);
  const stream=canvas.captureStream(24);
  let frame=0;
  let cancel;
  try{
    return await new Promise((resolve,reject)=>{
      const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1500000});
      const chunks=[];
      cancel=()=>{
        reject(signal.reason);
        if(recorder.state==='recording')recorder.stop();
      };
      signal?.addEventListener('abort',cancel,{once:true});
      recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)};
      recorder.onerror=()=>reject(Error('The video preview could not be recorded.'));
      recorder.onstop=()=>{
        const blob=new Blob(chunks,{type:recorder.mimeType});
        if(!blob.size){reject(Error('No video was recorded. Keep this tab open and try again.'));return;}
        resolve(blob);
      };
      const started=performance.now();
      const draw=now=>{
        const elapsed=(now-started)/1000;
        let scene=scenes[0];
        let boundary=scene.seconds;
        for(let i=1;i<scenes.length&&elapsed>=boundary;i++){
          scene=scenes[i];
          boundary+=scene.seconds;
        }
        const scale=Math.max(canvas.width/image.width,canvas.height/image.height)*(1+Math.min(elapsed,duration)*.012);
        const width=image.width*scale;
        const height=image.height*scale;
        ctx.drawImage(image,(canvas.width-width)/2,(canvas.height-height)/2,width,height);
        const shade=ctx.createLinearGradient(0,0,0,1280);
        shade.addColorStop(0,'#08070799');
        shade.addColorStop(.52,'#080707df');
        shade.addColorStop(1,'#080707');
        ctx.fillStyle=shade;
        ctx.fillRect(0,0,720,1280);
        ctx.strokeStyle='#d1aa5b';
        ctx.lineWidth=2;
        ctx.strokeRect(42,52,636,1176);
        ctx.textAlign='center';
        ctx.fillStyle='#efcb80';
        ctx.font='600 27px system-ui';
        ctx.fillText(brand.slice(0,36).toUpperCase(),360,152);
        ctx.fillStyle='#fff8e9';
        let fontSize=64,lines;
        do{ctx.font=`${fontSize}px Georgia, serif`;lines=wrapLines(ctx,scene.text,540);if(lines.length*fontSize*1.18<=450)break;fontSize-=2;}while(fontSize>32);
        const lineHeight=fontSize*1.18;
        const textTop=420+Math.max(0,(470-lines.length*lineHeight)/2);
        lines.forEach((line,i)=>ctx.fillText(line,360,textTop+i*lineHeight));
        if(scene.detail){
          ctx.fillStyle='#e7bf73';ctx.font='24px system-ui';
          const detailTop=textTop+lines.length*lineHeight+28;
          wrapLines(ctx,scene.detail,540).forEach((line,i)=>ctx.fillText(line,360,detailTop+i*30));
        }
        ctx.fillStyle='#ebd6ae';
        ctx.font='23px system-ui';
        ctx.fillText('THE WORK. THE PROGRESS. THE NEXT STEP.',360,1150);
        onProgress(Math.min(100,Math.floor(elapsed/duration*100)));
        if(elapsed>=duration){recorder.stop();return;}
        frame=requestAnimationFrame(draw);
      };
      recorder.start();
      frame=requestAnimationFrame(draw);
    });
  }finally{
    if(cancel)signal?.removeEventListener('abort',cancel);
    cancelAnimationFrame(frame);
    stream.getTracks().forEach(track=>track.stop());
  }
}
