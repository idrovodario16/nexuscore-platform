import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {batchSchema,mergeEvents,snapshotEvents} from '../src/model.js';
const fixture=JSON.parse(readFileSync(new URL('../examples/operations.events.json',import.meta.url)))[0];

function withTimestamp(field,value){
 const event=structuredClone(fixture);
 (field==='occurred_at'?event:event.data)[field]=value;
 return event;
}

test('acepta UTC y offsets en los tres campos temporales sin cambiar su texto',()=>{
 for(const field of ['occurred_at','created_at','updated_at']){
  for(const value of ['2026-11-21T09:00:00Z','2026-11-21T09:00:00.123-05:00','2026-11-21T09:00:00+05:30']){
   const event=withTimestamp(field,value);
   const before=structuredClone(event);
   const parsed=batchSchema.parse([event])[0];
   assert.equal((field==='occurred_at'?parsed:parsed.data)[field],value);
   assert.deepEqual(event,before);
  }
 }
});

test('rechaza fechas sin zona, epochs y offsets inválidos sin cambiar el estado',()=>{
 const current=mergeEvents([], [fixture]);
 const before=structuredClone(current);
 for(const field of ['occurred_at','created_at','updated_at']){
  for(const value of ['2026-11-21T09:00:00',1704067200,'1704067200','2026-11-21T09:00:00+25:00']){
   assert.throws(()=>mergeEvents(current,[fixture,withTimestamp(field,value)]));
   assert.deepEqual(current,before);
  }
 }
});

test('exporta y reimporta offsets sin duplicar ni perder la revisión mayor',()=>{
 const event=structuredClone(fixture);
 event.occurred_at=event.data.created_at=event.data.updated_at='2026-11-21T09:00:00-05:00';
 event.data.revision=3;
 const current=mergeEvents([], [event]);
 const exported=snapshotEvents(current);
 assert.equal(batchSchema.parse(exported)[0].occurred_at,event.data.updated_at);
 const restored=mergeEvents(current,[...exported,fixture]);
 assert.equal(restored.length,1);
 assert.equal(restored[0].revision,3);
 assert.equal(restored[0].created_at,event.data.created_at);
 assert.equal(restored[0].updated_at,event.data.updated_at);
});
