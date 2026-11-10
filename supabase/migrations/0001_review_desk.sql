create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create function immutable_record() returns trigger language plpgsql as $$ begin raise exception 'Evidence history is append only'; end $$;
create table locations (
 id uuid primary key default gen_random_uuid(),code text unique not null,name text not null,owner text not null,
 response_days integer not null default 3 check(response_days between 1 and 90),
 policy_url text not null default '',security_evidence text not null default '',policy_review_on date not null,
 retention_review_on date not null,purpose text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(length(trim(name))>0 and length(trim(owner))>0 and length(trim(purpose))>0)
);
create table imports (
 id uuid primary key default gen_random_uuid(),location_id uuid not null references locations(id),source text not null,sha256 text not null,
 exported_at timestamptz not null,actor text not null,raw_csv text not null,mapping jsonb not null,row_count integer not null check(row_count>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(location_id,source,sha256)
);
create table reviews (
 id uuid primary key default gen_random_uuid(),location_id uuid not null references locations(id),source text not null,external_id text not null,
 owner text not null,due_on date not null,disposition text not null default 'open' check(disposition in ('open','responded','no-response')),
 disposition_reason text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(location_id,source,external_id),check(disposition<>'no-response' or length(trim(disposition_reason))>0)
);
create table review_versions (
 id uuid primary key default gen_random_uuid(),review_id uuid not null references reviews(id),import_id uuid not null references imports(id),
 sequence integer not null check(sequence>0),content_hash text not null,platform text not null,reviewer text not null,
 rating integer not null check(rating between 1 and 5),reviewed_on date not null,body text not null,review_url text not null,
 source_reply text not null default '',source_status text not null default '',source_notes text not null default '',raw_record jsonb not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(review_id,sequence),
 unique(id,review_id),check(length(trim(body))>0)
);
create table replies (
 id uuid primary key default gen_random_uuid(),review_id uuid not null references reviews(id),version_id uuid not null,
 body text not null,author text not null,evidence text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(version_id,review_id) references review_versions(id,review_id),check(length(trim(body))>0 and length(trim(evidence))>0)
);
create table approvals (
 id uuid primary key default gen_random_uuid(),reply_id uuid unique not null references replies(id),actor text not null,evidence text not null,
 privacy_checked boolean not null check(privacy_checked),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table postings (
 id uuid primary key default gen_random_uuid(),reply_id uuid unique not null references replies(id),actor text not null,
 posted_at timestamptz not null,url text not null,evidence text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table assessments (
 id uuid primary key default gen_random_uuid(),review_id uuid not null references reviews(id),version_id uuid not null,
 finding text not null check(finding in ('checked','uncertain','concern')),relationship text not null check(relationship in ('none-known','disclosed','undisclosed','unknown')),
 incentive text not null check(incentive in ('none-known','disclosed','undisclosed','unknown')),evidence text not null,actor text not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(version_id,review_id) references review_versions(id,review_id)
);
create table actions (
 id uuid primary key default gen_random_uuid(),review_id uuid not null references reviews(id),title text not null,owner text not null,due_on date not null,
 status text not null default 'open' check(status in ('open','done')),evidence text not null default '',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(status<>'done' or length(trim(evidence))>0)
);
create table events (
 id uuid primary key default gen_random_uuid(),review_id uuid references reviews(id),actor text not null,action text not null,detail jsonb not null,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index review_versions_latest on review_versions(review_id,sequence desc);
create index reviews_location on reviews(location_id);
create index events_review on events(review_id,created_at);
create view v_reviews as
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
 left join lateral(select * from assessments x where x.review_id=r.id and x.version_id=v.id order by created_at desc,id desc limit 1) a on true
 left join lateral(select * from replies x where x.review_id=r.id and x.version_id=v.id order by created_at desc,id desc limit 1) p on true
 left join approvals ap on ap.reply_id=p.id left join postings po on po.reply_id=p.id;
create view v_response_queue as select id,location,external_id,rating,owner,due_on,overdue_days,
 case when source_reply<>'' then 'source reply to reconcile' when approved_by is not null then 'approved, awaiting manual posting' when reply_id is not null then 'draft needs approval' else 'needs draft' end next_step
 from v_reviews where disposition='open';
create view v_location_health as select l.id,l.code,l.name,l.owner,
 count(r.id)::integer reviews,count(r.id) filter(where r.disposition='open')::integer awaiting_response,
 count(r.id) filter(where r.overdue_days>0)::integer overdue,
 count(r.id) filter(where r.rating<=2 and r.disposition='open')::integer low_rating_open,
 round(avg(r.rating),2) imported_average,
 (select max(i.exported_at) from imports i where i.location_id=l.id) latest_export
 from locations l left join v_reviews r on r.location_id=l.id group by l.id;
create view v_compliance as
 select l.code location,null::uuid review_id,'POLICY' rule,'Review publication policy is missing or due for review' issue from locations l where l.policy_url='' or l.policy_review_on<current_date
 union all select code,null::uuid,'PRIVACY-5','Access safeguards evidence is missing' from locations where security_evidence=''
 union all select code,null::uuid,'PRIVACY-9','Retention review is due; decide what is still needed' from locations where retention_review_on<current_date
 union all select location,id,'REVIEW-CHECK','Source and disclosure assessment is missing for this version' from v_reviews where finding is null
 union all select location,id,'REVIEW-CONCERN','Review evidence needs human investigation' from v_reviews where finding in ('uncertain','concern')
 union all select location,id,'DISCLOSURE','Relationship or incentive is undisclosed or unknown' from v_reviews where relationship in ('unknown','undisclosed') or incentive in ('unknown','undisclosed');
DO $$ declare n text; begin
 foreach n in array array['locations','imports','reviews','review_versions','replies','approvals','postings','assessments','actions','events'] loop
 execute format('create trigger touch before update on %I for each row execute function touch_updated_at()',n);
 execute format('alter table %I enable row level security',n);
 execute format('revoke all on %I from public',n);
 end loop;
 foreach n in array array['imports','review_versions','replies','approvals','postings','assessments','events'] loop
 execute format('create trigger immutable before update or delete on %I for each row execute function immutable_record()',n);
 end loop;
end $$;
revoke all on v_reviews,v_response_queue,v_location_health,v_compliance from public;
