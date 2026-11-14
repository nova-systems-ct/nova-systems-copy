export function withTimeout(promise,ms=12000){
  let timer;
  return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Sign-in took too long. Reload the page or sign in again.')),ms);})]).finally(()=>clearTimeout(timer));
}
