const ExcelJS = require('exceljs');
const moment = require('moment');
const _ = require('underscore');
const util = require('./util.js');
const tu = require('./time_util.js');
const tempfile = require('tempfile');
const workbook = new ExcelJS.Workbook();
const dquery = require('./db/dquery.js');

function addBorder(worksheet, index) {
	worksheet.getRow(index).border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'}};
}

function calcWorkedHours(in_t, out, penalty) {
	let x = out.diff(in_t, 'hours', true) - penalty;
 	if (in_t.diff(tu.getMoment('13:00', 'HH:mm'), 'minutes') <= 0 && 
 			out.diff(tu.getMoment('13:00', 'HH:mm'), 'minutes') > 0) x--;
 	return x;
}

class Report {
	static async getReport(bot, chat_id, data) {
		let dates = [], from_date = tu.getMoment(data.from, 'YYYY.MM.DD'), 
				to_date = tu.getMoment(data.to, 'YYYY.MM.DD'), week_days = new Set(),
				def_in = tu.getMoment('09:00', 'HH:mm'), def_out = tu.getMoment('18:00', 'HH:mm');

		while (to_date.diff(from_date, 'days') >= 0) {
			dates.push(from_date.format('YYYY.MM.DD'));
			week_days.add(from_date.format('ddd'));
			from_date.add(1, 'days');
		}

		let info = await dquery.getEmployeesAttendanceReport(data.company_id, dates);
		info = _.chain(info)
						.map(x => {
							x.times = x.times || '';
							x.custom_work_hours = x.custom_work_hours || '';
							let obj = _.pick(x, 'name'),
									cwh = _.chain(x.custom_work_hours.split(','))
												 .map(t => t.split('-'))
												 .map(t => { return { week_day: t[0], in: t[1], out: t[2] }; })
												 .groupBy('week_day')
												 .map((val, key) => {
												 		return { key, val: _.map(val, k => [k.in, k.out]) };
												 	})
												 .reduce((memo, nxt) => {
													 	memo[nxt.key] = nxt.val;
													 	return memo;
												 }, {})
												 .value();
							let	 wh = _.chain(x.times.split(','))
												 .map(t => { return t.split('-'); })
												 .map(t => {  return { date: t[0], action: t[1], is_marked_by_admin: t[2], penalty: parseFloat(t[3]), time: t[4] }; })
												 .filter('date')
												 .groupBy('date')
												 .map((val, key) => {
												 		let zt = _.sortBy(val, 'date'), worked_hours = 0;
												 		for (let i = 0; i < zt.length; i++) {
												 			if (!!zt[i + 1] && zt[i].action != zt[i + 1].action) {
												 				let in_t = tu.getMoment(zt[i].time, 'HH:mm'), out = tu.getMoment(zt[i + 1].time, 'HH:mm'), tcwh;
												 					if (cwh && (tcwh = cwh[in_t.format('ddd').toLowerCase()])) {
													 					_.each(tcwh, k => {
													 						let c_in = tu.getMoment(k[0], 'HH:mm'), c_out = tu.getMoment(k[1], 'HH:mm');
													 						if (zt[i].time > k[0]) c_in = in_t;
													 						if (k[1] > zt[i + 1].time) c_out = out;
													 						worked_hours += calcWorkedHours(c_in, c_out, 0);
													 					});
													 					worked_hours -= zt[i].penalty;
													 				} else {
													 					if (zt[i].is_marked_by_admin != 'Y') {
													 						if (def_in.diff(in_t, 'minutes') > 0) in_t = def_in;
														 					if (out.diff(def_out, 'minutes') > 0) out = def_out;
																	 		worked_hours += calcWorkedHours(in_t, out, zt[i].penalty);
													 					}
													 				}
												 			} else if (i % 2 == 0) {
												 				let idx;
												 				if (zt[i].action == 'out') idx = i;
												 				else idx = i + 1;

												 				zt.splice(idx, 0, { time: 'N/A' });
															  i++;
												 			}
												 		}
												 		zt = _.chunk(zt, 2);

												 		return { date: key, times: _.map(zt, k => k[0].time + '-' + k[1].time).join('\n'), 
												 						 worked_hours: Math.round(worked_hours * 100) / 100 };
												 }).value();
												 
							_.each(cwh, (val, key) => {
								 let tm = 0;
							 	 _.each(val, v => {
							 	 	let in_t = tu.getMoment(v[0], 'HH:mm'), out = tu.getMoment(v[1], 'HH:mm');
							 	 	tm += calcWorkedHours(in_t, out, 0);
							 	 });
							 	 cwh[key] = Math.round(tm * 100) / 100;
							});
							obj.attendances = wh;
							obj.custom_work_hours = cwh;
							return obj;
						}).value();
		let worksheet = workbook.addWorksheet('attendances');
		worksheet.columns = [{ header: 'Name', key: 'name', width: 30 },
		  ..._.map(dates, x => { return { header: util.reformat(x), key: x, width: 12 }})];
		addBorder(worksheet, 1);

		_.each(info, (x, i) => {
			let dts = {};
			_.each(x.attendances, z => { dts[z.date] = z.times });
			worksheet.addRow({ name: x.name, ...dts });
			addBorder(worksheet, i + 2);
			worksheet.getRow().border = { top: {style:'thin'}, left: {style:'thin'},
																				 bottom: {style:'thin'}, right: {style:'thin'}};
		});
		let att_work_sheet_id = worksheet.id;
		worksheet = workbook.addWorksheet('worked_hours');
		worksheet.columns = [{ header: 'Name', key: 'name', width: 30 },
		  ..._.map(dates, x => { return { header: util.reformat(x), key: x, width: 12 }}),
		  { header: 'Total Worked Hours', key: 'twh', width: 15 },
		  { header: 'Planned Hours', key: 'pwh', width: 15 },
		  { header: 'Current Status', key: 'cs', width: 15 }];
		  addBorder(worksheet, 1);

		_.each(info, (x, i) => {
			let dts = {}, pwh = 0, twh = 0;
			_.each(dates, d => {
				let week_day = tu.getMoment(d, 'YYYY.MM.DD').format('ddd').toLowerCase();
				if (x.custom_work_hours[week_day]) pwh += x.custom_work_hours[week_day];
				else if (week_day != 'sun') pwh += 8;
			});

			_.each(x.attendances, z => {
				dts[z.date] = z.worked_hours;
				twh += z.worked_hours;
			});
			worksheet.addRow({ name: x.name, ...dts, twh, pwh, cs: (twh - pwh) });
			addBorder(worksheet, i + 2);
		});

		var tempFilePath = tempfile('report.xlsx');
		workbook.xlsx.writeFile(tempFilePath).then(() => {
			bot.telegram.sendDocument(chat_id, { source: tempFilePath });
		  workbook.removeWorksheet(att_work_sheet_id);
		  workbook.removeWorksheet(worksheet.id);
		});
	}
}

module.exports = Report;