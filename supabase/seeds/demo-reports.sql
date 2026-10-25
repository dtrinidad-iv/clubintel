-- Demo intelligence reports for Northbridge: one approved, one draft. Hand-written and
-- fictional; loads after demo-pipeline.sql. The reports go through the same functions as the
-- app: the server's (start, finish, settle) as postgres, and the review as the demo admin.

create or replace function pg_temp.demo_report(p_title text, p_focus text, p_content jsonb)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  -- Ana Analyst, in Northbridge Athletic Commercial.
  new_id := public.start_report('33333333-3333-4333-8333-333333333333', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', p_focus);
  perform public.finish_report(new_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', p_content, 'claude-opus-5-5');
  perform public.settle_ai_usage(new_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'claude-opus-5-5', 14200, 2900, 0, 0, 0.1148);
  update public.reports set title = p_title where id = new_id;
  return new_id;
end;
$$;

select pg_temp.demo_report('Naming rights outlook', 'naming rights', $json$
{
  "summary": "The open pipeline is concentrated in two large sponsorship deals: Kestrelby United's stadium naming rights and Northbridge Athletic's front-of-shirt renewal. Media deals closed steadily over the year, but the overdue fan app deal needs attention.",
  "highlights": [
    "Highlights streaming rights with Northlight Media was the year's largest win.",
    "Media deals have closed every quarter, a dependable base.",
    "Harbourline Ferries is in talks on three separate deals, a strong relationship."
  ],
  "risks": [
    {"title": "Concentration in two deals", "detail": "Naming rights and front-of-shirt make up most of the open value; losing either would leave a large gap."},
    {"title": "Overdue fan app sponsorship", "detail": "Its expected close date has passed while it sits in negotiation."}
  ],
  "recommended_actions": [
    {"action": "Agree a revised close date for the fan app sponsorship.", "why": "It's overdue and still in negotiation.", "priority": "high"},
    {"action": "Line up board approval for the Kestrelby naming rights deal early.", "why": "Approval on the partner's side is the known blocker.", "priority": "medium"},
    {"action": "Assign an owner to the youth academy lead.", "why": "Unowned leads go stale.", "priority": "low"}
  ],
  "clubs_to_watch": [
    {"club": "Kestrelby United", "reason": "Home to the largest open deal and an active commercial director."},
    {"club": "Glenmarrow Thistle", "reason": "A past media win and an open community partnership."}
  ]
}
$json$::jsonb);

select pg_temp.demo_report('Hospitality review', null, $json$
{
  "summary": "Hospitality is the smallest category by value, with open deals at Northbridge Athletic and Pontyrhew Athletic and a recent win for winter fixtures.",
  "highlights": ["Executive boxes at Ironside Park are at proposal stage."],
  "risks": [{"title": "Thin hospitality pipeline", "detail": "Only a handful of hospitality deals are open."}],
  "recommended_actions": [{"action": "Package winter hospitality with matchday advertising.", "why": "Bundles have closed faster this year.", "priority": "medium"}],
  "clubs_to_watch": [{"club": "Caerwen City", "reason": "An active broadcast negotiation could open hospitality talks."}]
}
$json$::jsonb);

-- Adam Admin approves the first.
select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-4222-8222-222222222222', 'role', 'authenticated')::text, false);
set role authenticated;
select public.review_report(id, 'approved') from public.reports
where title = 'Naming rights outlook' and workspace_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
reset role;
select set_config('request.jwt.claims', null, false);
