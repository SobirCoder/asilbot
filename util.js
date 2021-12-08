const moment = require('moment');
const Markup = require('telegraf/markup');
const dquery = require('./db/dquery.js');
const pref = require('./pref.js');
const time_util = require('./time_util.js');
const _ = require('underscore');
const weekDays = [pref.Monday,pref.Tuesday,pref.Wednesday,pref.Thursday,
 									pref.Friday,pref.Saturday,pref.Sunday];

const penaltyIntervals = [['09:16', '09:30', 1], 
												  ['09:31', '10:00', 1.5],
												  ['10:01', '10:30', 2],
												  ['10:31', '11:00', 3],
												  ['11:01', '12:00', 4]];

function mapTimeDetails(intervals) {
	return _.map(intervals, (x, i) => {
					x[0] += ':00:00';
					x[1] += ':59:59';

					return { 'in': x[0], 'out': x[1], 'penalty': x[2] };
				});
}

function findPenalty(penalties, time) {
	for (let p of penalties) {
		if (p.in <= time && p.out >= time) {
			return p.penalty;
		}
	}
}

const defPenalties = mapTimeDetails(penaltyIntervals);

class Util {
	static now() {
		return { date: time_util.getMoment().format('YYYY.MM.DD'), time: time_util.getMoment().format('HH:mm') };
	}

	static format(day) {
		return time_util.getMoment(day, 'DD.MM.YYYY').format('YYYY.MM.DD');
	}

	static reformat(day) {
		return time_util.getMoment(day, 'YYYY.MM.DD').format('DD.MM.YYYY');
	}

	static checkInput(company_id, employee_id) {
		return new Promise((resolve, rej) => {
			dquery.getEmployeeEarliestWorkHour(company_id, employee_id).then(res => {
				let result, in_time = time_util.getMoment('09:00:00', 'HH:mm:ss'), now = time_util.getMoment(), penaltyHours,
					date = time_util.getMoment().format('YYYY.MM.DD');
				if (res.in_time) {
					in_time = time_util.getMoment(res.in_time, 'HH:mm');
				}

				let diffMinutes = now.diff(in_time, 'minutes'), time = now.format('HH:mm:ss'),
					lateHours = Math.trunc(now.diff(in_time, 'hours', true));

				if (diffMinutes > 15) {
					dquery.getEmployeeCustomLateTimes(employee_id)
							  .then((result) => {
							  	if (result && result.length)
							  		penaltyHours = findPenalty(mapTimeDetails(result), time);
							  	else
							  		penaltyHours = findPenalty(defPenalties, time);
							  	let lateMinutes = diffMinutes - lateHours * 60;
							  	resolve({ is_in_time: pref.NO, penaltyHours, lateHours, lateMinutes });
							  });
				} else resolve({ is_in_time: pref.YES, date });
			});
		});
	}

	static checkOutput() {
		let out_time = time_util.getMoment('18:00:00', 'HH:mm:ss'), now = time_util.getMoment();
	  let earlyHours = Math.trunc(out_time.diff(now, 'hours', true)), diffMinutes = out_time.diff(now, 'minutes'),
	  	  time = now.format('HH:mm:ss');
	  if (diffMinutes > 0) {
	  	return { is_in_time: pref.NO, earlyHours, earlyMinutes: diffMinutes - earlyHours * 60 };
	  }
	  return { is_in_time: pref.YES };
	}

	static getWeekDay(code) {
		return _.find(weekDays, x => x.substring(0, 3).toLowerCase() == code);
	}

	static makeAttendance(data) {
		return new Promise((res, rej) => {
			let param = { attendance: { employee_id: data.employee_id, 
	                                company_id: data.company_id,
	                                date: data.date,
	                                is_marked_by_admin: data.is_marked_by_admin },
	             attendance_info: { action: 'in', time: '09:00', 
	                                is_in_time: pref.YES }};
	    if (data.hours > 4) data.hours++;
	                                 
	    dquery.saveAttendance(param).then(() => {
	    	param.attendance_info.action = 'out';
	    	param.attendance_info.time = time_util.getMoment('09:00:00', 'HH:mm:ss').add(data.hours, 'hours').format('HH:mm');
	    	dquery.saveAttendance(param).then(() => {
	    		res();
	    	});
	    });
		});
	}

	static cutAps(word) {
		word.replace(/'/g, '').trim();
	}

	static getEmployeeInfo(ctx, company_id, employee_id, employee_name) {
		dquery.getEmployeeInfos(company_id, employee_id).then(res => {
        ctx.session.employee_id = res.employee_id;
        ctx.reply(`Employee: ${employee_name}. Choose an action:\n` + 
                  `Custom Late Times:\n${res.custom_late_times ? res.custom_late_times + '\n' : ''}` +
                  `Custom Work Day Times:\n${ _.isUndefined(res.custom_work_day_times) ? '' : res.custom_work_day_times }`,
                  Markup.keyboard([[pref.Custom_Late_Times, pref.Custom_Work_Hours],
                                   [pref.Make_Attendance, pref.Delete_Attendance],
                                   [pref.BACK]]).resize().extra());
    });
	}
}

module.exports = Util;