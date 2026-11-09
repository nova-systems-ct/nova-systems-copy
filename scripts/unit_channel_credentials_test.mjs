import assert from 'node:assert/strict';
import {channelToken,channelCredentialsAssigned} from '../api/_channels/delivery.js';
const env={NOVA_CHANNEL_TOKEN_OWNED:'LOCAL-SECRET'},draft={token_ref:'NOVA_CHANNEL_TOKEN_OWNED'};
assert.equal(channelToken(draft,env),null,'Knowing an environment-variable name must not grant a business access to the key');
assert.equal(channelCredentialsAssigned({...draft,credentials_assigned_at:new Date().toISOString()}),false);
assert.equal(channelCredentialsAssigned({...draft,credentials_assigned_by:'admin'}),false);
assert.equal(channelToken({...draft,credentials_assigned_by:'admin',credentials_assigned_at:new Date().toISOString()},env),'LOCAL-SECRET');
assert.equal(channelToken({...draft,credentials_assigned_by:'admin',credentials_assigned_at:new Date().toISOString(),token_ref:'SUPABASE_SERVICE_ROLE_KEY'},env),null);
console.log('PASS — server credential references confer no access without a separate authorized assignment');
