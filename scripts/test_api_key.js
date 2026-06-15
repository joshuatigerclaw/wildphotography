#!/usr/bin/env node
const {neon}=require('@neondatabase/serverless');
const c=require('crypto');
const sql=neon('postgresql://neondb_owner:npg_BvF2JsQ8drba@ep-calm-fire-ad0dfnqd-pooler.c-2.us-east-1.aws.neon.tech/wildphotography?sslmode=require');
async function m(){
  const e='t_'+Date.now()+'@x.com';
  const n=new Date();
  const e2=new Date(n);e2.setDate(e2.getDate()+30);
  const[r]=await sql`INSERT INTO api_customers (email,name,plan_id,status,current_period_start,current_period_end) VALUES (${e},'T',2,'active',${n},${e2}) RETURNING id`;
  const p='wild_live_'+Math.random().toString(36).slice(2,6);
  const s=Array.from({length:32},()=>'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random()*32)]).join('');
  const f=p+'_'+s;
  const h=c.createHash('sha256').update(f).digest('hex');
  await sql`INSERT INTO api_keys (customer_id,key_prefix,key_hash,name,status) VALUES (${r.id},${p},${h},'T','active')`;
  console.log(f);
}
m().catch(e=>console.error(e.message));