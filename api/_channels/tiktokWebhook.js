import {handleMspWebhook} from './appleWebhook.js';
import {normalizeTikTokMessages} from './tiktokMessages.js';
export const handleTikTokWebhook=(req,res)=>handleMspWebhook(req,res,{provider:'tiktok',normalize:normalizeTikTokMessages});
