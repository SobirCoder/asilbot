const moment = require('moment');
const sqlite = require('sqlite3').verbose();
const _ = require('underscore');
const pref = require('../pref.js');
const time_util = require('../time_util.js');
let db = new sqlite.Database('./db/dbase.db');

const weekDays = [pref.Monday,pref.Tuesday,pref.Wednesday,pref.Thursday,
 									pref.Friday,pref.Saturday,pref.Sunday];

function getWeekDay(code) {
	return _.find(weekDays, x => x.substring(0, 3).toLowerCase() == code);
}

function reformat(day) {
	return time_util.getMoment(day, 'YYYY.MM.DD').format('DD.MM.YYYY');
}

class Dquery {
	static foreignKeySupport() {
		return new Promise((res, rej) => {
			db.run(`PRAGMA foreign_keys = ON`, {},
			(err) => {
				if (err) throw err;
				res();
			});
		});
	}

	static saveAdmin(admin_id) {
		return new Promise((res, rej) => {
			db.run(`insert into admins(admin_id) values($id)`,
			{ $id: admin_id },
			(err) => {
				if (err) throw err;
				res();
			});
		});
	}

	static deleteAdmin(admin_id) {
		return new Promise((res, rej) => {
			db.run(`delete from admins where admin_id = $id`,
			{ $id: admin_id },
			(err) => {
				if (err) throw err;
				res();
			});
		});
	}

	static getAllAdmins() {
		return new Promise((res, reject) => {
			let admins = [];

			db.serialize(() => {
				db.each('select * from admins', (err, row) => {
					if (err) throw err;
					admins.push(row.admin_id);
				}, (err, count) => {
					if (err) throw err;
					res(admins); 
				});
			});
		});
	}

	static saveCompany(company_name) {
		return new Promise((res, rej) => {
			db.run(`insert into companies(name) values($name)`,
			{ $name: company_name },
			(err) => {
				if (err) throw err;
				res();
			});
		});
	}

	static deleteCompany(company_name) {
		return new Promise((res, rej) => {
			db.run(`delete from companies where name = $name`,
			{ $name: company_name },
			(err) => {
				if (err) throw err;
				res();
			});
		});
	}

	static getAllCompanies() {
		return new Promise((res, reject) => {
			let companies = [];

			db.serialize(() => {
				db.each('select * from companies', (err, row) => {
					if (err) throw err;
					companies.push(row);
				}, (err, count) => {
					if (err) throw err;
					res(companies); 
				});
			});
		});
	}

	static getCompany(company_name) {
		return new Promise((res, rej) => {
			let emp;
			db.get('select * from companies t where t.name = $name', { $name: company_name }, (err, row) => {
				res({ company_id: row.company_id, name: row.name });
			});
		});
	}

	static getCompanyEmployees(company_id) {
		return new Promise((res, reject) => {
			let employees = [];
			db.each(`select name from employees t 
								where exists(select 1 from company_employees s 
															where s.company_id = $company_id
															  and s.employee_id = t.employee_id)`, 
															  { $company_id: company_id }, (err, row) => {
				if (err) throw err;
				employees.push([row.name]);
			}, (err, count) => { 
				res(employees); 
			});
		});
	}

	static getOtherCompanyEmployees(company_id) {
		return new Promise((res, reject) => {
			let employees = [];
			db.each(`select name from employees t 
								where exists(select 1 from company_employees s 
															where s.company_id <> $company_id
															  and s.employee_id = t.employee_id
															  and not exists (select 1 from company_employees w 
																					where w.company_id = $company_id
																					  and w.employee_id = s.employee_id))`, 
															  { $company_id: company_id }, (err, row) => {
				if (err) throw err;
				employees.push([row.name]);
			}, (err, count) => { 
				res(employees); 
			});
		});
	}

	static getAllEmployees() {
		return new Promise((res, reject) => {
			let employees = [];
			db.each(`select * from employees`, {}, (err, row) => {
				if (err) throw err;
				employees.push(row);
			}, (err, count) => { 
				res(employees); 
			});
		});
	}

	static getEmployee(company_id, employee_name) {
		return new Promise((res, rej) => {
			let emp;
			db.get(`select t.*, (select s.action
														 from attendances w 
														 join attendance_infos s
														   on s.attendance_id = w.attendance_id
														 where w.company_id = $cmp_id
														   and w.employee_id = t.employee_id
														   and w.date = $date
														 order by s.time desc
														    limit 1) last_action
								from employees t 
							 where t.name = $name`, 
					  	{ $cmp_id: company_id, $name: employee_name, 
					  		$date: time_util.getMoment().format('YYYY.MM.DD') }, (err, row) => {
				if (err) throw err;
				res(row);
			});
		});
	}

