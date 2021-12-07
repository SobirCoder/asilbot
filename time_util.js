const moment = require('moment');

class TimeUtil {
	static getMoment(date, format) {
		let m;
		if (!!date && !!format) m = moment(date, format);
		else m = moment();

		return m.utcOffset(5);
	}
}

module.exports = TimeUtil;