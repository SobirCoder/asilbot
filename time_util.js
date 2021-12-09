const moment = require('moment');

class TimeUtil {
	static getMoment(date, format) {
		let m;
		if (!!date && !!format) m = moment(date, format);
		else m = moment();

		return m.utcOffset("+05:00");
	}
}

module.exports = TimeUtil;