	static saveEmployee(employee_name) {
		return new Promise((res, rej) => {
			db.run(`insert into employees(name) values($name)`,
			{ $name: employee_name },
			(err) => {
				if (err) throw err;
				res();
			});
		});
	}

	static deleteEmployee(employee_name) {
		return new Promise((res, rej) => {
			db.run(`delete from employees where name = $name`,
			{ $name: employee_name },
			(err) => {
				if (err) throw err;
				res();
			});
		});
	}

	static saveCompanyEmployee(data) {
		return new Promise((res, rej) => {
			db.run(`insert into company_employees(company_id, employee_id) values($cmp_id, $emp_id)`, 
			{ $cmp_id: data.company_id, $emp_id: data.employee_id },
			(err) => {
				if (err) throw err;
				res();
			});
		});
	}

	static detachCompanyEmployee(data) {
		return new Promise((res, rej) => {
			db.run(`delete from company_employees where company_id = $cmp_id and employee_id = $emp_id`, 
				{ $cmp_id: data.company_id, $emp_id: data.employee_id },
			(err) => {
				if (err) throw err;
				res();
			});
		});
	}

	static getEmployeeInfos(company_id, employee_id) {
		return new Promise((res, rej) => {
			let emp;
			db.get(`select t.*, 
								(select group_concat(w.start_time || '--' || w.end_time || ' => ' || w.penalty || ' hours', char(10))
									from employee_custom_late_times w
									where w.company_id = $cmp_id
										and w.employee_id = t.employee_id) as late_times,
								(select group_concat(w.week_day || ' => ' || w.in_time || '--' || w.out_time, ',')
									from employee_custom_work_day_times w
									where w.company_id = $cmp_id
										and w.employee_id = t.employee_id) as work_times
								from employees t 
							 where t.employee_id = $id`, { $cmp_id: company_id, $id: employee_id }, (err, row) => {
				if (err) throw err;
				let times;
				if (row.work_times) {
					times = _.map(row.work_times.split(','), x => {
						let letters = x.split('');
						let wd = letters.slice(0, 3);
						letters = letters.slice(4);
						return getWeekDay(wd.join('')) + ' ' + letters.join('');
					});
					times = times.join('\n');
				}
				res({ employee_id: row.employee_id, name: row.name, 
						  custom_late_times: row.late_times, custom_work_day_times: times });
			});
		});
	}

	static async getEmployeeCustomLateTimes(company_id, employee_id) {
		return new Promise((res, reject) => {
			let times = [];

			db.serialize(() => {
				db.each(`select * from employee_custom_late_times t 
						      where t.company_id = $cmp_id
						        and t.employee_id = $emp_id`, { $cmp_id: company_id, $emp_id: employee_id },
					(err, row) => {
						if (err) throw err;
						times.push([row.start_time, row.end_time, row.penalty]);
					}, (err, count) => { 
						if (err) throw err;
						res(times);
				});
			});
		});
	}

	static saveEmployeeCustomLateTime(data) {
		return new Promise((res, rej) => {
			db.run(`insert into employee_custom_late_times(company_id, employee_id, start_time, end_time, penalty)
						  values($cmp_id, $emp_id, $str, $end, $pen)`, 
			{ $cmp_id: data.company_id, $emp_id: data.employee_id, 
				$str: data.start_time, $end: data.end_time, $pen: data.penalty },
			(err) => {
				if (err) throw err;
				res();
			});
		});
	}

	static deleteAllEmployeeCustomLateTimes(company_id, employee_id) {
		return new Promise((res, rej) => {
			db.run('delete from employee_custom_late_times where company_id = $cmp_id and employee_id = $emp_id', 
				{ $cmp_id: company_id, $emp_id: employee_id }, (err) => {
					if (err) throw err;
					res();
				});
		});
	}

	static deleteEmployeeCustomLateTime(data) {
		return new Promise((res, rej) => {
			db.run(`delete from employee_custom_late_times 
							where company_id = $cmp_id 
								and employee_id = $emp_id
								and start_time = $st
								and end_time = $end`, 
					{ $cmp_id: data.company_id, $emp_id: data.employee_id, 
						$st: data.start_time, $end: data.end_time },
					(err) => {
					if (err) throw err;
					res();
				});
		});
	}

