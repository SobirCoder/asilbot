const moment = require('moment-timezone');

class TimeUtil {
	static getMoment(date, format) {
		let m;
		if (!!date && !!format) m = moment(date, format);
		else m = moment();

		return m.tz('Asia/Tashkent');
	}
}

module.exports = TimeUtil;