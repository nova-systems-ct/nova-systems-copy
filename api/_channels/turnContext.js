import {AsyncLocalStorage} from 'node:async_hooks';
const turns=new AsyncLocalStorage();
export const currentChannelTurn=()=>turns.getStore();
export const withChannelTurn=(context,run)=>turns.run(context,run);