	static saveAttendanceInfo(info, callback) {
		db.run(`insert into attendance_infos(attendance_id, action, time, is_in_time, reason, user_reason, penalty)
						  values ($att_id, $action, $time, $is_in_time, $reason, $user_reason, $penalty)`,
			{ $att_id: info.attendance_id, $action: info.action, $time: info.time, 
				$is_in_time: info.is_in_time, $reason: info.reason, 
				$user_reason: info.user_reason, $penalty: info.penalty }, (err) => {
				if (err) throw err;
				callback();
		});
	}

	static saveAttendanceWithInfo(data, callback) {
		let attendance = data.attendance, info = data.attendance_info;
		let param = { $emp_id: attendance.employee_id, $cmp_id: attendance.company_id, 
									$date: attendance.date, $imba: data.is_marked_by_admin };
		db.run(`insert into attendances(employee_id, company_id, date, is_marked_by_admin)
							values($emp_id, $cmp_id, $date, $imba)`, 
		param,
		(err, row) => {
			if (err) throw err;
			db.get(`select attendance_id from attendances t 
							 where t.employee_id = $emp_id
							   and t.company_id = $cmp_id
							   and t.date = $date;`, 
						param, 
						(err, row) => {
					   	if (err) throw err;
					  	Dquery.saveAttendanceInfo({ attendance_id: row.attendance_id, ...info }, callback);
					  });
		});
	}

	static saveAttendance(data) {
		return new Promise((res, rej) => {
			let attendance = data.attendance, info = data.attendance_info, 
					att_param = { $emp_id: attendance.employee_id, $cmp_id: attendance.company_id, $date: attendance.date };
			db.get(`select attendance_id from attendances t 
							 where t.employee_id = $emp_id
							   and t.company_id = $cmp_id
							   and t.date = $date`, att_param, (err, row) => {
				if (err) throw err;
				if (row) Dquery.saveAttendanceInfo({ attendance_id: row.attendance_id, ...info }, res);
				else Dquery.saveAttendanceWithInfo(data, res);
			});
		});
	}

	static deleteEmployeeAttendance(company_id, employee_id, date) {
		return new Promise((res, rej) => {
			db.run(`delete from attendances 
						   where company_id = $cmp_id 
						     and employee_id = $emp_id 
						     and date = $date`, 
				{ $cmp_id: company_id, $emp_id: employee_id, $date: date }, (err) => {
					if (err) throw err;
					res();
				});
		});
	}

	static getEmployeeAttendances(company_id, employee_id) {
			return new Promise((res, rej) => {
				let dates = [];
				db.each(`select t.date, (select group_concat(w.time, ',')
																	 from attendance_infos w
																	where w.attendance_id = t.attendance_id) times
								  from attendances t 
							    where t.company_id = $cmp_id 
							      and t.employee_id = $emp_id
							      and t.date >= $date`, 
						{ $cmp_id: company_id, $emp_id: employee_id, $date: time_util.getMoment().startOf('month').format('YYYY.MM.DD') }, 
						(err, row) => {
							if (err) throw err;
							let prev;
							let total = 0;
							if (row.times) {
								total = _.chain(row.times.split(','))
												 .map(x => time_util.getMoment(row.date + ' ' + x, 'YYYY.MM.DD HH:mm'))
												 .reduce((memory, x, i) => {
													 	if (i % 2 != 0) memory += x.diff(prev, 'hours', true);
													 	prev = x;
													 	return memory;
												  }, 0).value();
							}

							dates.push(`${reformat(row.date)} worked: ${Math.round(total * 100) / 100} hours`);
						}, (err, count) => { 
							if (err) throw err;
							res(dates);
					});
			});
		}

	static getEmployeeAbcences(company_id, employee_id) {
		return new Promise((res, rej) => {
			let dates = [], month_dates = [], now = time_util.getMoment().startOf('day'), start_day = time_util.getMoment().startOf('month');
			while(now.diff(start_day, 'days') >= 0) {
				month_dates.push(start_day.format('YYYY.MM.DD'));
				start_day.add(1, 'days');
			}

			db.get(`select group_concat(t.date, ',') dates from attendances t 
						   where t.company_id = $cmp_id
						     and t.employee_id = $emp_id
						   and t.date >= $date`,
					{ $cmp_id: company_id, $emp_id: employee_id, $date: time_util.getMoment().startOf('month').format('YYYY.MM.DD') }, 
					(err, row) => {
						if (err) throw err;
						if (row.dates) {
							let att_dates = row.dates.split(',');
							dates = _.chain(month_dates)
										   .reject(x => _.contains(att_dates, x))
									     .map(x => [reformat(x)])
									     .value();
						} else {
							dates = _.map(month_dates, x => [reformat(x)]);
						}
						res(dates);
					});
		});
	}

