import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeEvents,metrics} from '../src/model.js';
const batch=JSON.parse(readFileSync(new URL('../examples/operations.events.json',import.meta.url)));

function uuidEvent() {
 const event=structuredClone(batch[0]);
 event.organization_id=event.data.organization_id='abcdefab-cdef-4abc-8def-abcdefabcdef';
 event.data.id='fedcbafe-dcba-4fed-8cba-fedcbafedcba';
 return event;
}

test('normaliza UUID antes de comparar empresa y revisión, sin duplicar métricas',()=>{
 const first=uuidEvent();
 first.data.status='completed';
 const newer=structuredClone(first);
 newer.organization_id=newer.organization_id.toUpperCase();
 newer.data.id=newer.data.id.toUpperCase();
 newer.data.revision=3;
 newer.data.amount_cents=900;
 const snapshot=structuredClone([first,newer]);
 const rows=mergeEvents([], [first,newer,first]);
 assert.equal(rows.length,1);
 assert.equal(rows[0].revision,3);
 assert.equal(rows[0].id,first.data.id);
 assert.equal(rows[0].organization_id,first.organization_id);
 assert.deepEqual(metrics(rows),{total:1,completed:1,open:0,completion:100,value_cents:900});
 assert.deepEqual([first,newer],snapshot,'la importación no modifica el lote original');
});

test('deduplica reenvíos con todos los UUID en mayúsculas sin degradar revisión',()=>{
 const first=uuidEvent();
 const newer=structuredClone(first);
 newer.event_id=newer.event_id.toUpperCase();
 newer.organization_id=newer.data.organization_id=newer.organization_id.toUpperCase();
 newer.data.id=newer.data.id.toUpperCase();
 newer.data.revision=3;
 for(const events of [[first,newer,first],[newer,first,newer]]) {
  const rows=mergeEvents([],events);
  assert.equal(rows.length,1);
  assert.equal(rows[0].revision,3);
  assert.equal(rows[0].id,first.data.id);
  assert.equal(rows[0].organization_id,first.organization_id);
 }
});

test('reconcilia UUID existentes conservando la revisión mayor en cualquier orden',()=>{
 const first=uuidEvent();
 const upper={...first.data,id:first.data.id.toUpperCase(),organization_id:first.organization_id.toUpperCase(),revision:3};
 for(const current of [[first.data,upper],[upper,first.data]]) {
  const before=structuredClone(current);
  const rows=mergeEvents(current,[first]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].revision,3);
  assert.equal(rows[0].id,first.data.id);
  assert.equal(rows[0].organization_id,first.organization_id);
  assert.deepEqual(current,before);
 }
});

test('UUID normalizados mantienen empresas distintas y rechazo atómico de lotes',()=>{
 const first=uuidEvent();
 const other=structuredClone(first);
 other.organization_id=other.data.organization_id='bcdefabc-defa-4bcd-8efa-bcdefabcdefa';
 const current=mergeEvents([], [first,other]);
 assert.equal(current.length,2);
 const invalid=structuredClone(first);
 invalid.organization_id=other.organization_id;
 const before=structuredClone(current);
 assert.throws(()=>mergeEvents(current,[first,invalid]));
 assert.deepEqual(current,before);
});
