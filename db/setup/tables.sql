create table admins(
    admin_id integer primary key not null
);

create table companies(
    company_id integer primary key AUTOINCREMENT,
    name text unique not null
);

create table employees(
    employee_id integer primary key AUTOINCREMENT,
    name text not null,
    constraint employees_uk unique (name)
);

create table company_employees(
    company_id integer not null,
    employee_id integer not null,
    constraint company_employees_pk primary key(company_id, employee_id), 
    constraint company_employees_f1 foreign key (company_id) references companies(company_id) on delete cascade,
    constraint company_employees_f2s foreign key (employee_id) references employees(employee_id) on delete cascade
);

create table attendances(
    attendance_id integer primary key autoincrement,
    employee_id integer not null,
    company_id integer not null,
    date text not null,
    working_hours numeric,
    constraint attendances_u1 unique (employee_id, company_id, date),
    constraint attendances_f1 foreign key (company_id) references companies(company_id) on delete cascade,
    constraint attendances_f2 foreign key(employee_id) references employees(employee_id) on delete cascade,
    constraint attendances_c1 check(working_hours > 0 and working_hours < 24)
);

create table attendance_infos(
    attendance_id integer not null,
    action text not null,
    time text not null,
    is_in_time text not null,
    reason text,
    user_reason text,
    penalty integer,
    constraint attendance_infos_pk primary key(attendance_id, time),
    constraint attendance_infos_f1 foreign key(attendance_id) references attendances(attendance_id) on delete cascade,
    constraint attendance_infos_c1 check(action = 'in' or action = 'out'),
    constraint attendance_infos_c2 check(is_in_time = 'Y' or is_in_time = 'N'),
    constraint attendance_infos_c3 check(reason in ('workofoffice', 'approvedreason', 'myownbusiness')),
    constraint attendance_infos_c4 check(is_in_time = 'N' and reason is not null or is_in_time = 'Y' and reason is null),
    constraint attendance_infos_c5 check(penalty > 0)
);

create table employee_custom_late_times(
    company_id integer not null,
    employee_id integer not null,
    start_time text not null,
    end_time text not null,
    penalty numeric,
    constraint employee_custom_late_times_pk primary key(company_id, employee_id, start_time, end_time),
    constraint employee_custom_late_times_u1 unique (company_id, employee_id, start_time),
    constraint employee_custom_late_times_u2 unique (company_id, employee_id, end_time),
    constraint employee_custom_late_times_f1 foreign key (company_id) references companies(company_id) on delete cascade,
    constraint employee_custom_late_times_f2 foreign key (employee_id) references employees(employee_id) on delete cascade
);

create index employee_custom_late_times_i1 on employee_custom_late_times(company_id, employee_id);

create table employee_custom_work_day_times (
    company_id  integer not null,
    employee_id integer not null,
    week_day    text not null,
    in_time     text not null,
    out_time    text not null,
    constraint employee_custom_work_day_times_pk primary key (company_id, employee_id, week_day, in_time, out_time), 
    constraint employee_custom_work_day_times_u1 unique (company_id, employee_id, week_day, in_time),
    constraint employee_custom_work_day_times_u2 unique (company_id, employee_id, week_day, out_time),
    constraint employee_custom_work_day_times_f1 foreign key (company_id) references companies(company_id) on delete cascade,
    constraint employee_custom_work_day_times_f2 foreign key (employee_id) references employees(employee_id) on delete cascade,
    constraint employee_custom_work_day_times_c1 check (week_day in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'))
);

create index employee_custom_work_day_times_i1 on employee_custom_work_day_times(company_id, employee_id);


-- create table employee_custom_late_times(
--     employee_id integer primary key not null,
--     start_time text not null,
--     end_time text not null,
--     exception_time numeric,
--     constraint employee_working_scheludes_f1 foreign key(employee_id) references employees(employee_id)
-- );

select * from attendances;

delete from employees;

--insert into admins(admin_id) values(582204502);