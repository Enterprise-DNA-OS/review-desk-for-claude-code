alter table replies add column record_order bigint generated always as identity unique;
alter table assessments add column record_order bigint generated always as identity unique;
create or replace view v_reviews as
 select r.id,l.id location_id,l.code location,l.name location_name,r.external_id,r.owner,r.due_on,r.disposition,r.disposition_reason,
 v.id version_id,v.sequence,v.platform,v.reviewer,v.rating,v.reviewed_on,v.body,v.review_url,v.source_reply,v.source_status,v.source_notes,
 i.exported_at,r.source,
 case when r.disposition='open' then greatest(0,current_date-r.due_on) else 0 end overdue_days,
 a.finding,a.relationship,a.incentive,a.evidence assessment_evidence,
 p.id reply_id,p.body reply,p.author reply_author,ap.actor approved_by,po.posted_at,po.url posted_url,
 r.updated_at last_activity
 from reviews r join locations l on l.id=r.location_id
 join lateral(select * from review_versions x where x.review_id=r.id order by sequence desc limit 1) v on true
 join imports i on i.id=v.import_id
 left join lateral(select * from assessments x where x.review_id=r.id and x.version_id=v.id order by record_order desc limit 1) a on true
 left join lateral(select * from replies x where x.review_id=r.id and x.version_id=v.id order by record_order desc limit 1) p on true
 left join approvals ap on ap.reply_id=p.id left join postings po on po.reply_id=p.id;
