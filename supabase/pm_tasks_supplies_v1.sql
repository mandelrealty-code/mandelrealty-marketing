-- Add supplies task type (run if pm_tasks already exists).

alter table public.pm_tasks
  drop constraint if exists pm_tasks_task_type_check;

alter table public.pm_tasks
  add constraint pm_tasks_task_type_check
  check (task_type in (
    'cleaning',
    'maintenance',
    'owner',
    'compliance',
    'statement',
    'supplies',
    'other'
  ));