	static getEmployeeCustomWorkHours(company_id, employee_id) {
		return new Promise((res, rej) => {
			let dates = [];
			db.each(`select * from employee_custom_work_day_times t 
						    where t.company_id = $cmp_id
						      and t.employee_id = $emp_id`,
					{ $cmp_id: company_id, $emp_id: employee_id }, 
					(err, row) => {
						if (err) throw err;
						dates.push([`${getWeekDay(row.week_day)} ${row.in_time}-${row.out_time}`]);
					}, (err, count) => { 
						if (err) throw err;
						res(dates);
				});
		});
	}

	static getEmployeeEarliestWorkHour(company_id, employee_id) {
		return new Promise((res, rej) => {
			let emp;
			db.get(`select t.in_time
							  from employee_custom_work_day_times t
						   where t.company_id = $cmp_id
						     and t.employee_id = $emp_id
						   order by t.in_time
						   limit 1`,
					  	{ $cmp_id: company_id, $emp_id: employee_id }, (err, row) => {
				if (err) throw err;
				res(row || {});
			});
		});
	}

	static deleteEmployeeCustomWorkHours(data) {
		return new Promise((res, rej) => {
			db.run(`delete from employee_custom_work_day_times 
							 where company_id = $cmp_id
							   and employee_id = $emp_id
							   and week_day = $wd
							   and in_time = $it
							   and out_time = $ot`, 
				{ $cmp_id: data.company_id, $emp_id: data.employee_id, $wd: data.week_day,
				  $it: data.in_time, $ot: data.out_time }, (err) => {
					if (err) throw err;
					res();
				});
		});
	}

	static deleteAllEmployeeCustomWorkHours(company_id, employee_id) {
		return new Promise((res, rej) => {
			db.run('delete from employee_custom_work_day_times where company_id = $cmp_id and employee_id = $emp_id', 
				{ $cmp_id: company_id, $emp_id: employee_id }, (err) => {
					if (err) throw err;
					res();
				});
		});
	}

	static saveEmployeeCustomWorkHours(data) {
		return new Promise((res, rej) => {
			db.run(`insert into employee_custom_work_day_times(company_id, employee_id, week_day, in_time, out_time)
						  values ($cmp_id, $emp_id, $wd, $it, $ot)`, 
				{ $cmp_id: data.company_id, $emp_id: data.employee_id, $wd: data.week_day, 
					$it: data.in_time, $ot: data.out_time }, (err) => {
					if (err) throw err;
					res();
				});
		});
	}

	static getEmployeesAttendanceReport(company_id, dates) {
		return new Promise((res, rej) => {
			let reps = [], attendances = [];
			dates = _.map(dates, x => `'${x}'`).join(',');
			db.each(`select t.*,
											(select group_concat(d.week_day || '-' || d.in_time || '-' || d.out_time, ',')
									 			 from employee_custom_work_day_times d
										 		where d.company_id = e.company_id
										 	    and d.employee_id = e.employee_id) custom_work_hours,
										 	(select group_concat(k.date || '-' || s.action || '-' ||
										 						(case when k.is_marked_by_admin is not null then k.is_marked_by_admin else 'N' end) || '-' ||
										 						(case when s.penalty is not null then s.penalty else '0' end)
										 						|| '-' || s.time, ',')
												 from attendances k
												 join attendance_infos s
												   on s.attendance_id = k.attendance_id
												where k.company_id = e.company_id
													and k.employee_id = e.employee_id
													and k.date in (${dates})
												 order by k.date, s.time) times
									from employees t
									join company_employees e
									  on e.company_id = $cmp_id
									 and e.employee_id = t.employee_id`, { $cmp_id: company_id },
					(err, row) => {
						if (err) throw err;
						attendances.push(row);
					}, (err, count) => {
						if (err) throw err;
						res(attendances);
				});
		});
	}
}

module.exports = Dquery;