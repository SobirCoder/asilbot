const moment = require('moment');
const Markup = require('telegraf/markup');
const dquery = require('./db/dquery.js');
const pref = require('./pref.js');
const _ = require('underscore');
const weekDays = [pref.Monday,pref.Tuesday,pref.Wednesday,pref.Thursday,
 									pref.Friday,pref.Saturday,pref.Sunday];

const penaltyIntervals = [['09:16', '09:30', 1], 
												  ['09:31', '10:00', 1.5],
												  ['10:01', '10:30', 2],
												  ['10:31', '11:00', 3],
												  ['11:01', '12:00', 4]];


let dt = moment('23-11-2021 15:30:32', 'DD-MM-YYYY HH:mm:ss');

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
		return { date: moment().format('DD-MM-YYYY'), time: moment().format('HH:mm:ss')};
	}

	static format(day) {
		return moment(day, 'DD.MM.YYYY').format('YYYY.MM.DD')
	}

	static reformat(day) {
		return moment(day, 'YYYY.MM.DD').format('DD.MM.YYYY');
	}

	static checkInput(employee_id) {
		return new Promise((resolve, rej) => {
			let result, in_time = moment('09:00:00', 'HH:mm:ss'), now = moment(), penaltyHours, date = moment().format('DD-MM-YYYY');
			let diffMinutes = now.diff(in_time, 'minutes'), time = now.format('HH:mm:ss');

			console.log(diffMinutes)

			if (diffMinutes > 15) {
				dquery.getEmployeeCustomLateTimes(employee_id)
						  .then((result) => {
						  	if (result && result.length) {
						  		penaltyHours = findPenalty(mapTimeDetails(result), time);
						  	} else {
						  		penaltyHours = findPenalty(defPenalties, time);
						  	}

						  	let lateHours = diffMinutes / 60, lateMinutes = diffMinutes - 60 * lateHours;
						  	resolve({ is_in_time: pref.NO, penaltyHours,
						  						lateHours, lateMinutes });
						  });
			} else resolve({ is_in_time: pref.YES, date });
		});
	}

	static checkOutput() {
		let out_time = moment('18:00:00', 'HH:mm:ss'), now = moment(), status;
	  let diffMinutes = out_time.diff(now, 'minutes'), time = now.format('HH:mm:ss');
	  if (diffMinutes > 0) {
	  	let earlyHours = diffMinutes / 60, earlyMinutes = diffMinutes - 60 * earlyHours;
	  	return { is_in_time: pref.NO, earlyHours, earlyMinutes };
	  }
	  return { is_in_time: pref.YES };
	}

	static saveAttendance(ctx, data) {
    dquery.saveAttendance(data).then(() => {
        ctx.reply('Your attendance recorded. Thank you!');
        ctx.session.step = 0;
    });
	}

	static getWeekDay(code) {
		return _.find(weekDays, x => x.substring(0, 3).toLowerCase() == code);
	}
			// { $att_id: info.attendance_id, $action: info.action, $time: info.time, 
			// 	$is_in_time: info.is_in_time, $reason: info.reason, 
			// 	$user_reason: info.user_reason, $penalty: info.penalty }

			//{ $emp_id: attendance.employee_id, $cmp_id: attendance.company_id, $date: attendance.date }

	static makeAttendance(data) {
		return new Promise((res, rej) => {
			let param =  { attendance: { employee_id: data.employee_id, 
	                                 company_id: data.company_id,
	                                 date: data.date },
	              attendance_info: { action: 'in', time: '09:00', 
	                                 is_in_time: pref.YES }};

	    dquery.saveAttendance(param).then(() => {
	    	param.attendance_info.action = 'out';
	    	param.attendance_info.time = moment('09:00:00', 'HH:mm:ss').add(data.hours, 'hours').format('HH:mm');
	    	dquery.saveAttendance(param).then(() => {
	    		res();
	    	})
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