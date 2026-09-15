import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localSchedule,demoSummary,type Call} from '../shared/model.ts';
import {waitingStage} from '../shared/waiting.ts';
test('invalid and past dates are rejected',()=>{assert.throws(()=>localSchedule('2027-02-30','22:00',0));assert.throws(()=>localSchedule('2027-01-01','25:00',0));assert.throws(()=>localSchedule('2020-01-01','22:00'));});
test('waiting becomes quiet near the call with no extra notification event',()=>{assert.equal(waitingStage(1800000),'reserved');assert.equal(waitingStage(300000),'settling');assert.equal(waitingStage(60000),'soon');});
test('no transcript consent also means no derived quote or memory',()=>{const c:Call={id:'x',voice:'Noah',situation:'private',scheduledAt:0,timezone:'Asia/Seoul',consent:false,memoryConsent:true,status:'completed'};const r=demoSummary(c,[{speaker:'caller',text:'private phrase'}]);assert.equal(r.quote,undefined);assert.equal(r.summary,undefined);});
