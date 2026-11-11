function loadImage(src) {
  const image=new Image();
  image.src=src;
  return image.decode().then(()=>image);
}

function writeWrapped(ctx,text,x,y,maxWidth,lineHeight) {
  let line='';
  for(const word of text.split(' ')){
    const next=line?line+' '+word:word;
    if(line&&ctx.measureText(next).width>maxWidth){
      ctx.fillText(line,x,y);
      y+=lineHeight;
      line=word;
    }else{
      line=next;
    }
  }
  ctx.fillText(line,x,y);
  return y+lineHeight;
}

export async function renderCampaignVideo(scenes,onProgress=()=>{},signal) {
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
        ctx.fillText('N O V A   S Y S T E M S',360,152);
        ctx.fillStyle='#fff8e9';
        ctx.font='64px Georgia, serif';
        const nextY=writeWrapped(ctx,scene.text,360,570,540,78);
        if(scene.detail){
          ctx.fillStyle='#e7bf73';
          ctx.font='29px system-ui';
          ctx.fillText(scene.detail,360,nextY+30);
        }
        ctx.fillStyle='#ebd6ae';
        ctx.font='23px system-ui';
        ctx.fillText('AUDIT  ·  SYSTEMS  ·  OPPORTUNITY',360,1150);
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
